import { PlatformAdapter } from '../interfaces/PlatformAdapter';
import { GapDetectionEngine } from '../../engines/gap/GapDetectionEngine';

/**
 * ChatGPT Platform Adapter
 *
 * Binds to the ChatGPT DOM to extract prompt text.
 * Strictly isolating DOM APIs from pure business logic.
 */
export class ChatGPTAdapter implements PlatformAdapter {
  private readonly gapEngine: GapDetectionEngine;
  private observer: MutationObserver | null = null;
  private inputElement: HTMLElement | null = null;
  private listener: EventListener | null = null;

  constructor(gapEngine: GapDetectionEngine) {
    this.gapEngine = gapEngine;
  }

  public start(): void {
    // 1. Find the prompt textarea (simplified selector for stub)
    this.inputElement = document.querySelector('#prompt-textarea') as HTMLElement;
    
    if (!this.inputElement) {
      console.warn('[ChatGPTAdapter] Input element not found.');
      return;
    }

    // 2. Bind event listener for synchronous analysis
    this.listener = (e: Event) => {
      const text = (e.target as HTMLTextAreaElement).value || '';
      // Pass transient text directly to the engine in-memory
      this.gapEngine.analyze(text);
    };

    this.inputElement.addEventListener('input', this.listener);

    // 3. Set up MutationObserver if we needed to watch for DOM structural changes
    // (e.g. if the textarea is destroyed and recreated)
    this.observer = new MutationObserver((mutations) => {
      // Stub: re-bind if necessary
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    
    console.log('[ChatGPTAdapter] Started observing ChatGPT.');
  }

  public stop(): void {
    if (this.inputElement && this.listener) {
      this.inputElement.removeEventListener('input', this.listener);
    }
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.inputElement = null;
    this.listener = null;
    this.observer = null;
    console.log('[ChatGPTAdapter] Stopped observing ChatGPT.');
  }
}
