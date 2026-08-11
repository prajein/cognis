import { EventBus } from '../../core/event-bus/EventBus';
import { PlatformConfig } from '../selectors/interfaces';
import { SessionId } from '../../core/types/session.types';
import { ResponseSnapshot, translateResponseSnapshot } from '../translators/ResponseTranslator';

/**
 * Claude-specific Response Observer
 * 
 * Implements the perception.response domain contract specifically for Claude's 
 * non-monotonic DOM streaming behavior.
 */
export class ClaudeResponseObserver {
  private activeContainer: HTMLElement | null = null;
  private cursor = { textLength: 0, lastText: '' };
  private isGenerating = false;
  private startTime = 0;
  private rafId: number | null = null;
  private mutationObserver: MutationObserver | null = null;
  private hasPendingMutations = false;
  private isDestroyed = false;
  
  private activePromptEventId: string = 'unattributed_prompt';
  private activePromptHash: string = 'unattributed_hash';
  private activePromptWasEnriched = false;
  private unsubscribePromptSent: (() => void) | null = null;

  constructor(
    private readonly eventBus: EventBus,
    private readonly config: PlatformConfig,
    private readonly sessionId: SessionId
  ) {}

  public connect(): boolean {
    if (this.isDestroyed) {
      return false;
    }

    const container = document.querySelector(this.config.selectors.responseContainer);
    if (!container) return false;

    this.mutationObserver = new MutationObserver(() => {
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

    this.unsubscribePromptSent = this.eventBus.subscribe('prompt.sent', (event: any) => {
        this.activePromptEventId = event.id;
        this.activePromptHash = event.payload.promptHash || 'unattributed_hash';
        this.activePromptWasEnriched = !!event.payload.wasEnriched;
        console.log('[ClaudeResponseObserver] Correlated next generation to prompt:', this.activePromptEventId);
    });

    console.log('[ClaudeResponseObserver] Attached and observing.');
    return true;
  }

  public disconnect(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.unsubscribePromptSent) {
      this.unsubscribePromptSent();
      this.unsubscribePromptSent = null;
    }
  }

  public destroy(): void {
    this.disconnect();
    this.activeContainer = null;
    this.isDestroyed = true;
    console.log('[ClaudeResponseObserver] Destroyed.');
  }

  private processDOM(): void {
    this.rafId = null;
    if (this.isDestroyed || !this.hasPendingMutations) return;
    this.hasPendingMutations = false;

    const responseNodes = document.querySelectorAll(this.config.selectors.responseBlock);
    if (responseNodes.length === 0) return;

    const latestNode = responseNodes[responseNodes.length - 1];
    
    // The stable identity is the parent row container, empirically verified for Claude.
    // Ancestor replacement/disconnection is a generation boundary.
    const currentContainer = latestNode.closest('.group\\/message-row') as HTMLElement | null;
    if (!currentContainer || !currentContainer.isConnected) {
      if (this.isGenerating) {
        this.emitCompletion();
      }
      return;
    }

    const streamingNode = latestNode.closest(this.config.selectors.streamingIndicator);
    const isStreaming = streamingNode?.getAttribute('data-is-streaming') === 'true';
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
        promptHash: this.activePromptHash,
        promptEventId: this.activePromptEventId,
        wasEnriched: this.activePromptWasEnriched,
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

      this.publish({
        sessionId: this.sessionId,
        promptHash: this.activePromptHash,
        promptEventId: this.activePromptEventId,
        wasEnriched: this.activePromptWasEnriched,
        isStarting: false,
        deltaText: deltaText,
        isCompleted: false,
        chunkLength: deltaText ? deltaText.length : 0,
        totalLength: currentText.length,
        durationMs: 0
      });
      this.cursor = { textLength: currentText.length, lastText: currentText };
    }

    // Streaming completion via explicit attribute transition
    if (!isStreaming && this.isGenerating) {
      this.emitCompletion();
    }
  }

  private emitCompletion(): void {
    if (!this.isGenerating) return;
    this.isGenerating = false;
    
    // Calculate final text length across all blocks using the latest reliable measurement
    this.publish({
      sessionId: this.sessionId,
      promptHash: this.activePromptHash,
      promptEventId: this.activePromptEventId,
      wasEnriched: this.activePromptWasEnriched,
      isStarting: false,
      deltaText: null,
      isCompleted: true,
      chunkLength: 0,
      totalLength: this.cursor.textLength,
      durationMs: Date.now() - this.startTime
    });
  }

  private publish(snapshot: ResponseSnapshot): void {
    const events = translateResponseSnapshot(snapshot);
    events.forEach(e => this.eventBus.publish(e.type, e as any));
  }
}
