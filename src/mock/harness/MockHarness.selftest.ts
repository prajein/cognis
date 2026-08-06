/**
 * Mock Harness — self-test
 *
 * What & why: framework-free self-test following the repository `Checker`
 * convention (established in `v2.selftest.ts`). Validates that the Mock Harness
 * produces Constitution-compliant domain events with correct envelope structure,
 * branded types, payload shapes, session lifecycle ordering, and hardware
 * readiness.
 *
 * The test injects a deterministic clock and event ID factory so assertions
 * can verify exact values without non-determinism.
 *
 * Run (after a throwaway compile):
 *   tsc --module commonjs --moduleResolution node10 --ignoreDeprecations 6.0 \
 *       --rootDir src --outDir .selftest --noEmit false --resolveJsonModule
 *   node .selftest/mock/harness/MockHarness.selftest.js
 */

import { DomainEvent, CognisEventMap } from '../../core/event-bus/contracts';
import { EventBusContract, EventHandler } from '../../core/event-bus/types';
import { EventType } from '../../core/event-bus/registry';
import { toEventId, toTimestamp, toSessionId } from '../../core/types/session.types';
import { MockHarness } from './MockHarness';
import { SyntheticEventGenerator } from './SyntheticEventGenerator';
import { DelayFn } from './StreamSimulator';

// ---------------------------------------------------------------------------
// Tiny test harness (same Checker pattern as v2.selftest.ts)
// ---------------------------------------------------------------------------

interface SelfTestReport {
  readonly passed: number;
  readonly failed: number;
  readonly failures: readonly string[];
}

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

// ---------------------------------------------------------------------------
// Deterministic clock & ID factory
// ---------------------------------------------------------------------------

let clockTick = 1000;
const deterministicClock = () => toTimestamp(clockTick++);

let idCounter = 0;
const deterministicIdFactory = () => toEventId(`evt-${String(idCounter++).padStart(4, '0')}`);

function resetDeterminism(): void {
  clockTick = 1000;
  idCounter = 0;
}

// ---------------------------------------------------------------------------
// Mock EventBus (captures published events)
// ---------------------------------------------------------------------------

interface CapturedEvent {
  type: string;
  event: DomainEvent<unknown>;
}

function createMockEventBus(): EventBusContract & { captured: CapturedEvent[] } {
  const captured: CapturedEvent[] = [];
  return {
    captured,
    publish<T extends EventType>(type: T, event: DomainEvent<CognisEventMap[T]>): void {
      captured.push({ type, event: event as DomainEvent<unknown> });
    },
    subscribe<T extends EventType>(_type: T, _handler: EventHandler<T>): () => void {
      return () => {};
    },
  };
}

// ---------------------------------------------------------------------------
// Zero-delay function for synchronous-style async tests
// ---------------------------------------------------------------------------

