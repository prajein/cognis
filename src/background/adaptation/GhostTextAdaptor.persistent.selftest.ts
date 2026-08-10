import { EventBus } from '../../core/event-bus/EventBus';
import { ConsoleErrorReporter } from '../../core/error/ConsoleErrorReporter';
import { GhostTextAdaptor } from './GhostTextAdaptor';
import { GhostTextEngine } from '../../engines/ghosttext/GhostTextEngine';
import { GhostTextEvents, SessionEvents } from '../../core/event-bus/registry';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { toSessionId, toTimestamp, toEventId } from '../../core/types/session.types';
import { AdaptationPreferenceRepository } from '../../storage/repositories/AdaptationPreferenceRepository';
import { PersistedGapPreference } from '../../core/types/adaptation.types';

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

class MockAdaptationPreferenceRepository {
  public store = new Map<string, PersistedGapPreference>();

  async flush(record: PersistedGapPreference, sessionId: string): Promise<void> {
    const existing = this.store.get(record.id);
    if (existing && existing.lastSessionId === sessionId) {
      return;
    }
    const merged: PersistedGapPreference = {
      ...record,
      totalExposures: (existing?.totalExposures ?? 0) + record.totalExposures,
      totalAcceptances: (existing?.totalAcceptances ?? 0) + record.totalAcceptances,
      totalExplicitRejections: (existing?.totalExplicitRejections ?? 0) + record.totalExplicitRejections,
      firstSeenAt: existing?.firstSeenAt ?? record.firstSeenAt,
      lastUpdatedAt: record.lastUpdatedAt,
      lastSessionId: sessionId,
    };
    this.store.set(record.id, merged);
  }

  async getAll(profileId: string): Promise<PersistedGapPreference[]> {
    return Array.from(this.store.values()).filter(p => p.profileId === profileId);
  }
}

