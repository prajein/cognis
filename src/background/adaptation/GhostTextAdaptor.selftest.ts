import { EventBus } from '../../core/event-bus/EventBus';
import { ConsoleErrorReporter } from '../../core/error/ConsoleErrorReporter';
import { GhostTextAdaptor } from './GhostTextAdaptor';
import { GhostTextEngine } from '../../engines/ghosttext/GhostTextEngine';
import { GhostTextEvents, SessionEvents, AdaptationEvents } from '../../core/event-bus/registry';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { toSessionId, toTimestamp, toEventId } from '../../core/types/session.types';
import { DomainEvent, AdaptationConfiguredPayload } from '../../core/event-bus/contracts';

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

async function runGhostTextAdaptorTests() {
  const c = new Checker();
  const eventBus = new EventBus(new ConsoleErrorReporter());

  // Setup clock & id factories
  let timeVal = 1000;
  const clock = () => toTimestamp(timeVal++);
  let idCount = 0;
  const idFactory = () => toEventId(`evt-${idCount++}`);
  const options = { clock, idFactory };

  const adaptor = new GhostTextAdaptor(eventBus);
  const ghostTextEngine = new GhostTextEngine(eventBus, options);

  adaptor.start();
  ghostTextEngine.start();

  const sessionId = toSessionId('session-m9');

  // Track configured adaptation events
  const adaptationEvents: DomainEvent<AdaptationConfiguredPayload>[] = [];
  eventBus.subscribe(AdaptationEvents.CONFIGURED, (event) => {
    adaptationEvents.push(event);
  });

  console.log('[GhostTextAdaptor.selftest] Starting tests...');

  // Start Session
  eventBus.publish(
    SessionEvents.STARTED,
    createDomainEvent(SessionEvents.STARTED, sessionId, 'test', { platform: 'test' }, options)
  );

  // Helper to trigger display
  const display = (interventionId: string, gapType: any) => {
    eventBus.publish(
      GhostTextEvents.DISPLAYED,
      createDomainEvent(GhostTextEvents.DISPLAYED, sessionId, 'test', {
        interventionId,
        gapType,
        stem: 'Hello',
        displayLatencyMs: 50
      }, options)
    );
  };

  // Helper to trigger dismissal
  const dismiss = (interventionId: string, gapType: any, reason: any) => {
    eventBus.publish(
      GhostTextEvents.DISMISSED,
      createDomainEvent(GhostTextEvents.DISMISSED, sessionId, 'test', {
        interventionId,
        gapType,
        stem: 'Hello',
        reason
      }, options)
    );
  };
  
  // Helper to trigger accepted
  const accept = (interventionId: string, gapType: any) => {
    eventBus.publish(
      GhostTextEvents.ACCEPTED,
      createDomainEvent(GhostTextEvents.ACCEPTED, sessionId, 'test', {
        interventionId,
        gapType,
        stem: 'Hello'
      }, options)
    );
  };

  const detectGap = (gapType: any) => {
    eventBus.publish(
      'gap.detected',
      createDomainEvent('gap.detected', sessionId, 'test', {
        gapType,
        confidence: 0.9
      }, options)
    );
  };

  // ======================================================================
  // Test 1: Active -> Suppressed (Initial threshold: 4 exp, 75% reject)
  // ======================================================================
  const gapType1 = 'audience';

  for (let i = 0; i < 3; i++) {
    const id = `int-1-${i}`;
    display(id, gapType1);
    dismiss(id, gapType1, 'continued_typing'); // explicit rejection
  }

  // 4th exposure
  display('int-1-3', gapType1);
  dismiss('int-1-3', gapType1, 'continued_typing');

  c.eq(adaptationEvents.length, 1, 'Should publish 1 adaptation event to suppress');
  c.eq(adaptationEvents[0]?.payload.action, 'suppress', 'Action should be suppress');
  c.eq(adaptationEvents[0]?.payload.gapType, gapType1, 'Suppressed gapType should be audience');
  
  adaptationEvents.length = 0; // reset

  // ======================================================================
  // Test 2: Suppressed -> Probing (Threshold: 5 suppressed detections)
  // ======================================================================
  for (let i = 0; i < 4; i++) {
    detectGap(gapType1);
  }
  c.eq(adaptationEvents.length, 0, 'Should not probe before threshold');

  // 5th detection triggers probing
  detectGap(gapType1);
  c.eq(adaptationEvents.length, 1, '5th suppressed detection should trigger probe (restore)');
  c.eq(adaptationEvents[0]?.payload.action, 'active', 'Action should be restore for probe');
  
  adaptationEvents.length = 0; // reset

  // ======================================================================
  // Test 3: Probing -> Active (Probe Acceptance Reverses Preference)
  // ======================================================================
  // Display the probe
  display('probe-int-1', gapType1);
  // Accept the probe
  accept('probe-int-1', gapType1);
  
  // State is now ACTIVE again. We can verify this by triggering 4 more detections
  // and ensuring it doesn't trigger another probe, OR by getting a rejection and seeing 
  // it doesn't immediately suppress.
  for (let i = 0; i < 5; i++) detectGap(gapType1);
  c.eq(adaptationEvents.length, 0, 'No more probes should fire because state is ACTIVE');

  // ======================================================================
  // Test 4: Re-Suppress and Probe Rejection Escalation
  // ======================================================================
  // Let's re-suppress audience by giving it 4 fresh rejections
  for (let i = 0; i < 4; i++) {
    const id = `int-re-${i}`;
    display(id, gapType1);
    dismiss(id, gapType1, 'continued_typing');
  }
  c.eq(adaptationEvents.length, 1, 'Should re-suppress audience after fresh rejections');
  c.eq(adaptationEvents[0]?.payload.action, 'suppress', 'Action should be suppress');
  adaptationEvents.length = 0;

  // Now trigger another probe (threshold should be 5 again because it was reset to ACTIVE)
  for (let i = 0; i < 5; i++) detectGap(gapType1);
  c.eq(adaptationEvents.length, 1, 'Should trigger probe again (action: restore)');
  c.eq(adaptationEvents[0]?.payload.action, 'active', 'Action should be restore');
  adaptationEvents.length = 0;

  // Display probe and explicitly REJECT it
  display('probe-int-2', gapType1);
  dismiss('probe-int-2', gapType1, 'continued_typing'); // explicit rejection
  
  // Adaptor should immediately re-suppress
  c.eq(adaptationEvents.length, 1, 'Should immediately re-suppress on probe rejection');
  c.eq(adaptationEvents[0]?.payload.action, 'suppress', 'Action should be suppress');
  adaptationEvents.length = 0;

  // Now, the nextProbeThreshold should have escalated to 10.
  // 5 detections should NOT trigger a probe.
  for (let i = 0; i < 5; i++) detectGap(gapType1);
  c.eq(adaptationEvents.length, 0, '5 detections should not trigger probe due to escalated threshold');
  
  for (let i = 0; i < 5; i++) detectGap(gapType1);
  c.eq(adaptationEvents.length, 1, '10th detection should trigger probe');
  c.eq(adaptationEvents[0]?.payload.action, 'active', 'Action should be restore');
  adaptationEvents.length = 0;

  // ======================================================================
  // Test 5: Passive dismissal preserves Probing state
  // ======================================================================
  // Display the next probe
  display('probe-int-3', gapType1);
  // Passively dismiss it
  dismiss('probe-int-3', gapType1, 'lost_focus');

  // Should NOT re-suppress
  c.eq(adaptationEvents.length, 0, 'Passive dismissal should not alter preference state');
  
  // We are still in PROBING state (the restore action is still active on the engine).
  // Another display will capture a new probe ID
  display('probe-int-4', gapType1);
  accept('probe-int-4', gapType1); // Accept it

  // Since it was accepted, it should revert to ACTIVE.
  // Verify by checking that 10 detections do not trigger anything.
  for (let i = 0; i < 10; i++) detectGap(gapType1);
  c.eq(adaptationEvents.length, 0, 'Should be ACTIVE again after second probe was accepted');

  // ======================================================================
  // Test 6: Strict Probe Attribution
  // ======================================================================
  // Suppress a different gap
  const gapType2 = 'intentionality';
  for (let i = 0; i < 4; i++) {
    const id = `int-2-${i}`;
    display(id, gapType2);
    dismiss(id, gapType2, 'continued_typing');
  }
  c.eq(adaptationEvents.length, 1, 'Should suppress intentionality');
  adaptationEvents.length = 0;

  // Trigger probe
  for (let i = 0; i < 5; i++) detectGap(gapType2);
  c.eq(adaptationEvents.length, 1, 'Should trigger probe for intentionality');
  adaptationEvents.length = 0;

  // The engine displays the probe:
  display('probe-int-5', gapType2);

  // Suddenly, a stray/delayed event from an OLD intervention arrives
  accept('int-2-3', gapType2);
  c.eq(adaptationEvents.length, 0, 'Stray accepted event should not resolve the probe state');

  // The probe itself is rejected
  dismiss('probe-int-5', gapType2, 'continued_typing');
  c.eq(adaptationEvents.length, 1, 'The actual probe rejection should resolve the probe state to SUPPRESSED');
  c.eq(adaptationEvents[0]?.payload.action, 'suppress', 'Action should be suppress');

  // Cleanup
  adaptor.stop();
  ghostTextEngine.dispose();

  if (c.failed > 0) {
    console.error(`[GhostTextAdaptor.selftest] FAILED: ${c.failed} failures`);
    for (const f of c.failures) console.error(`  - ${f}`);
    process.exit(1);
  } else {
    console.log(`[GhostTextAdaptor.selftest] PASSED: ${c.passed} checks`);
    process.exit(0);
  }
}

runGhostTextAdaptorTests().catch(err => {
  console.error(err);
  process.exit(1);
});
