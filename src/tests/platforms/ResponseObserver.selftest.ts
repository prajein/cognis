import { JSDOM } from 'jsdom';
import { EventBus } from '../../core/event-bus/EventBus';
import { PromptEvents, ResponseEvents } from '../../core/event-bus/registry';
import { ResponseObserver } from '../../platforms/observers/ResponseObserver';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { PlatformConfig } from '../../platforms/selectors/interfaces';

async function runTests() {
  console.log('=== ResponseObserver Correlation Invariant Tests ===');

  let failed = 0;
  let passed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Setup generic test environment
  const config: PlatformConfig = {
    id: 'test-platform',
    version: '1.0',
    urlPattern: /.*/,
    selectors: {
      promptInput: 'textarea',
      submitButton: 'button',
      responseContainer: '.response-container',
      responseBlock: '.response',
      streamingIndicator: '.streaming',
    }
  };

  const createTestEnv = () => {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="response-container"></div>
        </body>
      </html>
    `);
    
    // Polyfill global document and window for the observer
    (global as any).document = dom.window.document;
    (global as any).window = dom.window;
    (global as any).MutationObserver = dom.window.MutationObserver;
    (global as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0);
    (global as any).cancelAnimationFrame = (id: number) => clearTimeout(id);

    const eventBus = new EventBus({ report: console.error } as any);
    const observer = new ResponseObserver(eventBus, config, 'session-123' as any);
    
    const container = document.querySelector('.response-container')!;
    
    // Store published response events
    const startedEvents: any[] = [];
    const completedEvents: any[] = [];
    eventBus.subscribe(ResponseEvents.STARTED, (e) => startedEvents.push(e));
    eventBus.subscribe(ResponseEvents.COMPLETED, (e) => completedEvents.push(e));
    
    observer.connect();

    return { dom, container, eventBus, observer, startedEvents, completedEvents };
  };

  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

  // --- Test 1: A starts -> B submitted -> A completes -> A ---
  try {
    console.log('\nTest 1: Prompt overlap (A starts -> B submitted -> A completes)');
    const { container, eventBus, observer, startedEvents, completedEvents } = createTestEnv();
    
    // 1. Submit Prompt A
    eventBus.publish(PromptEvents.SENT, createDomainEvent(PromptEvents.SENT, 'session-123' as any, 'test', { promptHash: 'hash-A', textLength: 10, wordCount: 2, wasEnriched: false }, { idFactory: () => 'eventId-A' as any }));
    
    // 2. Response A starts (New node)
    const nodeA = document.createElement('div');
    nodeA.className = 'response';
    nodeA.textContent = 'Chunk 1 ';
    container.appendChild(nodeA);
    
    // Let MutationObserver trigger
    await wait(50);
    
    // 3. Submit Prompt B (while A is streaming)
    eventBus.publish(PromptEvents.SENT, createDomainEvent(PromptEvents.SENT, 'session-123' as any, 'test', { promptHash: 'hash-B', textLength: 10, wordCount: 2, wasEnriched: false }, { idFactory: () => 'eventId-B' as any }));
    
    // 4. Response A completes (Wait debounce)
    await wait(1100);
    
    assert(startedEvents.length === 1, 'One started event emitted');
    assert(startedEvents[0]?.payload?.promptEventId === 'eventId-A', 'Started event bound to Prompt A despite Prompt B being sent');
    
    observer.destroy();
  } catch(e) {
    console.error(e);
    failed++;
  }

  // --- Test 2: Sequential generations (A completes -> B starts -> B) ---
  try {
    console.log('\nTest 2: Sequential generations');
    const { container, eventBus, observer, startedEvents, completedEvents } = createTestEnv();
    
    // Prompt A
    eventBus.publish(PromptEvents.SENT, createDomainEvent(PromptEvents.SENT, 'session-123' as any, 'test', { promptHash: 'hash-A', textLength: 1, wordCount: 1, wasEnriched: false }, { idFactory: () => 'eventId-A' as any }));
    
    // Response A
    const nodeA = document.createElement('div');
    nodeA.className = 'response';
    nodeA.textContent = 'Response A';
    container.appendChild(nodeA);
    await wait(1100);
    
    // Prompt B
    eventBus.publish(PromptEvents.SENT, createDomainEvent(PromptEvents.SENT, 'session-123' as any, 'test', { promptHash: 'hash-B', textLength: 1, wordCount: 1, wasEnriched: false }, { idFactory: () => 'eventId-B' as any }));
    
    // Response B
    const nodeB = document.createElement('div');
    nodeB.className = 'response';
    nodeB.textContent = 'Response B';
    container.appendChild(nodeB);
    await wait(1100);
    
    assert(startedEvents.length === 2, 'Two started events emitted');
    assert(startedEvents[0]?.payload?.promptEventId === 'eventId-A', 'First started bound to Prompt A');
    assert(startedEvents[1]?.payload?.promptEventId === 'eventId-B', 'Second started bound to Prompt B');
    
    observer.destroy();
  } catch(e) {
    console.error(e);
    failed++;
  }

  // --- Test 3: DOM replacement within one generation ---
  try {
    console.log('\nTest 3: DOM replacement within one generation');
    const { container, eventBus, observer, startedEvents, completedEvents } = createTestEnv();
    
    // Prompt A
    eventBus.publish(PromptEvents.SENT, createDomainEvent(PromptEvents.SENT, 'session-123' as any, 'test', { promptHash: 'hash-A', textLength: 1, wordCount: 1, wasEnriched: false }, { idFactory: () => 'eventId-A' as any }));
    
    // Response A Starts
    const nodeA = document.createElement('div');
    nodeA.className = 'response';
    nodeA.textContent = 'Streaming...';
    
    // Add streaming indicator
    const indicator = document.createElement('div');
    indicator.className = 'streaming';
    nodeA.appendChild(indicator);
    container.appendChild(nodeA);
    await wait(50);
    
    // Prompt B is sent while streaming
    eventBus.publish(PromptEvents.SENT, createDomainEvent(PromptEvents.SENT, 'session-123' as any, 'test', { promptHash: 'hash-B', textLength: 1, wordCount: 1, wasEnriched: false }, { idFactory: () => 'eventId-B' as any }));
    
    // DOM Replacement (e.g. Claude swaps the node)
    // We add a new node that replaces the old one. Wait, in generic observer, replacement means node changed but we are still generating.
    const newNodeA = document.createElement('div');
    newNodeA.className = 'response';
    newNodeA.textContent = 'Streaming... Final text.';
    // Remove old node and indicator
    container.removeChild(nodeA);
    // Add new node (without streaming indicator, which triggers debounce completion)
    container.appendChild(newNodeA);
    
    await wait(1100);
    
    // Wait, the generic ResponseObserver logic says if `!isPlaceholderSwap` it starts a new generation. 
    // In generic observer: `this.currentResponseNode !== latestNode` triggers `isPlaceholderSwap` logic.
    // If it's not a placeholder swap, it emits completion for the old node, and starts a new generation!
    
    // BUT we need to check if the new STARTED event correctly maintained the identity A.
    // Actually, if it started a new generation because of node replacement, does it keep A?
    // Wait, if it starts a new generation, it calls `this.activePromptEventId = this.pendingPromptEventId;`
    // But since pendingPromptEventId was overwritten to B, it will pick up B!
    assert(startedEvents.length >= 1, 'Started event emitted');
    const lastStarted = startedEvents[startedEvents.length - 1];
    console.log('lastStarted promptEventId:', lastStarted?.payload?.promptEventId, 'startedEvents.length:', startedEvents.length);
    assert(lastStarted?.payload?.promptEventId === 'eventId-A', 'Started event remains correlated to A after DOM replacement');
    
    observer.destroy();
  } catch(e) {
    console.error(e);
    failed++;
  }

  // --- Test 4: No identifiable prompt ---
  try {
    console.log('\nTest 4: No identifiable prompt');
    const { container, observer, startedEvents, completedEvents } = createTestEnv();
    
    // No Prompt sent
    
    // Response generation starts
    const node = document.createElement('div');
    node.className = 'response';
    node.textContent = 'Unprompted generation';
    container.appendChild(node);
    await wait(1100);
    
    assert(startedEvents.length === 1, 'One started event emitted');
    assert(startedEvents[0]?.payload?.promptEventId === undefined, 'Correlation is explicitly unknown/undefined');
    
    observer.destroy();
  } catch(e) {
    console.error(e);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