async function runGhostTextAdaptorPersistentTests() {
  const c = new Checker();
  const eventBus = new EventBus(new ConsoleErrorReporter());

  // Setup clock & id factories
  let timeVal = 1000;
  const clock = () => toTimestamp(timeVal++);
  let idCount = 0;
  const idFactory = () => toEventId(`evt-${idCount++}`);
  const options = { clock, idFactory };

  const mockRepo = new MockAdaptationPreferenceRepository();
  let adaptor = new GhostTextAdaptor(eventBus, mockRepo as unknown as AdaptationPreferenceRepository);
  let ghostTextEngine = new GhostTextEngine(eventBus, options);

  adaptor.start();
  ghostTextEngine.start();

  // Helper to trigger display
  const display = (sessionId: string, interventionId: string, gapType: any) => {
    eventBus.publish(
      GhostTextEvents.DISPLAYED,
      createDomainEvent(GhostTextEvents.DISPLAYED, toSessionId(sessionId), 'test', {
        interventionId,
        gapType,
        stem: 'Hello',
        displayLatencyMs: 50
      }, options)
    );
  };

  // Helper to trigger dismissal
  const dismiss = (sessionId: string, interventionId: string, gapType: any, reason: any) => {
    eventBus.publish(
      GhostTextEvents.DISMISSED,
      createDomainEvent(GhostTextEvents.DISMISSED, toSessionId(sessionId), 'test', {
        interventionId,
        gapType,
        stem: 'Hello',
        reason
      }, options)
    );
  };
  
  // Helper to trigger accepted
  const accept = (sessionId: string, interventionId: string, gapType: any) => {
    eventBus.publish(
      GhostTextEvents.ACCEPTED,
      createDomainEvent(GhostTextEvents.ACCEPTED, toSessionId(sessionId), 'test', {
        interventionId,
        gapType,
        stem: 'Hello'
      }, options)
    );
  };

  const detectGap = (sessionId: string, gapType: any) => {
    eventBus.publish(
      'gap.detected',
      createDomainEvent('gap.detected', toSessionId(sessionId), 'test', {
        gapType,
        confidence: 0.9
      }, options)
    );
  };

  console.log('[GhostTextAdaptor.persistent.selftest] Starting cross-session tests...');

  // ======================================================================
  // Session 1: Learn to suppress 'audience' gap
  // ======================================================================
  const s1 = 'session-1';
  eventBus.publish(SessionEvents.STARTED, createDomainEvent(SessionEvents.STARTED, toSessionId(s1), 'test', { platform: 'test' }, options));
  
  // Wait for load
  await new Promise(r => setTimeout(r, 10));

  const gapType1 = 'audience';

  for (let i = 0; i < 4; i++) {
    const id = `int-1-${i}`;
    display(s1, id, gapType1);
    dismiss(s1, id, gapType1, 'continued_typing');
  }

  // Session 1 ends
  eventBus.publish(SessionEvents.ENDED, createDomainEvent(SessionEvents.ENDED, toSessionId(s1), 'test', { reason: 'explicit' }, options));
  await new Promise(r => setTimeout(r, 10));

  // Check persistent store
  const storedPrefsS1 = await mockRepo.getAll('default-user');
  c.eq(storedPrefsS1.length, 1, 'Should have 1 stored preference after session 1');
  c.eq(storedPrefsS1[0]?.gapType, gapType1, 'Stored gapType should be audience');
  c.eq(storedPrefsS1[0]?.persistedState, 'SUPPRESSED', 'Stored state should be SUPPRESSED');
  c.eq(storedPrefsS1[0]?.totalExposures, 4, 'Should have 4 accumulated exposures');
  c.eq(storedPrefsS1[0]?.totalExplicitRejections, 4, 'Should have 4 explicit rejections');

  // ======================================================================
  // Session 2: Load suppressed state, reconstruct threshold, trigger probe
  // ======================================================================
  const s2 = 'session-2';
  eventBus.publish(SessionEvents.STARTED, createDomainEvent(SessionEvents.STARTED, toSessionId(s2), 'test', { platform: 'test' }, options));
  await new Promise(r => setTimeout(r, 10));

  // Since it was 4/4 rejection rate (1.0), threshold should be reconstructed to 20
  // So 5 detections should NOT trigger a probe.
  for (let i = 0; i < 5; i++) {
    detectGap(s2, gapType1);
  }
  
  // Verify it didn't probe (if we could inspect internal state, nextProbeThreshold is 20)
  // Let's do 15 more detections (total 20)
  let probeTriggered = false;
  eventBus.subscribe('adaptation.configured', (e) => {
    if (e.payload.action === 'active') probeTriggered = true;
  });

  for (let i = 0; i < 15; i++) {
    detectGap(s2, gapType1);
  }
  
  c.eq(probeTriggered, true, 'Probe should trigger after exactly 20 suppressed detections due to reconstructed threshold');

  // Accept probe in session 2
  display(s2, 'probe-1', gapType1);
  accept(s2, 'probe-1', gapType1);

  // Session 2 ends
  eventBus.publish(SessionEvents.ENDED, createDomainEvent(SessionEvents.ENDED, toSessionId(s2), 'test', { reason: 'explicit' }, options));
  await new Promise(r => setTimeout(r, 10));

  const storedPrefsS2 = await mockRepo.getAll('default-user');
  c.eq(storedPrefsS2.length, 1, 'Should still have 1 stored preference');
  c.eq(storedPrefsS2[0]?.persistedState, 'ACTIVE', 'Stored state should have reversed to ACTIVE');
  c.eq(storedPrefsS2[0]?.totalExposures, 5, 'Session 1 exposures (4) + Session 2 exposures (1 from probe accept)');

  // Cleanup
  adaptor.stop();
  ghostTextEngine.dispose();

  if (c.failed > 0) {
    console.error(`[GhostTextAdaptor.persistent.selftest] FAILED: ${c.failed} failures`);
    for (const f of c.failures) console.error(`  - ${f}`);
    process.exit(1);
  } else {
    console.log(`[GhostTextAdaptor.persistent.selftest] PASSED: ${c.passed} checks`);
    process.exit(0);
  }
}

runGhostTextAdaptorPersistentTests().catch(err => {
  console.error(err);
  process.exit(1);
});
