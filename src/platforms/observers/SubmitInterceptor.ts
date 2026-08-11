import { EventBus } from '../../core/event-bus/EventBus';
import { PlatformConfig } from '../selectors/interfaces';
import { SessionId } from '../../core/types/session.types';
import { PromptEnricher } from '../interfaces/PromptEnricher';
import { PromptEvents } from '../../core/event-bus/registry';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';

export class SubmitInterceptor {
  private isDestroyed = false;
  private isIntercepting = false;
  private abortController: AbortController = new AbortController();
  
  constructor(
    private readonly eventBus: EventBus,
    private readonly config: PlatformConfig,
    private readonly sessionId: SessionId,
    private readonly promptEnricher?: PromptEnricher
  ) {}

  public connect(): boolean {
    if (this.isDestroyed) {
      console.warn('[SubmitInterceptor] Cannot reconnect a destroyed observer.');
      return false;
    }

    const options = { capture: true, signal: this.abortController.signal };
    
    document.addEventListener('keydown', (e) => {
      let target = e.target as Element;
      if (target && target.nodeType === Node.TEXT_NODE) {
          target = target.parentElement as Element;
      }

      if (target && target.closest) {
          const matchedInput = target.closest(this.config.selectors.promptInput);
          if (matchedInput) {
            // [M11 Diagnostic] Monitor Claude prose-mirror keyboard submission anomalies
            if (e.key === 'Enter') {
                console.debug(`[M11 Diagnostic] Enter pressed on prompt target. shiftKey=${e.shiftKey}, isComposing=${e.isComposing}`);
            }

            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
              console.log('[SubmitInterceptor] Intercepted Enter keydown');
              this.onSubmitTriggered(e);
            }
          }
      }
    }, options);

    document.addEventListener('click', (e) => {
      let target = e.target as Element;
      if (target && target.nodeType === Node.TEXT_NODE) {
          target = target.parentElement as Element;
      }

      if (this.config.selectors.submitButton && target && target.closest && target.closest(this.config.selectors.submitButton)) {
        console.log('[SubmitInterceptor] Intercepted submit button click');
        this.onSubmitTriggered(e);
      }
    }, options);

    console.log('[SubmitInterceptor] Attached and observing.');
    return true;
  }

  public disconnect(): void {
    this.abortController.abort();
  }

  public destroy(): void {
    this.disconnect();
    this.isDestroyed = true;
    console.log('[SubmitInterceptor] Destroyed.');
  }

  private getInputValue(node: HTMLElement): string {
    if ('value' in node) {
      return (node as HTMLInputElement | HTMLTextAreaElement).value || '';
    }
    return node.innerText || node.textContent || '';
  }

  private setInputValue(node: HTMLElement, value: string): void {
    if ('value' in node) {
      const el = node as HTMLInputElement | HTMLTextAreaElement;
      el.value = value;
      node.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      node.focus();
      // Select all existing text to replace it
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(node);
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      // Use execCommand to trigger native browser input events that ProseMirror/React respect
      document.execCommand('insertText', false, value);
    }
  }

  private triggerSubmit(): void {
    if (this.config.selectors.submitButton) {
      const submitBtn = document.querySelector(this.config.selectors.submitButton) as HTMLElement;
      if (submitBtn) {
        submitBtn.click();
      }
    }
  }

  private cyrb53(str: string, seed = 0): number {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  private async onSubmitTriggered(e: Event): Promise<void> {
    console.log('[SubmitInterceptor] onSubmitTriggered called, isIntercepting:', this.isIntercepting);
    if (this.isIntercepting) {
      return;
    }

    const inputNode = document.querySelector(this.config.selectors.promptInput) as HTMLElement;
    if (!inputNode) {
      console.warn('[SubmitInterceptor] inputNode not found');
      return;
    }
    
    const rawText = this.getInputValue(inputNode);
    console.log('[SubmitInterceptor] getInputValue returned:', rawText);
    if (!rawText.trim()) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    this.isIntercepting = true;
    let finalOutput = rawText;
    let wasEnriched = false;

    try {
      if (this.promptEnricher) {
        finalOutput = await this.promptEnricher.enrich(rawText, this.sessionId);
        if (finalOutput !== rawText) {
          wasEnriched = true;
        }
      }
      console.log('[SubmitInterceptor] Enrichment successful, finalOutput length:', finalOutput.length);
    } catch (error) {
      console.error('[SubmitInterceptor] Enrichment failed:', error);
      finalOutput = rawText;
      wasEnriched = false;
    } finally {
      console.log('[SubmitInterceptor] In finally block, wasEnriched:', wasEnriched);
      // Write the (enriched or fallback) text back
      if (wasEnriched) {
        this.setInputValue(inputNode, finalOutput);
      }
      
      // Emit the prompt.sent event
      const wordCount = finalOutput.split(/\s+/).filter(w => w.length > 0).length;
      const hash = this.cyrb53(finalOutput).toString();

      console.log('[SubmitInterceptor] Publishing prompt.sent event');
      this.eventBus.publish(
        PromptEvents.SENT,
        createDomainEvent(PromptEvents.SENT, this.sessionId, 'perception.submit', {
          promptHash: hash,
          textLength: finalOutput.length,
          wordCount,
          wasEnriched
        }) as any
      );

      // Re-trigger the native submit flow programmatically
      // isIntercepting is still true here, so this won't loop recursively
      console.log('[SubmitInterceptor] Waiting for React to flush state updates...');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log('[SubmitInterceptor] Triggering original submit button');
      this.triggerSubmit();
      
      // Finally reset the guard so future submits work normally
      this.isIntercepting = false;
    }
  }
}
