import { SessionProjectionBuilder } from '../../storage/projections/builders/SessionProjectionBuilder';
import { ReadModelRepository } from '../../storage/repositories/ReadModelRepository';
import { CognisDatabase } from '../../storage/indexeddb/CognisDatabase';
import { PromptEvents, SessionEvents } from '../../core/event-bus/registry';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { toSessionId, toTimestamp, toEventId } from '../../core/types/session.types';
import { DomainEvent } from '../../core/event-bus/contracts';
import { migrations } from '../../storage/migrations';

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
  async get<T>(id: string): Promise<T | undefined> { return this.store.get(id) as T | undefined; }
  async put(model: any): Promise<void> { this.store.set(model.projectionId, model); }
}

async function runSessionProjectionBuilderTests() {
  const c = new Checker();

  const repo = new MockReadModelRepository() as unknown as ReadModelRepository;
  const builder = new SessionProjectionBuilder(repo);

  let timeVal = 1000;
  const clock = () => toTimestamp(timeVal++);
  let idCount = 0;
  const idFactory = () => toEventId(`evt-${idCount++}`);
  const options = { clock, idFactory };

  const sessionId = toSessionId('session-proj-test');

  console.log('[SessionProjectionBuilder.selftest] Starting tests...');

  // Test 1: Empty session -> hasTypingActivity = false
  await builder.handleEvent(createDomainEvent(SessionEvents.STARTED, sessionId, 'test', { platform: 'test' }, options));
  let model = await repo.get<any>(`session-v1_${sessionId}`);
  c.eq(model.hasTypingActivity, false, 'Empty session should have hasTypingActivity = false');

  // Test 2: One prompt.typed -> hasTypingActivity = true
  await builder.handleEvent(createDomainEvent(PromptEvents.TYPED, sessionId, 'test', { textLength: 10, wordCount: 2, currentTextHash: 'abc', revisionDepth: 0 }, options));
  model = await repo.get<any>(`session-v1_${sessionId}`);
  c.eq(model.hasTypingActivity, true, 'One prompt.typed should set hasTypingActivity = true');

  // Test 3: Multiple prompt.typed -> remains true (idempotency)
  await builder.handleEvent(createDomainEvent(PromptEvents.TYPED, sessionId, 'test', { textLength: 12, wordCount: 3, currentTextHash: 'abcd', revisionDepth: 1 }, options));
  model = await repo.get<any>(`session-v1_${sessionId}`);
  c.eq(model.hasTypingActivity, true, 'Multiple prompt.typed should keep hasTypingActivity = true');

  // Test 4: Pause/Resume -> typing remains associated with same session
  await builder.handleEvent(createDomainEvent(SessionEvents.PAUSED, sessionId, 'test', { reason: 'idle' }, options));
  await builder.handleEvent(createDomainEvent(SessionEvents.RESUMED, sessionId, 'test', { pauseDurationMs: 5000 }, options));
  model = await repo.get<any>(`session-v1_${sessionId}`);
  c.eq(model.hasTypingActivity, true, 'Pause/Resume should preserve hasTypingActivity');

  // Test 5: session.ended
  await builder.handleEvent(createDomainEvent(SessionEvents.ENDED, sessionId, 'test', { reason: 'explicit' }, options));
  model = await repo.get<any>(`session-v1_${sessionId}`);
  c.eq(model.status, 'ended', 'Session status should be ended');

  // Test 6: Prompt before session.started (lifecycle test on new session)
  const sessionId2 = toSessionId('session-proj-test2');
  await builder.handleEvent(createDomainEvent(PromptEvents.TYPED, sessionId2, 'test', { textLength: 10, wordCount: 2, currentTextHash: 'abc', revisionDepth: 0 }, options));
  let model2 = await repo.get<any>(`session-v1_${sessionId2}`);
  c.eq(model2, undefined, 'Prompt before session.started should be ignored by builder lifecycle');

  // Test 7: Prompt after session.ended (late evidence Issue 3B logic check on projection)
  await builder.handleEvent(createDomainEvent(PromptEvents.TYPED, sessionId, 'test', { textLength: 15, wordCount: 4, currentTextHash: 'abcde', revisionDepth: 2 }, options));
  model = await repo.get<any>(`session-v1_${sessionId}`);
  c.eq(model.hasTypingActivity, true, 'Prompt after session.ended still updates projection');

  if (c.failed > 0) {
    console.error(`[SessionProjectionBuilder.selftest] FAILED: ${c.failed} failures`);
    for (const f of c.failures) console.error(`  - ${f}`);
    process.exit(1);
  } else {
    console.log(`[SessionProjectionBuilder.selftest] PASSED: ${c.passed} checks`);
    process.exit(0);
  }
}

runSessionProjectionBuilderTests().catch(err => {
  console.error(err);
  process.exit(1);
});
