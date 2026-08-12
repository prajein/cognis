import { SessionProfileUpdater } from '../../background/adaptation/SessionProfileUpdater';
import { ProfileRepository } from '../../storage/repositories/ProfileRepository';
import { ReadModelRepository } from '../../storage/repositories/ReadModelRepository';
import { CognisDatabase } from '../../storage/indexeddb/CognisDatabase';
import { migrations } from '../../storage/migrations';
import { EventBus } from '../../core/event-bus/EventBus';
import { ConsoleErrorReporter } from '../../core/error/ConsoleErrorReporter';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { SessionEvents } from '../../core/event-bus/registry';
import { toSessionId, toTimestamp, toEventId } from '../../core/types/session.types';

class Checker {
  passed = 0;
  failed = 0;
  readonly failures: string[] = [];

  ok(condition: boolean, label: string): void {
    if (condition) this.passed++;
    else {
      this.failed++;
      this.failures.push(label);
    }
  }

  eq(actual: unknown, expected: unknown, label: string): void {
    this.ok(actual === expected, `${label} (expected ${expected}, got ${actual})`);
  }
}

class MockReadModelRepository {
  private store = new Map<string, any>();
  async get<T>(id: string): Promise<T | undefined> { return this.store.get(id); }
  async put(model: any): Promise<void> { this.store.set(model.projectionId, model); }
}

class MockProfileRepository {
  private store = new Map<string, any>();
  async get(id: string): Promise<any | undefined> { return this.store.get(id); }
  async put(model: any): Promise<void> { this.store.set(model.profileId, model); }
  async update(id: string, updater: (model: any) => any): Promise<void> {
    const current = this.store.get(id);
    const updated = updater(current);
    this.store.set(id, updated);
  }
}

async function runSessionProfileUpdaterTests() {
  const c = new Checker();

  const profileRepo = new MockProfileRepository() as any;
  const readModelRepo = new MockReadModelRepository() as any;
  const eventBus = new EventBus(new ConsoleErrorReporter());

  const updater = new SessionProfileUpdater(profileRepo, readModelRepo, eventBus, new ConsoleErrorReporter());
  updater.start();

  console.log('[SessionProfileUpdater.selftest] Starting tests...');

  let timeVal = 1000;
  const clock = () => toTimestamp(timeVal++);
  let idCount = 0;
  const idFactory = () => toEventId(`evt-${idCount++}`);
  const options = { clock, idFactory };

  const triggerEnd = async (sessionId: string) => {
    eventBus.publish(SessionEvents.ENDED, createDomainEvent(SessionEvents.ENDED, toSessionId(sessionId), 'test', { reason: 'explicit' }, options));
    // Wait for async fold to complete (hacky but works for isolated tests)
    await new Promise(r => setTimeout(r, 50));
  };

  const setupSession = async (sessionId: string, hasTyping: boolean, detectedGaps: string[] = []) => {
    await readModelRepo.put({
      projectionId: `session-v1_${sessionId}`,
      sessionId,
      hasTypingActivity: hasTyping,
      startTime: Date.now(),
      status: 'ended',
      totalPauseDurationMs: 0,
      lastUpdated: Date.now()
    } as any);

    const gaps: any = {};
    for (const g of detectedGaps) {
      gaps[g] = { detectedCount: 1 };
    }

    await readModelRepo.put({
      projectionId: `gap-profile-v1_${sessionId}`,
      sessionId,
      gaps,
      lastUpdated: Date.now()
    } as any);
  };

  // Test 1: Empty session -> does not count
  await setupSession('s1', false);
  await triggerEnd('s1');
  let profile = await profileRepo.get('default-user');
  c.eq(profile?.recentCountedSessions.length, 0, 'Empty session should not enter Top-7');
  c.ok(profile?.foldedSessions.includes('s1') ?? false, 'Empty session should be marked folded');

  // Test 2: Meaningful session with detection (Initialization)
  await setupSession('s2', true, ['audience']);
  await triggerEnd('s2');
  profile = await profileRepo.get('default-user');
  c.eq(profile?.recentCountedSessions.length, 1, 'Meaningful session should enter Top-7');
  c.eq(profile?.gapHistory['audience'].sessionsSinceLastSeen, 0, 'Detected gap should have counter 0');
  c.eq(profile?.gapHistory['audience'].transferState, 'ACTIVE', 'Detected gap should be ACTIVE');

  // Test 3: Meaningful session without detection (Miss)
  await setupSession('s3', true, []);
  await triggerEnd('s3');
  profile = await profileRepo.get('default-user');
  c.eq(profile?.recentCountedSessions.length, 2, 'Top-7 should have 2 sessions');
  c.eq(profile?.gapHistory['audience'].sessionsSinceLastSeen, 1, 'Miss should advance counter to 1');

  // Test 4: Idempotency (Duplicate Fold)
  await triggerEnd('s3');
  profile = await profileRepo.get('default-user');
  c.eq(profile?.recentCountedSessions.length, 2, 'Duplicate fold should not change Top-7');
  c.eq(profile?.gapHistory['audience'].sessionsSinceLastSeen, 1, 'Duplicate fold should not advance counter');

  // Test 5: Reaching MAYBE_TRANSFERRED (3 misses)
  await setupSession('s4', true, []);
  await setupSession('s5', true, []);
  await triggerEnd('s4');
  await triggerEnd('s5');
  profile = await profileRepo.get('default-user');
  c.eq(profile?.gapHistory['audience'].sessionsSinceLastSeen, 3, 'Counter should be 3');
  c.eq(profile?.gapHistory['audience'].transferState, 'MAYBE_TRANSFERRED', 'State should be MAYBE_TRANSFERRED');

  // Test 6: Reaching TRANSFERRED (7 misses)
  await setupSession('s6', true, []);
  await setupSession('s7', true, []);
  await setupSession('s8', true, []);
  await setupSession('s9', true, []);
  await triggerEnd('s6');
  await triggerEnd('s7');
  await triggerEnd('s8');
  await triggerEnd('s9');
  profile = await profileRepo.get('default-user');
  c.eq(profile?.gapHistory['audience'].sessionsSinceLastSeen, 7, 'Counter should be 7');
  c.eq(profile?.gapHistory['audience'].transferState, 'TRANSFERRED', 'State should be TRANSFERRED');
  c.eq(profile?.recentCountedSessions.length, 7, 'Top-7 should truncate to 7');
  c.eq(profile?.recentCountedSessions[0].sessionId, 's3', 'Top-7 oldest should be S3');

  // Test 7: Reactivation
  await setupSession('s10', true, ['audience']);
  await triggerEnd('s10');
  profile = await profileRepo.get('default-user');
  c.eq(profile?.gapHistory['audience'].sessionsSinceLastSeen, 0, 'Detection should reset counter');
  c.eq(profile?.gapHistory['audience'].transferState, 'ACTIVE', 'Detection should reset state to ACTIVE');

  // Test 8: Never-seen gap ignored on miss
  await setupSession('s11', true, []);
  await triggerEnd('s11');
  profile = await profileRepo.get('default-user');
  c.eq(profile?.gapHistory['intentionality'], undefined, 'Never-seen gap should not initialize on miss');

  if (c.failed > 0) {
    console.error(`[SessionProfileUpdater.selftest] FAILED: ${c.failed} failures`);
    for (const f of c.failures) console.error(`  - ${f}`);
    process.exit(1);
  } else {
    console.log(`[SessionProfileUpdater.selftest] PASSED: ${c.passed} checks`);
    process.exit(0);
  }
}

runSessionProfileUpdaterTests().catch(err => {
  console.error(err);
  process.exit(1);
});