const zeroDelay: DelayFn = () => Promise.resolve();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export async function runMockHarnessSelfTest(): Promise<SelfTestReport> {
  const c = new Checker();

  // ── 1. Session lifecycle ────────────────────────────────────────────────
  {
    resetDeterminism();
    const bus = createMockEventBus();
    const harness = new MockHarness(bus, {
      platform: 'test-platform',
      taskId: 'test-task',
      eventFactoryOptions: { clock: deterministicClock, idFactory: deterministicIdFactory },
    }, zeroDelay);

    const sessionId = harness.startSession();
    c.ok(sessionId !== null, 'startSession returns a non-null SessionId');
    c.eq(bus.captured.length, 1, 'startSession publishes exactly one event');
    c.eq(bus.captured[0]?.type, 'session.started', 'first event is session.started');
    c.eq(
      (bus.captured[0]?.event.payload as { platform: string }).platform,
      'test-platform',
      'session.started has correct platform',
    );
    c.eq(
      (bus.captured[0]?.event.payload as { taskId?: string }).taskId,
      'test-task',
      'session.started has correct taskId',
    );

    harness.endSession('explicit');
    c.eq(bus.captured.length, 2, 'endSession publishes one more event');
    c.eq(bus.captured[1]?.type, 'session.ended', 'second event is session.ended');
    c.eq(
      (bus.captured[1]?.event.payload as { reason: string }).reason,
      'explicit',
      'session.ended has correct reason',
    );
  }

  // ── 2. Double-start guard ───────────────────────────────────────────────
  {
    resetDeterminism();
    const bus = createMockEventBus();
    const harness = new MockHarness(bus, {
      eventFactoryOptions: { clock: deterministicClock, idFactory: deterministicIdFactory },
    }, zeroDelay);

    harness.startSession();
    let threwOnDoubleStart = false;
    try {
      harness.startSession();
    } catch {
      threwOnDoubleStart = true;
    }
    c.ok(threwOnDoubleStart, 'startSession throws if session already active');
    harness.endSession();
  }

  // ── 3. Operation without session guard ──────────────────────────────────
  {
    resetDeterminism();
    const bus = createMockEventBus();
    const harness = new MockHarness(bus, {
      eventFactoryOptions: { clock: deterministicClock, idFactory: deterministicIdFactory },
    }, zeroDelay);

    let threwWithoutSession = false;
    try {
      harness.simulateTyping('hello');
    } catch {
      threwWithoutSession = true;
    }
    c.ok(threwWithoutSession, 'simulateTyping throws if no active session');
  }

  // ── 4. Typing simulation ───────────────────────────────────────────────
  {
    resetDeterminism();
    const bus = createMockEventBus();
    const harness = new MockHarness(bus, {
      eventFactoryOptions: { clock: deterministicClock, idFactory: deterministicIdFactory },
    }, zeroDelay);

    harness.startSession();
    harness.simulateTyping('hello world', { revisionDepth: 2 });

    c.eq(bus.captured.length, 2, 'typing publishes one event after session start');
    const typedEvent = bus.captured[1]!;
    c.eq(typedEvent.type, 'prompt.typed', 'event type is prompt.typed');

    const payload = typedEvent.event.payload as {
      textLength: number;
      wordCount: number;
      currentTextHash: string;
      revisionDepth: number;
    };
    c.eq(payload.textLength, 11, 'prompt.typed textLength is correct');
    c.eq(payload.wordCount, 2, 'prompt.typed wordCount is correct');
    c.eq(payload.revisionDepth, 2, 'prompt.typed revisionDepth is correct');
    c.ok(
      typeof payload.currentTextHash === 'string' && payload.currentTextHash.length > 0,
      'prompt.typed has a non-empty hash',
    );

    harness.endSession();
  }

  // ── 5. Pause and state simulation ──────────────────────────────────────
  {
    resetDeterminism();
    const bus = createMockEventBus();
    const harness = new MockHarness(bus, {
      eventFactoryOptions: { clock: deterministicClock, idFactory: deterministicIdFactory },
    }, zeroDelay);

    harness.startSession();
    harness.simulatePause(1200, 50);
    harness.simulateStateChange('stretch', 'overload', 0.85);

    const pauseEvent = bus.captured[1]!;
    c.eq(pauseEvent.type, 'pause.detected', 'pause event type correct');
    c.eq(
      (pauseEvent.event.payload as { durationMs: number }).durationMs,
      1200,
      'pause durationMs is 1200',
    );

    const stateEvent = bus.captured[2]!;
    c.eq(stateEvent.type, 'state.changed', 'state event type correct');
    c.eq(
      (stateEvent.event.payload as { currentState: string }).currentState,
      'overload',
      'state.changed currentState is overload',
    );
    c.eq(
      (stateEvent.event.payload as { previousState: string }).previousState,
      'stretch',
      'state.changed previousState is stretch',
    );

    harness.endSession();
  }

  // ── 6. Response streaming ──────────────────────────────────────────────
  {
    resetDeterminism();
    const bus = createMockEventBus();
    const harness = new MockHarness(bus, {
      eventFactoryOptions: { clock: deterministicClock, idFactory: deterministicIdFactory },
    }, zeroDelay);

    harness.startSession();
    await harness.simulateResponse('test prompt', 'The quick brown fox', {
      chunkSize: 5,
      chunkDelayMs: 10,
    });

    // session.started + response.started + 4 chunks + response.completed = 7
    c.eq(bus.captured.length, 7, 'streaming produces correct number of events');
    c.eq(bus.captured[1]?.type, 'response.started', 'first stream event is response.started');
    c.eq(bus.captured[2]?.type, 'response.chunk', 'second stream event is response.chunk');
    c.eq(bus.captured[5]?.type, 'response.chunk', 'fifth event is last response.chunk');
    c.eq(bus.captured[6]?.type, 'response.completed', 'last stream event is response.completed');

    // Verify monotonically increasing totalLength
    const totalLengths: number[] = [];
    for (let i = 2; i <= 5; i++) {
      totalLengths.push(
        (bus.captured[i]?.event.payload as { totalLength: number }).totalLength,
      );
    }
    const monotonic = totalLengths.every((v, i) => i === 0 || v > totalLengths[i - 1]!);
    c.ok(monotonic, 'response.chunk totalLength is monotonically increasing');

    // Verify final totalLength equals response text length
    const completed = bus.captured[6]!.event.payload as { responseLength: number };
    c.eq(completed.responseLength, 19, 'response.completed responseLength matches text');

    harness.endSession();
  }

  // ── 7. Hardware simulation ─────────────────────────────────────────────
  {
    resetDeterminism();
    const bus = createMockEventBus();
    const harness = new MockHarness(bus, {
      eventFactoryOptions: { clock: deterministicClock, idFactory: deterministicIdFactory },
    }, zeroDelay);

    harness.startSession();
    harness.simulateHardwareConnect('arc-001', 'eeg_headband', '1.0.0');
    harness.simulateHardwareSignal('arc-001', 'eeg_alpha', 0.82, 0.95);
    harness.simulateHardwareDisconnect('arc-001', 'explicit');

    c.eq(bus.captured[1]?.type, 'hardware.connected', 'hardware.connected event published');
    c.eq(
      (bus.captured[1]?.event.payload as { deviceId: string }).deviceId,
      'arc-001',
      'hardware.connected deviceId correct',
    );
    c.eq(bus.captured[2]?.type, 'hardware.signal.received', 'hardware.signal.received published');
    c.eq(
      (bus.captured[2]?.event.payload as { signalType: string }).signalType,
      'eeg_alpha',
      'signal type is eeg_alpha',
    );
    c.eq(
      (bus.captured[2]?.event.payload as { value: number }).value,
      0.82,
      'signal value is 0.82',
    );
    c.eq(bus.captured[3]?.type, 'hardware.disconnected', 'hardware.disconnected published');

    harness.endSession();
  }

  // ── 8. Event envelope structure ────────────────────────────────────────
  {
    resetDeterminism();
    const bus = createMockEventBus();
    const harness = new MockHarness(bus, {
      eventFactoryOptions: { clock: deterministicClock, idFactory: deterministicIdFactory },
    }, zeroDelay);

    harness.startSession();
    const event = bus.captured[0]!.event;

    c.ok(typeof event.id === 'string' && event.id.length > 0, 'event has non-empty id');
    c.ok(typeof event.timestamp === 'number' && event.timestamp > 0, 'event has positive timestamp');
    c.ok(typeof event.sessionId === 'string' && event.sessionId.length > 0, 'event has non-empty sessionId');
    c.eq(event.source, 'mock-harness', 'event source is mock-harness');

    harness.endSession();
  }

  // ── 9. SyntheticEventGenerator standalone ──────────────────────────────
  {
    resetDeterminism();
    const sid = toSessionId('standalone-session');
    const gen = new SyntheticEventGenerator(sid, {
      clock: deterministicClock,
      idFactory: deterministicIdFactory,
    });

    const started = gen.sessionStarted('test', 'task-1');
    c.eq(started.type, 'session.started', 'generator produces correct event type');
    c.eq(started.sessionId, 'standalone-session', 'generator stamps sessionId');
    c.eq(started.source, 'mock-harness', 'generator stamps source as mock-harness');

    const gapEvent = gen.gapDetected('intentionality', 0.9);
    c.eq(gapEvent.type, 'gap.detected', 'generator produces gap.detected');
    c.eq(
      (gapEvent.payload as { gapType: string }).gapType,
      'intentionality',
      'gap.detected gapType correct',
    );
  }

  // ── 10. Session pause/resume ───────────────────────────────────────────
  {
    resetDeterminism();
    const bus = createMockEventBus();
    const harness = new MockHarness(bus, {
      eventFactoryOptions: { clock: deterministicClock, idFactory: deterministicIdFactory },
    }, zeroDelay);

    harness.startSession();
    harness.pauseSession('tab_hidden');
    harness.resumeSession(5000);

    c.eq(bus.captured[1]?.type, 'session.paused', 'session.paused published');
    c.eq(
      (bus.captured[1]?.event.payload as { reason: string }).reason,
      'tab_hidden',
      'session.paused reason correct',
    );
    c.eq(bus.captured[2]?.type, 'session.resumed', 'session.resumed published');
    c.eq(
      (bus.captured[2]?.event.payload as { pauseDurationMs: number }).pauseDurationMs,
      5000,
      'session.resumed pauseDurationMs correct',
    );

    harness.endSession();
  }

  return { passed: c.passed, failed: c.failed, failures: c.failures };
}

// Auto-run when executed directly (compiled to CommonJS for the throwaway run).
declare const require: undefined | { main?: unknown };
declare const module: unknown;
if (typeof require !== 'undefined' && (require as { main?: unknown }).main === module) {
  runMockHarnessSelfTest().then((report) => {
    // eslint-disable-next-line no-console
    console.log(`[mock-harness self-test] passed=${report.passed} failed=${report.failed}`);
    if (report.failed > 0) {
      // eslint-disable-next-line no-console
      console.error('Failures:\n - ' + report.failures.join('\n - '));
      (globalThis as { process?: { exit(code: number): void } }).process?.exit(1);
    }
  });
}
