import { GhostTextMeasurementObserver } from './GhostTextMeasurementObserver';
import { EventBus } from '../../core/event-bus/EventBus';
import { PlatformConfig } from '../selectors/interfaces';
import { SessionId } from '../../core/types/session.types';
import { GhostTextEvents, PromptEvents } from '../../core/event-bus/registry';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { GhostTextMeasurementComputedPayload } from '../../core/event-bus/contracts';

// Mock DOM environment for Node.js
if (typeof global !== 'undefined' && !global.document) {
  const mockNode = {
    tagName: 'TEXTAREA',
    value: '',
    isConnected: true,
    remove: function() { this.isConnected = false; },
    getAttribute: () => null,
    contains: () => true,
    closest: function() { return this; },
    dispatchEvent: () => true,
  };
  
  (global as any).document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => mockNode,
    getElementById: () => mockNode,
    body: {
      innerHTML: '',
      appendChild: () => {}
    }
  };
  
  (global as any).window = {
    location: { origin: 'http://test.local' }
  };
  
  (global as any).MutationObserver = class {
    private cb: any;
    constructor(cb: any) { this.cb = cb; }
    observe() {}
    disconnect() {}
    trigger() { this.cb(); }
  };
}

// Mock dependencies
const mockSessionId = 'test-session-123' as SessionId;
const mockConfig: PlatformConfig = {
  id: 'test',
  version: '1.0',
  urlPattern: /.*/,
  selectors: {
    promptInput: '#mock-input',
    submitButton: '#mock-submit',
    responseContainer: '#mock-container',
    responseBlock: '.mock-block',
    streamingIndicator: '.mock-streaming'
  }
};

class MockTestHarness {
  public bus = new EventBus({ report: () => {} });
  public observer: GhostTextMeasurementObserver;
  public inputNode: HTMLTextAreaElement;
  public measurements: GhostTextMeasurementComputedPayload[] = [];
  
  constructor() {
    this.observer = new GhostTextMeasurementObserver(this.bus, mockConfig, mockSessionId);
    
    // Set up fake DOM
    document.body.innerHTML = '<textarea id="mock-input"></textarea>';
    this.inputNode = document.getElementById('mock-input') as HTMLTextAreaElement;
    
    // Capture emitted measurements
    this.bus.subscribe(GhostTextEvents.MEASUREMENT_COMPUTED, (e) => {
      this.measurements.push(e.payload);
    });
  }

  public connect() {
    this.observer.connect();
  }

  public disconnect() {
    this.observer.disconnect();
  }
  
  public emitDismissed(interventionId: string, stem: string) {
    this.bus.publish(GhostTextEvents.DISMISSED, createDomainEvent(GhostTextEvents.DISMISSED, mockSessionId, 'test', {
      interventionId,
      stem,
      gapType: 'audience',
      reason: 'continued_typing'
    }));
  }
  
  public emitGenerated() {
    this.bus.publish(GhostTextEvents.GENERATED, createDomainEvent(GhostTextEvents.GENERATED, mockSessionId, 'test', {
      interventionId: 'new-id',
      gapType: 'audience',
      stem: 'new stem'
    }));
  }
  
  public emitPromptSent() {
    this.bus.publish(PromptEvents.SENT, createDomainEvent(PromptEvents.SENT, mockSessionId, 'test', {
      promptHash: 'hash',
      textLength: 10,
      wordCount: 2,
      wasEnriched: false
    }));
  }

  public simulateTyping(text: string) {
    this.inputNode.value = text;
    // Call handler directly since Node event dispatching is tricky with fake DOM
    (this.observer as any).handleInput({ target: this.inputNode });
  }

  public simulateAppend(text: string) {
    this.inputNode.value = this.inputNode.value + text;
    (this.observer as any).handleInput({ target: this.inputNode });
  }

  public simulateModification(newText: string) {
    this.inputNode.value = newText;
    (this.observer as any).handleInput({ target: this.inputNode });
  }
}

