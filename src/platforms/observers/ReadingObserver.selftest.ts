import { ReadingObserver } from './ReadingObserver';
import { EventBus } from '../../core/event-bus/EventBus';
import { PlatformConfig } from '../selectors/interfaces';
import { SessionId } from '../../core/types/session.types';
import { PromptEvents, SessionEvents, CognitiveEvents, ResponseEvents } from '../../core/event-bus/registry';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { ReadingEngagementMeasuredPayload } from '../../core/event-bus/contracts';

// Mock DOM environment for Node.js
if (typeof global !== 'undefined' && !global.document) {
  (global as any).Element = class Element {};
  let scrollCallbacks: Array<EventListener> = [];
  const mockNode = new (global as any).Element();
  Object.assign(mockNode, {
    addEventListener: (event: string, cb: EventListener) => {
      if (event === 'scroll') scrollCallbacks.push(cb);
    },
    removeEventListener: (event: string, cb: EventListener) => {
      if (event === 'scroll') scrollCallbacks = scrollCallbacks.filter(c => c !== cb);
    },
    scrollTop: 0,
    matches: (sel: string) => sel === '.mock-container'
  });

  (global as any).document = {
    querySelector: (selector: string) => {
      if (selector === '.mock-container') return mockNode;
      return null;
    }
  };

  (global as any).window = {
    scrollY: 0,
    addEventListener: (event: string, cb: EventListener, options?: any) => {
      if (event === 'scroll') scrollCallbacks.push(cb);
    },
    removeEventListener: (event: string, cb: EventListener, options?: any) => {
      if (event === 'scroll') scrollCallbacks = scrollCallbacks.filter(c => c !== cb);
    }
  };

  (global as any).triggerScroll = (target = (global as any).window) => {
    const event = { target, type: 'scroll' } as any;
    scrollCallbacks.forEach(cb => cb(event));
  };

  (global as any).requestAnimationFrame = (cb: FrameRequestCallback) => { return setTimeout(() => cb(Date.now()), 0); };
  (global as any).cancelAnimationFrame = (id: number) => { clearTimeout(id); };
}

const mockSessionId = 'test-session-123' as SessionId;
const mockConfigWindow: PlatformConfig = {
  id: 'test-win',
  version: '1.0',
  urlPattern: /.*/,
  selectors: {
    promptInput: '#mock-input',
    submitButton: '#mock-submit',
    responseContainer: '#mock-container',
    responseBlock: '.mock-block',
    streamingIndicator: '.mock-streaming',
    scrollContainer: 'window'
  }
};

class MockTestHarness {
  public bus = new EventBus({ report: () => {} });
  public observer: ReadingObserver;
  public events: ReadingEngagementMeasuredPayload[] = [];

  constructor() {
    this.observer = new ReadingObserver(this.bus, mockConfigWindow, mockSessionId);

    this.bus.subscribe(CognitiveEvents.READING_ENGAGEMENT_MEASURED, (e) => {
      this.events.push(e.payload as ReadingEngagementMeasuredPayload);
    });
  }

  public connect() {
    this.observer.connect();
  }

  public disconnect() {
    this.observer.disconnect();
  }

  public emitResponseStarted(promptEventId: string) {
    this.bus.publish(ResponseEvents.STARTED, createDomainEvent(ResponseEvents.STARTED, mockSessionId, 'test', {
      promptEventId,
      promptHash: 'hash',
      wasEnriched: false
    }));
  }

  public emitTyped() {
    this.bus.publish(PromptEvents.TYPED, createDomainEvent(PromptEvents.TYPED, mockSessionId, 'test', {
      textLength: 5,
      wordCount: 1,
      currentTextHash: 'hash',
      revisionDepth: 0
    }));
  }

  public emitSent() {
    this.bus.publish(PromptEvents.SENT, createDomainEvent(PromptEvents.SENT, mockSessionId, 'test', {
      promptHash: 'hash2',
      textLength: 5,
      wordCount: 1,
      wasEnriched: false
    }));
  }

  public emitSessionEnded() {
    this.bus.publish(SessionEvents.ENDED, createDomainEvent(SessionEvents.ENDED, mockSessionId, 'test', {
      reason: 'explicit'
    }));
  }

