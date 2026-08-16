import { PlatformManager } from './PlatformManager';
import { EventBus } from '../../core/event-bus/EventBus';
import { ConsoleErrorReporter } from '../../core/error/ConsoleErrorReporter';
import { SessionEvents } from '../../core/event-bus/registry';
import { SessionId, toSessionId } from '../../core/types/session.types';

async function runTests() {
  console.log('[PlatformManager] Running implicit session selftests...');

  let testCount = 0;
  let failures = 0;

  function assert(condition: boolean, message: string) {
    testCount++;
    if (!condition) {
      console.error(`❌ TEST FAILED: ${message}`);
      failures++;
    } else {
      console.log(`✅ TEST PASSED: ${message}`);
    }
  }

  // Setup common mocks
  const originalLocation = global.window;
  const originalDocument = global.document;

  (global as any).MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  (global as any).ResizeObserver = class {
    observe() {}
    disconnect() {}
  };

  (global as any).window = {
    location: { href: 'https://chatgpt.com/' },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  (global as any).document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    visibilityState: 'visible',
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    head: { appendChild: () => {} },
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, innerHTML: '' }),
    body: { appendChild: () => {} }
  };

  try {
    // TEST 1: Supported platform initializes with no active session.
    console.log('\n--- TEST 1 & 4 & 5: Implicit session ---');
    const bus1 = new EventBus(new ConsoleErrorReporter());
    const manager1 = new PlatformManager(bus1);

    let startedCount1 = 0;
    let emittedSessionId: SessionId | null = null;

    bus1.subscribe(SessionEvents.STARTED, (evt) => {
      startedCount1++;
      emittedSessionId = evt.sessionId;
      assert(evt.source === 'platform-adapter', 'Source should be platform-adapter');
      assert(evt.payload.platform === 'chatgpt', 'Platform should be correctly identified');
    });

    manager1.prepareAdapter('https://chatgpt.com/');
    manager1.beginObservation(); // Implicit creation

    assert(startedCount1 === 1, 'Exactly one session.started event should be emitted');
    assert(emittedSessionId !== null, 'Valid SessionId should be created');

    manager1.endObservation();

    // TEST 2 & 7: Supported platform initializes with an existing active session.
    console.log('\n--- TEST 2 & 7: Existing active session ---');
    const bus2 = new EventBus(new ConsoleErrorReporter());
    const manager2 = new PlatformManager(bus2);

    let startedCount2 = 0;
    bus2.subscribe(SessionEvents.STARTED, () => startedCount2++);

    manager2.prepareAdapter('https://chatgpt.com/');
    const existingId = toSessionId('explicit-session-123');
    manager2.beginObservation(existingId); // Explicit initialization

    assert(startedCount2 === 0, 'No session.started should be emitted when an explicit ID is passed');

    // TEST 3 & 10: Platform initialization is invoked repeatedly.
    console.log('\n--- TEST 3 & 10: Repeated initialization ---');
    const bus3 = new EventBus(new ConsoleErrorReporter());
    const manager3 = new PlatformManager(bus3);

    let startedCount3 = 0;
    bus3.subscribe(SessionEvents.STARTED, () => startedCount3++);

    manager3.prepareAdapter('https://chatgpt.com/');
    manager3.beginObservation(); // First implicit
    manager3.beginObservation(); // Second attempt

    assert(startedCount3 === 1, 'Repeated beginObservation should not emit multiple sessions');

    // TEST: Reentrancy guard (reproduces production bug path)
    console.log('\n--- TEST: Reentrancy guard ---');
    const busReentrant = new EventBus(new ConsoleErrorReporter());
    const managerReentrant = new PlatformManager(busReentrant);
    managerReentrant.prepareAdapter('https://chatgpt.com/');

    let reentrantStartedEvents = 0;
    let reentrantAdapterStarts = 0;

    const adapter = (managerReentrant as any).activeAdapter;
    const originalStart = adapter.start.bind(adapter);
    adapter.start = (sessionId: any) => {
      reentrantAdapterStarts++;
      originalStart(sessionId);
    };

    busReentrant.subscribe(SessionEvents.STARTED, (evt) => {
      reentrantStartedEvents++;
      // This is exactly what content-script.ts does
      managerReentrant.beginObservation(evt.sessionId);
    });

    managerReentrant.beginObservation();

    assert(reentrantStartedEvents === 1, 'Exactly one session.started event should be emitted despite recursion');
    assert(reentrantAdapterStarts === 1, 'Adapter should be started exactly once');
    managerReentrant.endObservation();

    // TEST 6: Session termination follows implicit creation.
    console.log('\n--- TEST 6: Session termination ---');
    const bus6 = new EventBus(new ConsoleErrorReporter());
    const manager6 = new PlatformManager(bus6);

    let endedId: SessionId | null = null;
    bus6.subscribe(SessionEvents.ENDED, (evt) => {
      endedId = evt.sessionId;
    });

    manager6.prepareAdapter('https://chatgpt.com/');
    manager6.beginObservation();

    // Simulate beforeunload to trigger ENDED
    (manager6 as any).onBeforeUnload();

    assert(endedId !== null, 'session.ended should be emitted');

  } finally {
    global.window = originalLocation;
    global.document = originalDocument;
  }

  console.log(`\nResults: ${testCount - failures}/${testCount} passed.`);
  if (failures > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
