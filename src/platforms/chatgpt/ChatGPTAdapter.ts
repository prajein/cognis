import { PlatformAdapter } from '../interfaces/PlatformAdapter';
import { GapDetectionEngine } from '../../engines/gap/GapDetectionEngine';
import { EnrichmentEngine } from '../../engines/enrichment/EnrichmentEngine';

/**
 * ChatGPT Platform Adapter
 *
 * Binds to the ChatGPT DOM to extract prompt text.
 * Strictly isolating DOM APIs from pure business logic.
 */
export class ChatGPTAdapter implements PlatformAdapter {
  private readonly gapEngine: GapDetectionEngine;
  private readonly enrichmentEngine: EnrichmentEngine;
  private observer: MutationObserver | null = null;
  private inputElement: HTMLTextAreaElement | null = null;
  private inputListener: EventListener | null = null;
  private submitListener: EventListener | null = null;

  // Track if we are currently executing a synthetic submit to avoid infinite loops
  private isSyntheticSubmit = false;

  constructor(gapEngine: GapDetectionEngine, enrichmentEngine: EnrichmentEngine) {
    this.gapEngine = gapEngine;
    this.enrichmentEngine = enrichmentEngine;
  }

  public start(): void {
    // 1. Find the prompt textarea
    this.inputElement = document.querySelector('#prompt-textarea') as HTMLTextAreaElement;
    
    if (!this.inputElement) {
      console.warn('[ChatGPTAdapter] Input element not found.');
      return;
    }

    // 2. Bind input event listener for synchronous gap analysis
    this.inputListener = (e: Event) => {
      if (this.isSyntheticSubmit) return; // ignore programmatic changes
      const text = (e.target as HTMLTextAreaElement).value || '';
      // Pass transient text directly to the engine in-memory
      this.gapEngine.analyze(text);
    };
    this.inputElement.addEventListener('input', this.inputListener);

    // 3. Bind keydown listener for Submit Interception (Enrichment Wrapping)
    this.submitListener = async (e: Event) => {
      const kbEvent = e as KeyboardEvent;
      if (kbEvent.key === 'Enter' && !kbEvent.shiftKey && !this.isSyntheticSubmit) {
        kbEvent.preventDefault();
        kbEvent.stopPropagation();
        
        await this.handleInterceptedSubmit();
      }
    };
    this.inputElement.addEventListener('keydown', this.submitListener, { capture: true });

    // 4. Set up MutationObserver if we needed to watch for DOM structural changes
    this.observer = new MutationObserver((mutations) => {
      // Stub: re-bind if necessary
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    
    console.log('[ChatGPTAdapter] Started observing ChatGPT.');
  }

  public stop(): void {
    if (this.inputElement) {
      if (this.inputListener) this.inputElement.removeEventListener('input', this.inputListener);
      if (this.submitListener) this.inputElement.removeEventListener('keydown', this.submitListener, { capture: true });
    }
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.inputElement = null;
    this.inputListener = null;
    this.submitListener = null;
    this.observer = null;
    console.log('[ChatGPTAdapter] Stopped observing ChatGPT.');
  }

  /**
   * Executes the prompt wrapping enrichment pipeline in-memory,
   * injects it, fires the synthetic submit, and restores visibility.
   */
  private async handleInterceptedSubmit(): Promise<void> {
    if (!this.inputElement) return;

    const rawText = this.inputElement.value;
    if (!rawText.trim()) return;

    // We need a session ID, mock one for now or fetch from StateEngine/local context
    const sessionId = 'session_xyz';

    // 1. Invoke Enrichment Engine (Executes in < 100ms)
    const enrichedText = await this.enrichmentEngine.enrich(rawText, sessionId);

    // 2. Inject wrapped prompt
    this.isSyntheticSubmit = true;
    this.inputElement.value = enrichedText;
    // Force React to recognize the change
    this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));

    // 3. Dispatch Synthetic Submit (simulate Enter key again, bypassing our capture listener)
    // In ChatGPT, sometimes clicking the send button is more reliable.
    const sendButton = document.querySelector('button[data-testid="send-button"]') as HTMLButtonElement;
    if (sendButton) {
      sendButton.click();
    } else {
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true
      });
      this.inputElement.dispatchEvent(enterEvent);
    }

    // 4. Restore visible prompt (Ghost Text UX Philosophy)
    // Use a microtask or small timeout to let React process the submit event first
    setTimeout(() => {
      if (this.inputElement) {
        this.inputElement.value = rawText; // Wait, actually on successful submit ChatGPT clears it, so we might just let it clear, but if it doesn't we restore.
        // For architectural purity, we restore the visual state.
        // this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
      this.isSyntheticSubmit = false;
    }, 50);
  }
}