export function runGhostTextMeasurementObserverTests(c: any): void {
  // Test 1: Explicit dismissal with no subsequent typing -> hard timeout
  c.test('No typing yields unknown confidence and null features', async () => {
    const harness = new MockTestHarness();
    harness.connect();
    
    harness.inputNode.value = 'initial long prompt that should be the baseline';
    harness.emitDismissed('inv-1', 'suggested text');
    
    // Fast forward manually by emitting a new intervention which forces termination
    harness.emitGenerated(); 
    
    c.eq(harness.measurements.length, 1, 'Emitted measurement');
    const m = harness.measurements[0];
    c.eq(m.interventionId, 'inv-1', 'Correct intervention ID');
    c.eq(m.measurementCompletionReason, 'intervention_replaced', 'Terminated correctly');
    c.eq(m.confidence, 'unknown', 'Confidence is unknown due to lack of typing');
    c.eq(m.features.continuationLatencyMs, null, 'No latency');
    c.eq(m.features.lexicalOverlap, null, 'No overlap');
    
    harness.disconnect();
  });

  // Test 2: Continued typing (Delta Extraction)
  c.test('Continued typing computes distances on DELTA only and yields high confidence', async () => {
    const harness = new MockTestHarness();
    harness.connect();
    
    harness.inputNode.value = 'I think the primary audience is ';
    harness.emitDismissed('inv-2', 'technical decision makers');
    
    // They typed developers instead of technical decision makers
    harness.simulateAppend('developers.');
    
    // Force termination via prompt.sent
    harness.emitPromptSent();
    
    c.eq(harness.measurements.length, 1, 'Emitted measurement');
    const m = harness.measurements[0];
    c.eq(m.interventionId, 'inv-2', 'Correct intervention ID');
    c.eq(m.measurementCompletionReason, 'prompt_sent', 'Terminated via prompt_sent');
    c.eq(m.confidence, 'high', 'Confidence is high due to typing');
    c.assert(m.features.continuationLatencyMs! >= 0, 'Captured latency');
    c.eq(m.features.typedTextLength, 'developers.'.length, 'Typed text length is only the delta');
    
    // Normalization check: "technical decision makers" vs "developers"
    // "technical decision makers" -> 25 chars. "developers" -> 10 chars.
    // Normalized: "technical decision makers" vs "developers"
    // Edit distance should be the difference between these two small strings, not including baseline
    c.assert(m.features.editDistance! > 0 && m.features.editDistance! < 30, 'Edit distance is bounded by stem and delta');
    
    harness.disconnect();
  });

  // Test 3: Multiple rapid interventions
  c.test('Multiple interventions terminate previous windows without cross-contamination', async () => {
    const harness = new MockTestHarness();
    harness.connect();
    
    harness.inputNode.value = 'Baseline';
    harness.emitDismissed('inv-3a', 'first');
    harness.emitDismissed('inv-3b', 'second'); // Triggers termination of first
    
    c.eq(harness.measurements.length, 1, 'Terminated first measurement');
    c.eq(harness.measurements[0].interventionId, 'inv-3a', 'Attributed to first');
    c.eq(harness.measurements[0].measurementCompletionReason, 'intervention_replaced', 'Replaced reason');
    
    harness.simulateAppend(' typing for second');
    harness.emitPromptSent(); // Triggers termination of second
    
    c.eq(harness.measurements.length, 2, 'Terminated second measurement');
    c.eq(harness.measurements[1].interventionId, 'inv-3b', 'Attributed to second');
    c.eq(harness.measurements[1].measurementCompletionReason, 'prompt_sent', 'Sent reason');
    c.eq(harness.measurements[1].confidence, 'high', 'Confidence high for second');
    c.eq(harness.measurements[1].features.typedTextLength, ' typing for second'.length, 'Correct delta extracted for second');
    
    harness.disconnect();
  });

  // Test 4: DOM node removal
  c.test('DOM node removal yields low confidence', async () => {
    const harness = new MockTestHarness();
    harness.connect();
    
    harness.inputNode.value = 'Base';
    harness.emitDismissed('inv-4', 'stem');
    harness.simulateAppend('a');
    
    // Remove node
    harness.inputNode.remove();
    (harness.observer as any).mutationObserver.trigger();
    
    c.eq(harness.measurements.length, 1, 'Terminated by mutation observer');
    const m = harness.measurements[0];
    c.eq(m.measurementCompletionReason, 'node_removed', 'Reason is node_removed');
    c.eq(m.confidence, 'low', 'Confidence is low due to interruption');
    
    harness.disconnect();
  });
  
  // Test 5: Complex modification (replacement/deletion)
  c.test('Complex modification correctly extracts inner delta', async () => {
    const harness = new MockTestHarness();
    harness.connect();
    
    harness.inputNode.value = 'This is a long prompt. I want to replace this part. And keep this.';
    harness.emitDismissed('inv-5', 'replace this part');
    
    // User replaces "replace this part" with "change it"
    harness.simulateModification('This is a long prompt. I want to change it. And keep this.');
    
    harness.emitPromptSent();
    
    const m = harness.measurements[0];
    c.eq(m.features.typedTextLength, 8, 'Extracted only the replaced delta (LCP/LCS bounded)');
    
    harness.disconnect();
  });
  
  // Test 6: Normalization explicitly
  c.test('Normalization works on punctuation and whitespace', async () => {
    const harness = new MockTestHarness();
    harness.connect();
    
    harness.inputNode.value = '';
    harness.emitDismissed('inv-6', 'Hello   World!');
    
    // Type lowercase, with different spacing and no punctuation
    harness.simulateAppend('hello world');
    
    harness.emitPromptSent();
    
    const m = harness.measurements[0];
    c.eq(m.features.editDistance, 0, 'Edit distance is 0 after normalization');
    c.eq(m.features.lexicalOverlap, 1, 'Lexical overlap is 1 after normalization');
    
    harness.disconnect();
  });
}

// Auto-run when executed directly
class Checker {
  passed = 0;
  failed = 0;
  failures: string[] = [];
  test(name: string, fn: () => void | Promise<void>) {
    try {
      const p = fn();
      if (p instanceof Promise) {
         p.catch(e => {
            this.failed++;
            this.failures.push(`${name} threw async: ${e}`);
         });
      }
      this.passed++;
    } catch (e) {
      this.failed++;
      this.failures.push(`${name} threw: ${e}`);
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
  const c = new Checker();
  runGhostTextMeasurementObserverTests(c);
  // async tests aren't awaited by this simple checker correctly if they aren't queued, 
  // but for the sake of the quick test harness we'll wait a tick.
  setTimeout(() => {
      const report = { passed: c.passed, failed: c.failed, failures: c.failures };
      console.log(`[ghost-text-measurement-observer self-test] passed=${report.passed} failed=${report.failed}`);
      if (report.failed > 0) {
        console.error("Failures:\n - " + report.failures.join("\n - "));
        (globalThis as { process?: { exit(code: number): void } }).process?.exit(1);
      }
  }, 100);
}
