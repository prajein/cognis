import { EventBus } from '../../core/event-bus/EventBus';
import { ConsoleErrorReporter } from '../../core/error/ConsoleErrorReporter';
import { EventTraceValidator } from '../../engines/diagnostics/EventTraceValidator';
import { SessionEvents, PromptEvents, ResponseEvents } from '../../core/event-bus/registry';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { toSessionId } from '../../core/types/session.types';
import { SubmitInterceptor } from '../../platforms/observers/SubmitInterceptor';

export async function runHardeningTests(): Promise<void> {
  console.log('[SelfTest] Running Hardening (Phase 2) tests...');

  const errorReporter = new ConsoleErrorReporter();
  const eventBus = new EventBus(errorReporter);
  const validator = new EventTraceValidator(eventBus);

  const sessionId = toSessionId('test-session-123');
  let testFailed = false;

  // Hack: Monkey-patch console.error to intercept validator throws
  const originalError = console.error;
  let validationErrors: string[] = [];
  let suppressValidationLogs = false;

  console.error = (...args: any[]) => {
    const isValidationError = args[0] && typeof args[0] === 'string' &&
      (args[0].includes('Violation:') || args[0].includes('Trigger Event:') || args[0].includes('Recent Event Trace:') || args[0].includes('ARCHITECTURAL VIOLATION'));

    if (isValidationError) {
       validationErrors.push(args.join(' '));
       if (!suppressValidationLogs) {
         originalError(...args);
       }
    } else {
       originalError(...args);
    }
  };

  try {
    validator.start();

    // ---------------------------------------------------------
    // 1. Valid FSM Transitions
    // ---------------------------------------------------------
    eventBus.publish(SessionEvents.STARTED, createDomainEvent(SessionEvents.STARTED, sessionId, 'test', { platform: 'test' }));
    eventBus.publish(PromptEvents.TYPED, createDomainEvent(PromptEvents.TYPED, sessionId, 'test', { textLength: 10, wordCount: 2, currentTextHash: 'hash1', revisionDepth: 0 }));
    eventBus.publish(PromptEvents.SENT, createDomainEvent(PromptEvents.SENT, sessionId, 'test', { promptHash: 'hash1', textLength: 10, wordCount: 2, wasEnriched: false }));
    eventBus.publish(ResponseEvents.STARTED, createDomainEvent(ResponseEvents.STARTED, sessionId, 'test', { promptHash: 'hash1' }));
    eventBus.publish(ResponseEvents.CHUNK, createDomainEvent(ResponseEvents.CHUNK, sessionId, 'test', { chunkLength: 5, totalLength: 5 }));
    eventBus.publish(ResponseEvents.COMPLETED, createDomainEvent(ResponseEvents.COMPLETED, sessionId, 'test', { responseLength: 5, durationMs: 100 }));
    eventBus.publish(SessionEvents.ENDED, createDomainEvent(SessionEvents.ENDED, sessionId, 'test', { reason: 'explicit' }));

    if (validationErrors.length > 0) {
      throw new Error('Valid transition sequence failed. Errors: ' + validationErrors.join(' | '));
    }
    console.log('[SelfTest] ✓ accepts valid Session -> Prompt -> Response -> End lifecycle');

    // ---------------------------------------------------------
    // 2. Invalid FSM Transition (Chunk before Started)
    // ---------------------------------------------------------
    validationErrors = [];
    suppressValidationLogs = true;
    eventBus.publish(SessionEvents.STARTED, createDomainEvent(SessionEvents.STARTED, sessionId, 'test', { platform: 'test' }));
    eventBus.publish(ResponseEvents.CHUNK, createDomainEvent(ResponseEvents.CHUNK, sessionId, 'test', { chunkLength: 5, totalLength: 5 }));
    suppressValidationLogs = false;

    if (validationErrors.length === 0) {
      throw new Error('Validator failed to catch invalid chunk event.');
    }
    console.log('[SelfTest] ✓ rejects SessionStarted -> response.chunk');

    // ---------------------------------------------------------
    // 3. Invalid FSM Transition (Prompt.sent during Streaming)
    // ---------------------------------------------------------
    validationErrors = [];
    suppressValidationLogs = true;
    // We are currently in SessionStarted (due to the last valid reset or the rejected chunk).
    // Let's explicitly move to Streaming:
    eventBus.publish(ResponseEvents.STARTED, createDomainEvent(ResponseEvents.STARTED, sessionId, 'test', { promptHash: 'hash1' }));
    eventBus.publish(PromptEvents.SENT, createDomainEvent(PromptEvents.SENT, sessionId, 'test', { promptHash: 'hash1', textLength: 10, wordCount: 2, wasEnriched: false }));
    suppressValidationLogs = false;

    if (validationErrors.length === 0) {
      throw new Error('Validator failed to catch invalid prompt.sent event during streaming.');
    }
    console.log('[SelfTest] ✓ rejects Streaming -> prompt.sent');

    // Clean up to a safe state (Idle)
    eventBus.publish(ResponseEvents.COMPLETED, createDomainEvent(ResponseEvents.COMPLETED, sessionId, 'test', { responseLength: 5, durationMs: 100 }));
    eventBus.publish(SessionEvents.ENDED, createDomainEvent(SessionEvents.ENDED, sessionId, 'test', { reason: 'explicit' }));

    // ---------------------------------------------------------
    // 4. SubmitInterceptor Duplicate Suppression
    // ---------------------------------------------------------
    // Prepare FSM by starting a session so prompt.sent is valid
    eventBus.publish(SessionEvents.STARTED, createDomainEvent(SessionEvents.STARTED, sessionId, 'test', { platform: 'test' }));
    // We expect NO validation errors from here on out
    validationErrors = [];
    let promptSentCounter = { value: 0 };
    eventBus.subscribe(PromptEvents.SENT, () => { promptSentCounter.value++; });

    // Mock minimal DOM
    const listeners: Record<string, Function[]> = { keydown: [], click: [] };
    const mockInputNode = {
      value: 'test',
      addEventListener: (evt: string, cb: Function) => {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(cb);
      },
      click: () => {}
    };
    const originalDocument = (globalThis as any).document;
    const originalNode = (globalThis as any).Node;

    (globalThis as any).Node = { TEXT_NODE: 3 };
    (globalThis as any).document = {
      querySelector: () => mockInputNode,
      addEventListener: (evt: string, cb: Function) => {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(cb);
      }
    };

    const mockSelectors = {
      promptInput: '#input',
      submitButton: '#submit',
      responseContainer: '#container',
      responseBlock: '.block',
      streamingIndicator: '.stream'
    };

    const observer = new SubmitInterceptor(eventBus, { id: 'test', version: '1', selectors: mockSelectors, urlPattern: /.*/ }, sessionId);

    observer.connect();

    // 1. Simulate Enter key
    listeners.keydown.forEach(cb => cb({ target: { closest: () => true }, key: 'Enter', shiftKey: false, stopImmediatePropagation: () => {}, preventDefault: () => {} }));
    // 2. Simulate Submit click immediately
    listeners.click.forEach(cb => cb({ target: { closest: () => true }, stopImmediatePropagation: () => {}, preventDefault: () => {} }));

    await new Promise(r => setTimeout(r, 100));

    if ((promptSentCounter as any).value !== 1) {
      throw new Error(`Duplicate suppression failed. Expected 1 prompt.sent, got ${promptSentCounter.value}`);
    }
    console.log('[SelfTest] ✓ suppresses duplicate prompt.sent emission');

    // 3. Reset via lifecycle event
    eventBus.publish(ResponseEvents.STARTED, createDomainEvent(ResponseEvents.STARTED, sessionId, 'test', { promptHash: 'hash1' }));
    eventBus.publish(ResponseEvents.COMPLETED, createDomainEvent(ResponseEvents.COMPLETED, sessionId, 'test', { responseLength: 5, durationMs: 100 }));

    // 4. Simulate another Enter after debounce
    listeners.keydown.forEach(cb => cb({ target: { closest: () => true }, key: 'Enter', shiftKey: false, stopImmediatePropagation: () => {}, preventDefault: () => {} }));

    await new Promise(r => setTimeout(r, 100));

    if ((promptSentCounter as any).value !== 2) {
      throw new Error(`Lifecycle reset failed. Expected 2 prompt.sent, got ${promptSentCounter.value}`);
    }
    console.log('[SelfTest] ✓ resets submission state automatically');

    observer.destroy();
    (globalThis as any).document = originalDocument;
    (globalThis as any).Node = originalNode;

    console.log('[SelfTest] ✔ Hardening Tests Passed.');
  } catch (error) {
    console.error('[SelfTest] ✘ Hardening Tests Failed:', error);
    testFailed = true;
  } finally {
    console.error = originalError;
    validator.stop();
  }

  if (testFailed) {
    throw new Error('Hardening tests failed.');
  }
}

// Execute the tests if this file is run directly
declare var require: any;
declare var module: any;
if (typeof require !== 'undefined' && require.main === module) {
  runHardeningTests().catch((err: any) => {
    console.error(err);
    process.exit(1);
  });
}
