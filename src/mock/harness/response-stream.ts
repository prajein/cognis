import { JSDOM } from 'jsdom';

const rafQueue: Function[] = [];

/**
 * Sets up a deterministic JSDOM environment for tests.
 * Overrides requestAnimationFrame so we can manually flush the queue,
 * removing any reliance on arbitrary setTimeouts.
 */
export function setupDeterministicDOM(url = 'https://localhost/', html = '<!DOCTYPE html><html><body><main id="chat-container"></main></body></html>'): JSDOM {
  const dom = new JSDOM(html, {
    url,
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  
  global.window = dom.window as any;
  global.document = dom.window.document;
  global.MutationObserver = dom.window.MutationObserver;
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;
  global.Node = dom.window.Node;
  global.AbortController = dom.window.AbortController as any;
  global.AbortSignal = dom.window.AbortSignal as any;
  
  // Intercept RAF
  rafQueue.length = 0;
  global.requestAnimationFrame = ((cb: any) => {
    rafQueue.push(cb);
    return rafQueue.length;
  }) as any;
  
  global.cancelAnimationFrame = (id: number) => {
    // Basic mock, not strictly needed for flushing but good for completeness
  };

  return dom;
}

/**
 * Deterministically flushes all pending DOM observations.
 * 1. Awaits microtasks (MutationObserver callbacks fire).
 * 2. Flushes the synchronous requestAnimationFrame queue.
 * This guarantees the ResponseObserver has processed all DOM changes.
 */
export async function flushDOM(): Promise<void> {
  // Let MutationObserver microtasks fire
  await Promise.resolve();
  
  // Flush all RAF callbacks that the observers scheduled
  while (rafQueue.length > 0) {
    const queue = [...rafQueue];
    rafQueue.length = 0; // Clear so new RAFs go into next batch
    for (const cb of queue) {
      cb(Date.now());
    }
    // If a RAF scheduled a microtask, we need to wait for it before next RAF batch
    await Promise.resolve();
  }
}

/**
 * Deterministically simulates typing text into an element.
 */
export async function simulateTyping(element: Element, text: string): Promise<void> {
  element.textContent = text;
  // Trigger input events if necessary, though SubmitInterceptor relies on the final state and a submit event.
  element.dispatchEvent(new (window as any).Event('input', { bubbles: true }));
  await flushDOM();
}

/**
 * Streams text deterministically into a text container, flushing the DOM after each chunk.
 * The streaming node must be provided.
 */
export async function simulateDOMStream(
  textContainer: Element, 
  fullText: string, 
  chunkSize: number = 10
): Promise<void> {
  let currentText = '';
  
  for (let i = 0; i < fullText.length; i += chunkSize) {
    const chunk = fullText.substring(i, Math.min(i + chunkSize, fullText.length));
    currentText += chunk;
    textContainer.textContent = currentText;
    await flushDOM();
  }
}
