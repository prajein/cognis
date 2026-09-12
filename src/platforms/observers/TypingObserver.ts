import { EventBus } from '../../core/event-bus/EventBus';
import { PlatformConfig } from '../selectors/interfaces';
import { translateTypingSnapshot, TypingSnapshot } from '../translators/TypingTranslator';
import { SessionId } from '../../core/types/session.types';
import { ResponseEvents, SessionEvents } from '../../core/event-bus/registry';
import { GapDetectionEngine } from '../../engines/gap/GapDetectionEngine';

export class TypingObserver {
  private inputNode: HTMLElement | null = null;
  private abortController: AbortController = new AbortController();
  private isDestroyed = false;
  
  private revisionDepth = 0;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTypingTime = 0;
  private lastEmissionTime = 0;

  private unsubscribeAll: (() => void)[] = [];
  
  private readonly IDLE_THRESHOLD_MS = 1250; // Buffer 50ms over 1200ms to guarantee clearing GhostTextEngine's threshold
  private readonly THROTTLE_MS = 100; // Max 10 events per second

  constructor(
    private readonly eventBus: EventBus,
    private readonly config: PlatformConfig,
    private readonly sessionId: SessionId,
    private readonly gapEngine?: GapDetectionEngine
  ) {}

  public connect(): boolean {
    if (this.isDestroyed) {
      console.warn('[TypingObserver] Cannot reconnect a destroyed observer.');
      return false;
    }

    // Try initial probe, but do NOT abort if node is not in DOM yet (SPA hydration)
    this.inputNode = document.querySelector(this.config.selectors.promptInput) as HTMLElement | null;

    const options = { capture: true, signal: this.abortController.signal };
    
    // Event Delegation: React frequently unmounts and recreates the input node.
    // We attach to document with capture: true to intercept typing before framework absorption.
    const handleTypingEvent = (e: Event) => {
      let target = e.target as Element | null;
      if (target && target.nodeType === Node.TEXT_NODE) {
        target = target.parentElement;
      }
      if (target && target.closest) {
        const matched = target.closest(this.config.selectors.promptInput) as HTMLElement | null;
        if (matched) {
          this.inputNode = matched;
          this.onInput();
        }
      }
    };

    document.addEventListener('input', handleTypingEvent, options);
    document.addEventListener('keyup', handleTypingEvent, options);

    document.addEventListener('keydown', (e) => {
      let target = e.target as Element | null;
      if (target && target.nodeType === Node.TEXT_NODE) {
        target = target.parentElement;
      }
      if (target && target.closest) {
        const matched = target.closest(this.config.selectors.promptInput) as HTMLElement | null;
        if (matched) {
          this.inputNode = matched;
          this.onKeyDown(e as KeyboardEvent);
        }
      }
    }, options);

    console.log('[TypingObserver] Attached and observing (Event Delegation). Initial node found:', !!this.inputNode);
    return true;
  }

  public disconnect(): void {
    this.abortController.abort(); // Instantly unbinds all event listeners
    this.clearTimer();
    this.unsubscribeAll.forEach(unsub => unsub());
    this.unsubscribeAll = [];
  }

  public destroy(): void {
    this.disconnect();
    this.inputNode = null; // Prevent DOM leaks
    this.isDestroyed = true;
    console.log('[TypingObserver] Destroyed.');
  }

  private getInputValue(): string {
    if (!this.inputNode || !this.inputNode.isConnected) {
      this.inputNode = document.querySelector(this.config.selectors.promptInput) as HTMLElement | null;
    }
    if (!this.inputNode) return '';
    if ('value' in this.inputNode && this.inputNode.tagName.toLowerCase() === 'textarea') {
      return (this.inputNode as HTMLTextAreaElement).value || '';
    }
    return this.inputNode.innerText || this.inputNode.textContent || '';
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      this.revisionDepth++;
    }
  }

  private onInput(): void {
    if (!this.inputNode || this.isDestroyed) return;

    const now = Date.now();
    this.lastTypingTime = now;
    this.resetTimer();

    // Throttling: Update state but don't emit if within THROTTLE_MS
    if (now - this.lastEmissionTime < this.THROTTLE_MS) {
      return;
    }

    this.lastEmissionTime = now;
    const text = this.getInputValue();
    const textLength = text.length;
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    const hash = this.cyrb53(text).toString();

    this.publish({
      sessionId: this.sessionId,
      isTyping: true,
      textLength,
      wordCount,
      currentTextHash: hash,
      revisionDepth: this.revisionDepth,
      isPause: false,
      pauseDurationMs: 0,
      isSent: false
    });
  }

  private resetTimer(): void {
    this.clearTimer();
    this.pauseTimer = setTimeout(() => {
      this.onPauseDetected();
    }, this.IDLE_THRESHOLD_MS);
  }

  private clearTimer(): void {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  private onPauseDetected(): void {
    if (!this.inputNode || this.isDestroyed) return;

    // Target Loss Detection
    // In SPAs like ChatGPT, the node might be temporarily disconnected during re-renders.
    // Instead of destroying the observer entirely, we just attempt to re-select it.
    if (!this.inputNode.isConnected) {
      const newNode = document.querySelector(this.config.selectors.promptInput) as HTMLElement | null;
      if (newNode) {
        this.inputNode = newNode;
      } else {
        // If it's truly gone, we just wait for the next delegated event to find it.
        return;
      }
    }

    const pauseDuration = Date.now() - this.lastTypingTime;
    const currentText = this.getInputValue();
    console.log('[TypingObserver] Pause detected. Text length:', currentText.length, 'Duration (ms):', pauseDuration);
    
    if (this.gapEngine) {
      this.gapEngine.captureTransientText(currentText);
    }

    this.publish({
      sessionId: this.sessionId,
      isTyping: false,
      textLength: this.getInputValue().length,
      wordCount: 0,
      currentTextHash: '',
      revisionDepth: this.revisionDepth,
      isPause: true,
      pauseDurationMs: pauseDuration,
      isSent: false
    });
  }

  private publish(snapshot: TypingSnapshot): void {
    const events = translateTypingSnapshot(snapshot);
    events.forEach(e => this.eventBus.publish(e.type, e as any));
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
}
