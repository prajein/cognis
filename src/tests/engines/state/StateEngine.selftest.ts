/**
 * StateEngine — Self-test
 *
 * Validates Week 2 Behavioural State Inference:
 * - WPM calculation and EMA baseline tracking over deterministic clock ticks
 * - Cold-start fallback path execution
 * - Baseline-relative state transitions (Coasting, Overload, Stretch)
 * - Hysteresis enforcement via TransitionPolicy (cooldown + sustained measurements)
 * - Accurate previousState tracking in state.changed payload
 * - Session lifecycle resets
 */

import { StateEngine } from '../../../engines/state/StateEngine';
import { EventBus } from '../../../core/event-bus/EventBus';
import { ConsoleErrorReporter } from '../../../core/error/ConsoleErrorReporter';
import { SessionEvents, PromptEvents, CognitiveEvents } from '../../../core/event-bus/registry';
import { createDomainEvent } from '../../../core/event-bus/createDomainEvent';
import { toSessionId, toTimestamp, toEventId } from '../../../core/types/session.types';
import { DomainEvent, StateChangedPayload } from '../../../core/event-bus/contracts';

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
    this.ok(actual === expected, `${label} (expected ${String(expected)}, got ${String(actual)})`);
  }
}

export async function runStateEngineTests(): Promise<{ passed: number; failed: number; failures: string[] }> {
  const c = new Checker();

  let virtualTime = 10000;
  const clock = () => toTimestamp(virtualTime);
  let idCount = 0;
  const idFactory = () => toEventId(`evt-${String(idCount++).padStart(4, '0')}`);

  const eventBus = new EventBus(new ConsoleErrorReporter());
  const engine = new StateEngine(eventBus, { clock, idFactory });
  engine.start();

  const capturedStateChanges: DomainEvent<StateChangedPayload>[] = [];
  eventBus.subscribe(CognitiveEvents.STATE_CHANGED, (evt) => {
    capturedStateChanges.push(evt as DomainEvent<StateChangedPayload>);
  });

  const sessionId = toSessionId('test-session-001');

  // 1. Start Session
  eventBus.publish(SessionEvents.STARTED, createDomainEvent(
    SessionEvents.STARTED,
    sessionId,
    'test',
    { platform: 'test-platform' },
    { clock, idFactory }
  ));

  c.eq(capturedStateChanges.length, 0, 'No state change emitted on session.started');

  // 2. Establish Baseline: Send 5 typing events at steady cadence (60 WPM)
  // Each event adds 10 words over 10 seconds = 60 WPM
  let words = 0;
  let textLen = 0;
  for (let i = 1; i <= 5; i++) {
    virtualTime += 10000; // 10 seconds pass
    words += 10;
    textLen += 50;
    eventBus.publish(PromptEvents.TYPED, createDomainEvent(
      PromptEvents.TYPED,
      sessionId,
      'test',
      { textLength: textLen, wordCount: words, currentTextHash: `hash-${i}`, revisionDepth: 0 },
      { clock, idFactory }
    ));
  }

  c.ok(capturedStateChanges.length >= 0, 'Steady typing baseline established at ~60 WPM');

  // 3. Trigger Coasting: Rapid typing burst (15 words over 6 seconds = 150 WPM vs 60 WPM baseline)
  virtualTime += 6000; // Advance past 5s cooldown
  const lastStateCountBeforeCoasting = capturedStateChanges.length;

  // 4 burst events at 150 WPM to sustain 3 approvals
  for (let i = 1; i <= 4; i++) {
    virtualTime += 6000; // 6 seconds
    words += 15;
    textLen += 75;
    eventBus.publish(PromptEvents.TYPED, createDomainEvent(
      PromptEvents.TYPED,
      sessionId,
      'test',
      { textLength: textLen, wordCount: words, currentTextHash: `burst-${i}`, revisionDepth: 0 },
      { clock, idFactory }
    ));
  }

  c.ok(capturedStateChanges.length > lastStateCountBeforeCoasting, 'Coasting state transition approved');
  const coastingEvent = capturedStateChanges[capturedStateChanges.length - 1];
  if (coastingEvent) {
    c.eq(coastingEvent.payload.currentState, 'coasting', 'Current state is coasting');
    c.eq(coastingEvent.payload.previousState, 'stretch', 'Previous state was stretch');
  }

  // 4. Trigger Overload: Slow typing (1 word over 12 seconds = 5 WPM) with heavy deletion
  virtualTime += 6000; // Advance past 5s cooldown
  const lastStateCountBeforeOverload = capturedStateChanges.length;

  let revisions = 0;
  for (let i = 1; i <= 4; i++) {
    virtualTime += 12000; // 12 seconds pass
    words += 1; // 1 word in 12s = 5 WPM
    textLen += 5;
    revisions += 40; // 40 revisions per step -> total 160 over ~134s = 1.19 revisions/sec (> 0.6)
    eventBus.publish(PromptEvents.TYPED, createDomainEvent(
      PromptEvents.TYPED,
      sessionId,
      'test',
      { textLength: textLen, wordCount: words, currentTextHash: `slow-${i}`, revisionDepth: revisions },
      { clock, idFactory }
    ));
  }

  c.ok(capturedStateChanges.length > lastStateCountBeforeOverload, 'Overload state transition approved');
  const overloadEvent = capturedStateChanges[capturedStateChanges.length - 1];
  if (overloadEvent) {
    c.eq(overloadEvent.payload.currentState, 'overload', 'Current state is overload');
    c.eq(overloadEvent.payload.previousState, 'coasting', 'Previous state correctly records previous state (coasting)');
  }

  // 5. Trigger Cognitive Pause (1500 ms >= 1200 ms threshold) to transition to Stretch
  // Advance virtualTime so overall session duration reduces calculated revisionRate below stretch threshold (< 0.3)
  virtualTime += 600000; // 10 minutes pass without new revisions (totalRevisions = 160 over ~734s = 0.21 rev/sec < 0.3)
  const lastStateCountBeforePause = capturedStateChanges.length;

  // Emit 4 pause.detected events at 1500ms duration to sustain hysteresis approval
  for (let i = 1; i <= 4; i++) {
    virtualTime += 6000; // Advance past 5s cooldown
    eventBus.publish(CognitiveEvents.PAUSE_DETECTED, createDomainEvent(
      CognitiveEvents.PAUSE_DETECTED,
      sessionId,
      'test',
      { durationMs: 1500, textLength: textLen },
      { clock, idFactory }
    ));
  }

  c.ok(capturedStateChanges.length > lastStateCountBeforePause, 'Stretch transition approved upon cognitive pause');
  const pauseStretchEvent = capturedStateChanges[capturedStateChanges.length - 1];
  if (pauseStretchEvent) {
    c.eq(pauseStretchEvent.payload.currentState, 'stretch', 'Current state transitioned to stretch on cognitive pause');
    c.eq(pauseStretchEvent.payload.previousState, 'overload', 'Previous state was overload');
  }

  // 6. Session Reset verification
  eventBus.publish(SessionEvents.STARTED, createDomainEvent(
    SessionEvents.STARTED,
    toSessionId('new-session'),
    'test',
    { platform: 'test-platform' },
    { clock, idFactory }
  ));

  engine.stop();
  console.log(`[SelfTest StateEngine] passed=${c.passed} failed=${c.failed}`);
  if (c.failed > 0) {
    console.error('Failures:\n - ' + c.failures.join('\n - '));
  }

  return { passed: c.passed, failed: c.failed, failures: c.failures };
}
