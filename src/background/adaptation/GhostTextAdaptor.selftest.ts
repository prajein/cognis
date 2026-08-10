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

  const sessionId = toSessionId('session-m8');

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

  // Test 1: Rejection threshold evaluation (exposures = 4, rejections = 3 -> 75%)
  // Emit 3 explicit dismissals and 1 displayed to complete 4 exposures
  const gapType = 'audience';

  for (let i = 0; i < 3; i++) {
    const interventionId = `int-${i}`;
    eventBus.publish(
      GhostTextEvents.DISPLAYED,
      createDomainEvent(GhostTextEvents.DISPLAYED, sessionId, 'test', {
        interventionId,
        gapType,
        stem: 'Hello',
        displayLatencyMs: 50
      }, options)
    );
    eventBus.publish(
      GhostTextEvents.DISMISSED,
      createDomainEvent(GhostTextEvents.DISMISSED, sessionId, 'test', {
        interventionId,
        gapType,
        stem: 'Hello',
        reason: 'continued_typing'
      }, options)
    );
  }

  // 4th exposure - displayed only (not yet dismissed)
  eventBus.publish(
    GhostTextEvents.DISPLAYED,
    createDomainEvent(GhostTextEvents.DISPLAYED, sessionId, 'test', {
      interventionId: 'int-3',
      gapType,
      stem: 'Hello',
      displayLatencyMs: 50
    }, options)
  );

  // Rejection count is 3, exposure is 4. Rejection rate is 3/4 = 75%.
  // We trigger dismissal 4, which should cross the threshold and publish AdaptationConfigured
  eventBus.publish(
    GhostTextEvents.DISMISSED,
    createDomainEvent(GhostTextEvents.DISMISSED, sessionId, 'test', {
      interventionId: 'int-3',
      gapType,
      stem: 'Hello',
      reason: 'continued_typing'
    }, options)
  );

  c.eq(adaptationEvents.length, 1, 'Should publish 1 adaptation configuration event');
  c.eq(adaptationEvents[0]?.payload.gapType, 'audience', 'Suppressed gapType should be audience');
  c.eq(adaptationEvents[0]?.payload.action, 'suppress', 'Action should be suppress');
  c.eq(adaptationEvents[0]?.sessionId, sessionId, 'Event sessionId must match');

  // Test 2: Passive dismissals do not count as rejections
  const otherGap = 'intentionality';
  adaptationEvents.length = 0; // Clear tracked events

  // 1st exposure - displayed and dismissed passively (lost_focus)
  eventBus.publish(
    GhostTextEvents.DISPLAYED,
    createDomainEvent(GhostTextEvents.DISPLAYED, sessionId, 'test', {
      interventionId: 'int-10',
      gapType: otherGap,
      stem: 'Intent',
      displayLatencyMs: 50
    }, options)
  );
  eventBus.publish(
    GhostTextEvents.DISMISSED,
    createDomainEvent(GhostTextEvents.DISMISSED, sessionId, 'test', {
      interventionId: 'int-10',
      gapType: otherGap,
      stem: 'Intent',
      reason: 'lost_focus'
    }, options)
  );

  // Emit 3 more rejections to make total exposure = 4
  for (let i = 11; i < 14; i++) {
    eventBus.publish(
      GhostTextEvents.DISPLAYED,
      createDomainEvent(GhostTextEvents.DISPLAYED, sessionId, 'test', {
        interventionId: `int-${i}`,
        gapType: otherGap,
        stem: 'Intent',
        displayLatencyMs: 50
      }, options)
    );
    eventBus.publish(
      GhostTextEvents.DISMISSED,
      createDomainEvent(GhostTextEvents.DISMISSED, sessionId, 'test', {
        interventionId: `int-${i}`,
        gapType: otherGap,
        stem: 'Intent',
        reason: 'continued_typing'
      }, options)
    );
  }

  // Total exposures = 4, rejections = 3. Rejection rate = 3/4 = 75%.
  // Wait, did it trigger?
  // Let's count rejections: we sent 1 lost_focus and 3 continued_typing.
  // Total exposures = 4, total rejections = 3.
  // Wait! In the code:
  // - on lost_focus: `rejections` count does NOT increment.
  // - on continued_typing: `rejections` count increments.
  // So stats.displayed = 4, stats.rejections = 3.
  // 3/4 is 75%, so it SHOULD trigger suppression for otherGap too!
  // Wait, let's verify if that's correct.
  // Yes! Exposures is 4, rejections is 3. Rejection rate is 75%.
  // Let's verify that it DID trigger.
  c.eq(adaptationEvents.length, 1, 'Should publish adaptation config for intentionality as well');

  // Let's test a case where it does NOT trigger (e.g. exposures = 4, rejections = 2 -> 50% rejection rate)
  const thirdGap = 'constraint';
  adaptationEvents.length = 0;

  // 2 passive dismissals, 2 rejections
  for (let i = 20; i < 22; i++) {
    eventBus.publish(
      GhostTextEvents.DISPLAYED,
      createDomainEvent(GhostTextEvents.DISPLAYED, sessionId, 'test', {
        interventionId: `int-${i}`,
        gapType: thirdGap,
        stem: 'Constraint',
        displayLatencyMs: 50
      }, options)
    );
    eventBus.publish(
      GhostTextEvents.DISMISSED,
      createDomainEvent(GhostTextEvents.DISMISSED, sessionId, 'test', {
        interventionId: `int-${i}`,
        gapType: thirdGap,
        stem: 'Constraint',
        reason: 'lost_focus'
      }, options)
    );
  }
  for (let i = 22; i < 24; i++) {
    eventBus.publish(
      GhostTextEvents.DISPLAYED,
      createDomainEvent(GhostTextEvents.DISPLAYED, sessionId, 'test', {
        interventionId: `int-${i}`,
        gapType: thirdGap,
        stem: 'Constraint',
        displayLatencyMs: 50
      }, options)
    );
    eventBus.publish(
      GhostTextEvents.DISMISSED,
      createDomainEvent(GhostTextEvents.DISMISSED, sessionId, 'test', {
        interventionId: `int-${i}`,
        gapType: thirdGap,
        stem: 'Constraint',
        reason: 'continued_typing'
      }, options)
    );
  }

  // Exposures = 4, rejections = 2. Rejection rate = 50% (< 75%).
  c.eq(adaptationEvents.length, 0, 'Should NOT publish adaptation configuration event for constraint gap');

  // Test 3: Engine ignores suppressed gaps
  // 'audience' was suppressed in Test 1.
  // Set recentGap to 'audience' and trigger pause.detected
  eventBus.publish(
    'gap.detected',
    createDomainEvent('gap.detected', sessionId, 'test', {
      gapType: 'audience',
      confidence: 0.9
    }, options)
  );

  // Capture intermediate ghosttext.generated
  const generatedEvents: any[] = [];
  eventBus.subscribe(GhostTextEvents.GENERATED, (e) => {
    generatedEvents.push(e);
  });

  eventBus.publish(
    'pause.detected',
    createDomainEvent('pause.detected', sessionId, 'test', {
      durationMs: 2000,
      textLength: 0
    }, options)
  );

  c.eq(generatedEvents.length, 0, 'GhostTextEngine should not generate stems for suppressed gap type (audience)');

  // Send a gap that is NOT suppressed, e.g. 'constraint'
  eventBus.publish(
    'gap.detected',
    createDomainEvent('gap.detected', sessionId, 'test', {
      gapType: 'constraint',
      confidence: 0.9
    }, options)
  );

  eventBus.publish(
    'pause.detected',
    createDomainEvent('pause.detected', sessionId, 'test', {
      durationMs: 2000,
      textLength: 0
    }, options)
  );

  c.eq(generatedEvents.length, 1, 'GhostTextEngine should generate stems for non-suppressed gap type (constraint)');

  // Test 4: Reset behavior on session boundary
  // End session
  eventBus.publish(
    SessionEvents.ENDED,
    createDomainEvent(SessionEvents.ENDED, sessionId, 'test', { reason: 'explicit' }, options)
  );

  // Start new session
  const newSessionId = toSessionId('session-m8-new');
  eventBus.publish(
    SessionEvents.STARTED,
    createDomainEvent(SessionEvents.STARTED, newSessionId, 'test', { platform: 'test' }, options)
  );

  generatedEvents.length = 0;
  // Trigger 'audience' gap in new session
  eventBus.publish(
    'gap.detected',
    createDomainEvent('gap.detected', newSessionId, 'test', {
      gapType: 'audience',
      confidence: 0.9
    }, options)
  );

  eventBus.publish(
    'pause.detected',
    createDomainEvent('pause.detected', newSessionId, 'test', {
      durationMs: 2000,
      textLength: 0
    }, options)
  );

  c.eq(generatedEvents.length, 1, 'After session reset, previously suppressed gap type (audience) should be active again');

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
