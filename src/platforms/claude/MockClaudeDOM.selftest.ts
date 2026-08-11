import { JSDOM } from 'jsdom';
import { EventBus } from '../../core/event-bus/EventBus';
import { PlatformConfig } from '../selectors/interfaces';
import { ResponseSnapshot, translateResponseSnapshot } from '../translators/ResponseTranslator';
import { SessionId } from '../../core/types/session.types';

const dom = new JSDOM('<!DOCTYPE html><html><body><main id="chat-container"></main></body></html>', {
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
global.window = dom.window as any;
global.document = dom.window.document;
global.MutationObserver = dom.window.MutationObserver;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16) as any;

const config: PlatformConfig = {
  id: 'claude',
  version: 'v1',
  urlPattern: /.*/,
  selectors: {
    responseContainer: 'main',
    responseBlock: '.font-claude-message',
    streamingIndicator: '[data-is-streaming="true"]',
    promptInput: '.prose',
    submitButton: 'button'
  }
};

class ClaudeResponseObserver {
  private activeContainer: HTMLElement | null = null;
  private cursor = { textLength: 0, lastText: '' };
  private isGenerating = false;
  private startTime = 0;
  private rafId: number | null = null;
  private mutationObserver: MutationObserver | null = null;
  private hasPendingMutations = false;
  private isDestroyed = false;

  constructor(
    private readonly eventBus: EventBus,
    private readonly config: PlatformConfig,
    private readonly sessionId: SessionId
  ) {}

  public connect(): boolean {
    const container = document.querySelector(this.config.selectors.responseContainer);
    if (!container) return false;

    this.mutationObserver = new MutationObserver((mutations) => {
      this.hasPendingMutations = true;
      if (this.rafId === null) {
        this.rafId = requestAnimationFrame(() => this.processDOM());
      }
    });

    this.mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-is-streaming']
    });
    return true;
  }

  public destroy(): void {
    if (this.mutationObserver) this.mutationObserver.disconnect();
    this.isDestroyed = true;
  }

  private processDOM(): void {
    this.rafId = null;
    if (this.isDestroyed || !this.hasPendingMutations) return;
    this.hasPendingMutations = false;

    const responseNodes = document.querySelectorAll(this.config.selectors.responseBlock);
    if (responseNodes.length === 0) return;

    const latestNode = responseNodes[responseNodes.length - 1];
    
    // The stable identity is the parent row container.
    // If the container is completely disconnected from the DOM, it's a generation boundary.
    const currentContainer = latestNode.closest('.group\\/message-row') as HTMLElement | null;
    if (!currentContainer || !currentContainer.isConnected) return;

    const isStreaming = latestNode.getAttribute('data-is-streaming') === 'true';
    const currentText = latestNode.textContent || '';

    // New generation detection
    if (this.activeContainer !== currentContainer) {
      if (this.activeContainer && this.isGenerating) {
        this.emitCompletion();
      }

      this.activeContainer = currentContainer;
      this.cursor = { textLength: 0, lastText: '' };
      this.isGenerating = true;
      this.startTime = Date.now();

      this.publish({
        sessionId: this.sessionId,
        promptHash: 'unattributed_hash',
        promptEventId: 'mock-123',
        wasEnriched: false,
        isStarting: true,
        deltaText: null,
        isCompleted: false,
        chunkLength: 0,
        totalLength: 0,
        durationMs: 0
      });
    }

    // Process deltas: compute content-based delta where possible.
    // If content is non-prefix (e.g. non-monotonic render rewrite), emit null delta.
    if (currentText.length !== this.cursor.textLength && this.isGenerating) {
      let deltaText: string | null = null;
      if (currentText.length > this.cursor.textLength && currentText.startsWith(this.cursor.lastText)) {
        deltaText = currentText.substring(this.cursor.textLength);
      }

      // Even if deltaText is null, we emit the chunk to reflect the new totalLength/content state,
      // but without fabricating a string delta.
      this.publish({
        sessionId: this.sessionId,
        promptHash: 'unattributed_hash',
        promptEventId: 'mock-123',
        wasEnriched: false,
        isStarting: false,
        deltaText: deltaText,
        isCompleted: false,
        chunkLength: deltaText ? deltaText.length : 0,
        totalLength: currentText.length,
        durationMs: 0
      });
      this.cursor = { textLength: currentText.length, lastText: currentText };
    }

    // Streaming completion via explicit attribute
    if (!isStreaming && this.isGenerating) {
      this.emitCompletion();
    }
  }

  private emitCompletion(): void {
    if (!this.isGenerating) return;
    this.isGenerating = false;
    
    const currentText = document.querySelectorAll(this.config.selectors.responseBlock);
    const text = currentText.length > 0 ? currentText[currentText.length - 1].textContent || '' : '';

    this.publish({
      sessionId: this.sessionId,
      promptHash: 'unattributed_hash',
      promptEventId: 'mock-123',
      wasEnriched: false,
      isStarting: false,
      deltaText: null,
      isCompleted: true,
      chunkLength: 0,
      totalLength: text.length,
      durationMs: Date.now() - this.startTime
    });
  }

  private publish(snapshot: ResponseSnapshot): void {
    const events = translateResponseSnapshot(snapshot);
    events.forEach(e => this.eventBus.publish(e.type, e as any));
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFixture() {
  console.log('--- Starting Mock Claude DOM Fixture ---');
  
  const eventBus = new EventBus({ reportError: console.error } as any);
  // Use our prototype custom observer
  const observer = new ClaudeResponseObserver(eventBus, config, 'session-123' as any);
  
  const events: any[] = [];
  eventBus.subscribe('response.started', (e) => events.push(e));
  eventBus.subscribe('response.chunk', (e) => events.push(e));
  eventBus.subscribe('response.completed', (e) => events.push(e));
  
  observer.connect();
  
  const main = document.getElementById('chat-container')!;
  
  // 1. Generation starts: Claude adds a message row container
  const messageRow = document.createElement('div');
  messageRow.className = 'group group/message-row';
  main.appendChild(messageRow);
  
  // Inside the row, it adds a block with data-is-streaming="true"
  const responseBlock = document.createElement('div');
  responseBlock.className = 'font-claude-message';
  responseBlock.setAttribute('data-is-streaming', 'true');
  messageRow.appendChild(responseBlock);
  
  await sleep(50);
  
  // 2. Spans are incrementally added
  const span1 = document.createElement('span');
  span1.textContent = 'This is the first part of the response.';
  responseBlock.appendChild(span1);
  
  await sleep(50);
  
  const span2 = document.createElement('span');
  span2.textContent = ' And this is the second part.';
  responseBlock.appendChild(span2);
  
  await sleep(50);
  
  // 3. Streaming block is COMPLETELY removed and replaced (The critical Claude behavior)
  messageRow.removeChild(responseBlock);
  
  const finalBlock = document.createElement('div');
  finalBlock.className = 'font-claude-message';
  finalBlock.setAttribute('data-is-streaming', 'false'); // Streaming ends!
  // It has the fully rendered markdown
  finalBlock.innerHTML = '<p>This is the first part of the response. And this is the second part.</p><p>Here is some more final text.</p>';
  messageRow.appendChild(finalBlock);
  
  // 4. Wait to ensure everything settled
  await sleep(200);

  console.log('\\n--- Test 2: Genuinely subsequent assistant response (NEW generation) ---');
  const messageRow2 = document.createElement('div');
  messageRow2.className = 'group group/message-row';
  main.appendChild(messageRow2);

  const responseBlock2 = document.createElement('div');
  responseBlock2.className = 'font-claude-message';
  responseBlock2.setAttribute('data-is-streaming', 'true');
  messageRow2.appendChild(responseBlock2);
  
  await sleep(50);
  
  const span3 = document.createElement('span');
  span3.textContent = 'This is turn two.';
  responseBlock2.appendChild(span3);

  await sleep(50);
  responseBlock2.setAttribute('data-is-streaming', 'false');

  await sleep(200);

  console.log('\\n--- Test 3: Repeated block replacement during stream ---');
  const messageRow3 = document.createElement('div');
  messageRow3.className = 'group group/message-row';
  main.appendChild(messageRow3);

  let rb3 = document.createElement('div');
  rb3.className = 'font-claude-message';
  rb3.setAttribute('data-is-streaming', 'true');
  rb3.textContent = 'Replacement 1';
  messageRow3.appendChild(rb3);
  await sleep(50);

  messageRow3.removeChild(rb3);
  rb3 = document.createElement('div');
  rb3.className = 'font-claude-message';
  rb3.setAttribute('data-is-streaming', 'true');
  rb3.textContent = 'Replacement 1 and 2';
  messageRow3.appendChild(rb3);
  await sleep(50);
  rb3.setAttribute('data-is-streaming', 'false');
  await sleep(200);

  console.log('\\n--- Test 4: Non-prefix rewrite (shrinking/rewriting text) ---');
  const messageRow4 = document.createElement('div');
  messageRow4.className = 'group group/message-row';
  main.appendChild(messageRow4);

  const rb4 = document.createElement('div');
  rb4.className = 'font-claude-message';
  rb4.setAttribute('data-is-streaming', 'true');
  rb4.textContent = 'Some temporary text';
  messageRow4.appendChild(rb4);
  await sleep(50);

  rb4.textContent = 'Completely different text replacing the old';
  await sleep(50);
  rb4.setAttribute('data-is-streaming', 'false');
  await sleep(200);

  console.log('\\n--- Test 5: Ancestor replacement (forced generation boundary) ---');
  let messageRow5 = document.createElement('div');
  messageRow5.className = 'group group/message-row';
  main.appendChild(messageRow5);
  
  const rb5 = document.createElement('div');
  rb5.className = 'font-claude-message';
  rb5.setAttribute('data-is-streaming', 'true');
  rb5.textContent = 'Start of gen 5';
  messageRow5.appendChild(rb5);
  await sleep(50);

  // Entire ancestor is ripped out and a new one put in its place
  main.removeChild(messageRow5);
  messageRow5 = document.createElement('div');
  messageRow5.className = 'group group/message-row';
  main.appendChild(messageRow5);

  const rb5new = document.createElement('div');
  rb5new.className = 'font-claude-message';
  rb5new.setAttribute('data-is-streaming', 'false');
  rb5new.textContent = 'End of gen 5 (actually a new generation due to ancestor swap)';
  messageRow5.appendChild(rb5new);
  await sleep(200);

  
  // Print results
  const started = events.filter(e => e.type === 'response.started');
  const completed = events.filter(e => e.type === 'response.completed');
  
  console.log(`\\nSTARTED events: ${started.length}`);
  console.log(`COMPLETED events: ${completed.length}`);
  console.log(events.map(e => {
    let suffix = '';
    if (e.payload.isCompleted) {
      suffix = ' | Final len: ' + e.payload.totalLength;
    } else if (e.type === 'response.chunk') {
      const chunkText = e.payload.chunkText;
      suffix = ` | deltaText: ${chunkText === undefined ? 'null' : '"' + chunkText + '"'} | totalLen: ${e.payload.totalLength}`;
    }
    return `${e.type}${suffix}`;
  }).join('\\n'));
  
  observer.destroy();
}

runFixture().catch(console.error);