  public emitSessionStarted() {
    this.bus.publish(SessionEvents.STARTED, createDomainEvent(SessionEvents.STARTED, mockSessionId, 'test', {
      platform: 'chatgpt'
    }));
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function runReadingObserverTests(c: any): Promise<void> {
  let fakeNow = 1000;
  let origDateNow = Date.now;

  const resetClock = () => {
    fakeNow = 1000;
    Date.now = () => fakeNow;
  };

  const advanceClock = (ms: number) => {
    fakeNow += ms;
  };

  await c.test('Response Started initializes tracking and prompt.typed finalizes exactly once', async () => {
    resetClock();
    const harness = new MockTestHarness();
    harness.connect();

    harness.emitResponseStarted('prompt-1');
    advanceClock(50);
    harness.emitTyped();
    harness.emitTyped(); // Duplicate should be ignored

    c.eq(harness.events.length, 1, 'Only one event emitted');
    const e = harness.events[0];
    c.eq(e.promptEventId, 'prompt-1', 'Correct correlation');
    c.eq(e.actionType, 'typed', 'Action type is typed');
    c.assert(e.readingDurationMs >= 50, 'Clock measured time');
    c.eq(e.scrollVelocityPxPerSec, 0, 'No scroll -> 0 velocity');
    c.eq(e.scrollReversals, 0, 'No scroll -> 0 reversals');

    harness.disconnect();
    Date.now = origDateNow;
  });

  await c.test('Prompt.sent finalizes tracking', async () => {
    resetClock();
    const harness = new MockTestHarness();
    harness.connect();
    harness.emitResponseStarted('prompt-2');
    advanceClock(10);
    harness.emitSent();

    c.eq(harness.events.length, 1, 'Event emitted');
    c.eq(harness.events[0].actionType, 'sent', 'Action type is sent');
    harness.disconnect();
    Date.now = origDateNow;
  });

  await c.test('Reversal logic: strict invariant testing (ignore jitter, proper baseline)', async () => {
    resetClock();
    const harness = new MockTestHarness();
    harness.connect();

    harness.emitResponseStarted('prompt-3');

    // Initial position
    (global as any).window.scrollY = 100;
    (global as any).triggerScroll();
    await sleep(0);

    // 1. Initial scroll down
    advanceClock(50);
    (global as any).window.scrollY = 300;
    (global as any).triggerScroll();
    await sleep(0);

    // 2. Continued scroll down (pushes extremum)
    advanceClock(50);
    (global as any).window.scrollY = 600;
    (global as any).triggerScroll();
    await sleep(0);

    // 3. Small jitter up (20px, below 50px threshold)
    advanceClock(50);
    (global as any).window.scrollY = 580;
    (global as any).triggerScroll();
    await sleep(0);

    // 4. Return to previous downward scroll (this shouldn't create a false reversal)
    advanceClock(50);
    (global as any).window.scrollY = 610;
    (global as any).triggerScroll();
    await sleep(0);

    // 5. Meaningful reversal up (>50px from the new extremum 610)
    advanceClock(50);
    (global as any).window.scrollY = 500; // Moved 110px up from 610
    (global as any).triggerScroll();
    await sleep(0);

    // 6. Continued movement in reversed direction
    advanceClock(50);
    (global as any).window.scrollY = 400;
    (global as any).triggerScroll();
    await sleep(0);

    // 7. Second genuine reversal (down > 50px from extremum 400)
    advanceClock(50);
    (global as any).window.scrollY = 500;
    (global as any).triggerScroll();
    await sleep(0);

    harness.emitTyped();

    Date.now = origDateNow;

    c.eq(harness.events.length, 1, 'Event emitted');
    const e = harness.events[0];

    // Distances:
    // 100 -> 300 (200)
    // 300 -> 600 (300)
    // 600 -> 580 (20)
    // 580 -> 610 (30)
    // 610 -> 500 (110)
    // 500 -> 400 (100)
    // 400 -> 500 (100)
    // Total = 860

    // Time = 7 * 50 = 350ms = 0.35s
    // Velocity = round(860 / 0.35) = 2457

    c.eq(e.scrollVelocityPxPerSec, 2457, 'Calculated velocity correctly');
    c.eq(e.scrollReversals, 2, 'Counted exactly two reversals, ignored jitter, handled baseline correctly');

    harness.disconnect();
  });


  await c.test('Pause Handling: Long pause between scroll events (Elapsed-Sample-Time)', async () => {
    resetClock();
    const harness = new MockTestHarness();
    harness.connect();
    harness.emitResponseStarted('prompt-pause');

    // Base position
    (global as any).window.scrollY = 100;
    (global as any).triggerScroll();
    await sleep(0);

    // Initial movement
    advanceClock(50);
    (global as any).window.scrollY = 200;
    (global as any).triggerScroll();
    await sleep(0);

    // 5 minute pause (300,000 ms)
    advanceClock(300000);

    // Movement after long pause
    (global as any).window.scrollY = 201;
    (global as any).triggerScroll();
    await sleep(0);

    harness.emitTyped();

    c.eq(harness.events.length, 1, 'Event emitted');
    const e = harness.events[0];

    // Mathematically expected result (Elapsed-Sample-Time):
    // First movement: 100 -> 200. Distance = 100px. Time = 50ms.
    // Pause: 300,000ms.
    // Second movement: 200 -> 201. Distance = 1px. Time = 300,000ms.
    // Total Distance = 101px
    // Total Time = 300,050ms = 300.05 seconds
    // Velocity = 101 / 300.05 = 0.3366 px/s -> rounded to 0

    c.eq(e.scrollVelocityPxPerSec, 0, 'Velocity calculation inherently included the 5-minute pause (rounded down to 0 px/s)');
    harness.disconnect();
  });

  await c.test('Separate-frame movement (accumulation)', async () => {
    resetClock();
    const harness = new MockTestHarness();
    harness.connect();
    harness.emitResponseStarted('prompt-sep-frame');

    (global as any).window.scrollY = 100;
    (global as any).triggerScroll();
    await sleep(0);

    advanceClock(50);
    (global as any).window.scrollY = 140;
    (global as any).triggerScroll();
    await sleep(0);

    advanceClock(50);
    (global as any).window.scrollY = 220;
    (global as any).triggerScroll();
    await sleep(0);

    harness.emitTyped();

    c.eq(harness.events.length, 1, 'Event emitted');
    const e = harness.events[0];

    // Distance: |140 - 100| + |220 - 140| = 40 + 80 = 120px
    // Time: 50ms + 50ms = 100ms = 0.1s
    // Velocity = 120 / 0.1 = 1200 px/s
    c.eq(e.scrollVelocityPxPerSec, 1200, 'Velocity accumulated accurately across separate RAF frames');
    harness.disconnect();
  });

  await c.test('Zero distance and zero time samples are ignored', async () => {
    resetClock();
    const harness = new MockTestHarness();
    harness.connect();

    harness.emitResponseStarted('prompt-z');

    (global as any).window.scrollY = 100;
    (global as any).triggerScroll();
    await sleep(0);

    advanceClock(50);
    (global as any).window.scrollY = 200;
    (global as any).triggerScroll();
    await sleep(0);

    // Zero time, distance = 0
    (global as any).window.scrollY = 200;
    (global as any).triggerScroll();
    await sleep(0);

    // Time passed, distance = 0
    advanceClock(50);
    (global as any).window.scrollY = 200;
    (global as any).triggerScroll();
    await sleep(0);

    // Zero time, distance passed (simulated glitch)
    (global as any).window.scrollY = 300;
    (global as any).triggerScroll();
    await sleep(0);

    harness.emitTyped();

    Date.now = origDateNow;

    c.eq(harness.events.length, 1, 'Event emitted');
    const e = harness.events[0];

    // Total valid distance = 100px.
    // Total valid time = 50ms.
    // Velocity = 100 / 0.05 = 2000

    c.eq(e.scrollVelocityPxPerSec, 2000, 'Velocity ignored zero samples (100px/0.05s = 2000px/s)');

    harness.disconnect();
  });

  await c.test('Session started resets state without emitting', async () => {
    const harness = new MockTestHarness();
    harness.connect();

    harness.emitResponseStarted('prompt-4');
    harness.emitSessionStarted();
    harness.emitTyped(); // Should do nothing because tracking was reset

    c.eq(harness.events.length, 0, 'No events emitted');
    harness.disconnect();
  });

  await c.test('New response started finalizes previous tracking', async () => {
    const harness = new MockTestHarness();
    harness.connect();

    harness.emitResponseStarted('prompt-5');
    await sleep(10);
    harness.emitResponseStarted('prompt-6'); // Interrupts

    c.eq(harness.events.length, 1, 'First tracking was flushed');
    c.eq(harness.events[0].promptEventId, 'prompt-5', 'Flushed correct prompt');
    c.eq(harness.events[0].actionType, 'interrupted', 'Assigned interrupted fallback');

    harness.disconnect();
  });


  await c.test('Rapid scroll events occurring before RAF execution', async () => {
    resetClock();
    const harness = new MockTestHarness();
    harness.connect();
    harness.emitResponseStarted('prompt-rapid');

    (global as any).window.scrollY = 100;
    (global as any).triggerScroll();
    // Simulate multiple scrolls before RAF fires
    (global as any).window.scrollY = 200;
    (global as any).triggerScroll();
    (global as any).window.scrollY = 400;
    (global as any).triggerScroll();

    // Now allow RAF to fire
    await sleep(0);

    // The initial position was set to 400 (latest).

    advanceClock(50);
    (global as any).window.scrollY = 450;
    (global as any).triggerScroll();
    (global as any).window.scrollY = 500;
    (global as any).triggerScroll();
    await sleep(0);

    harness.emitTyped();

    c.eq(harness.events.length, 1, 'Event emitted');
    const e = harness.events[0];

    // Initial was 400. Later was 500. Distance = 100px. Time = 50ms.
    c.eq(e.scrollVelocityPxPerSec, 2000, 'Calculated velocity from latest pending position');
    harness.disconnect();
  });


  await c.test('Rapid reversal before RAF (Frame-sampled displacement)', async () => {
    resetClock();
    const harness = new MockTestHarness();
    harness.connect();
    harness.emitResponseStarted('prompt-rapid-rev');

    // Base position
    (global as any).window.scrollY = 100;
    (global as any).triggerScroll();
    await sleep(0);

    advanceClock(50);
    // Simulate scroll down to 200, then immediate reversal to 50 within the same frame before RAF fires
    (global as any).window.scrollY = 200;
    (global as any).triggerScroll();

    (global as any).window.scrollY = 50;
    (global as any).triggerScroll();

    // Now allow RAF to fire
    await sleep(0);

    harness.emitTyped();

    c.eq(harness.events.length, 1, 'Event emitted');
    const e = harness.events[0];

    // The observer uses frame-sampled displacement.
    // The previous extremum was 100.
    // The rendered frame position is 50.
    // The intermediate 200 was never rendered and should be ignored.
    // Distance = abs(50 - 100) = 50.
    // Velocity = 50 / 0.05 = 1000

    c.eq(e.scrollVelocityPxPerSec, 1000, 'Calculated velocity using frame-sampled position (50px displacement)');
    c.eq(e.scrollReversals, 0, 'No false reversal recorded for the intermediate unrendered position');

    harness.disconnect();
  });


  await c.test('Destroy permanently inert', async () => {
    resetClock();
    const harness = new MockTestHarness();
    harness.connect();
    harness.emitResponseStarted('prompt-destroy');

    harness.observer.destroy();

    // Attempt to connect again
    harness.connect();

    (global as any).window.scrollY = 100;
    (global as any).triggerScroll();
    await sleep(0);

    harness.emitTyped();
    c.eq(harness.events.length, 0, 'No events emitted after destroy, observer remained inert');
  });

  await c.test('Disconnect cleanup', async () => {
    resetClock();
    const harness = new MockTestHarness();
    harness.connect();
    harness.emitResponseStarted('prompt-cleanup');

    (global as any).window.scrollY = 100;
    (global as any).triggerScroll();

    // Disconnect before RAF fires
    harness.disconnect();
    await sleep(0);

    // Ensure no RAF fired and no events emitted
    harness.emitTyped();
    c.eq(harness.events.length, 0, 'No event emitted after disconnect');
  });

  await c.test('Stale RAF cancellation on tracking reset', async () => {
    resetClock();
    const harness = new MockTestHarness();
    harness.connect();
    harness.emitResponseStarted('prompt-stale');

    (global as any).window.scrollY = 100;
    (global as any).triggerScroll();

    // Reset before RAF fires
    harness.emitSessionStarted();
    await sleep(0);

    harness.emitResponseStarted('prompt-stale-2');
    harness.emitTyped();

    c.eq(harness.events.length, 1, 'Event emitted');
    c.eq(harness.events[0].scrollVelocityPxPerSec, 0, 'Stale RAF was cancelled');
    harness.disconnect();
  });

  await c.test('Dynamic scroll target matching', async () => {
    resetClock();
    const dynConfig = { ...mockConfigWindow, selectors: { ...mockConfigWindow.selectors, scrollContainer: '.mock-container' } };
    const harness = new MockTestHarness();
    (harness as any).observer = new ReadingObserver(harness.bus, dynConfig, mockSessionId);
    harness.connect();
    harness.emitResponseStarted('prompt-dyn');

    const mockContainer = (global as any).document.querySelector('.mock-container');
    mockContainer.scrollTop = 100;
    (global as any).triggerScroll(mockContainer);
    await sleep(0);

    advanceClock(50);
    mockContainer.scrollTop = 200;
    (global as any).triggerScroll(mockContainer);
    await sleep(0);

    harness.emitTyped();
    c.eq(harness.events.length, 1, 'Event emitted');
    c.eq(harness.events[0].scrollVelocityPxPerSec > 0, true, 'Velocity tracked from dynamic target');
    harness.disconnect();
  });

  await c.test('Missing target behavior', async () => {
    resetClock();

    const badConfig = { ...mockConfigWindow, selectors: { ...mockConfigWindow.selectors, scrollContainer: undefined } };
    const harness = new MockTestHarness();
    (harness as any).observer = new ReadingObserver(harness.bus, badConfig, mockSessionId);
    harness.connect();

    harness.emitResponseStarted('prompt-missing');

    (global as any).window.scrollY = 100;
    (global as any).triggerScroll();
    await sleep(0);

    advanceClock(50);
    (global as any).window.scrollY = 200;
    (global as any).triggerScroll();
    await sleep(0);

    harness.emitTyped();
    c.eq(harness.events.length, 1, 'Event emitted');
    c.eq(harness.events[0].scrollVelocityPxPerSec, 0, 'Missing target tracks 0 safely');
    harness.disconnect();
  });

  await c.test('Exact-once finalization', async () => {
    const harness = new MockTestHarness();
    harness.connect();
    harness.emitResponseStarted('prompt-exact');

    harness.emitTyped();
    harness.emitSent();
    harness.emitSessionEnded();

    c.eq(harness.events.length, 1, 'Event emitted exactly once');
    harness.disconnect();
  });

  await c.test('Session ended finalizes tracking', async () => {
    const harness = new MockTestHarness();
    harness.connect();

    harness.emitResponseStarted('prompt-se');
    await sleep(10);
    harness.emitSessionEnded();

    c.eq(harness.events.length, 1, 'Tracking was flushed');
    c.eq(harness.events[0].promptEventId, 'prompt-se', 'Flushed correct prompt');
    c.eq(harness.events[0].actionType, 'session_ended', 'Assigned session_ended');

    harness.disconnect();
  });
}

class Checker {
  passed = 0;
  failed = 0;
  failures: string[] = [];
  async test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      this.passed++;
    } catch (e: any) {
      this.failed++;
      this.failures.push(`${name} threw: ${e.message || e}`);
    }
  }
  eq(actual: any, expected: any, msg: string) {
    if (actual !== expected) {
      throw new Error(`${msg}: Expected ${expected} but got ${actual}`);
    }
  }
  assert(cond: boolean, msg: string) {
    if (!cond) throw new Error(msg);
  }
}

declare const require: undefined | { main?: unknown };
declare const module: unknown;
if (typeof require !== "undefined" && (require as { main?: unknown }).main === module) {
  (async () => {
    const c = new Checker();
    await runReadingObserverTests(c);
    const report = { passed: c.passed, failed: c.failed, failures: c.failures };
    console.log(`[reading-observer self-test] passed=${report.passed} failed=${report.failed}`);
    if (report.failed > 0) {
      console.error("Failures:\n - " + report.failures.join("\n - "));
      (globalThis as { process?: { exit(code: number): void } }).process?.exit(1);
    }
  })();
}
