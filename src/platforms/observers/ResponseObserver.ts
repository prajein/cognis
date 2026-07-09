import { EventBus } from '../../core/event-bus/EventBus';
import { PlatformConfig } from '../selectors/interfaces';
import { translateResponseSnapshot, ResponseSnapshot } from '../translators/ResponseTranslator';
import { SessionId } from '../../core/types/session.types';

export interface ResponseCursor {
  textLength: number;
}

export class ResponseObserver {
  private observer: MutationObserver | null = null;
  private abortController: AbortController = new AbortController();
  
  private currentResponseNode: Element | null = null;
  private cursor: ResponseCursor = { textLength: 0 };
  private startTime = 0;
  private promptHashCache = 'pending_hash';
  private isDestroyed = false;

  private rafId: number | null = null;
  private hasPendingMutations = false;

  constructor(
    private readonly eventBus: EventBus,
    private readonly config: PlatformConfig,
    private readonly sessionId: SessionId
  ) {}

  public connect(): boolean {
    if (this.isDestroyed) {
      console.warn('[ResponseObserver] Cannot reconnect a destroyed observer.');
      return false;
    }

    const container = document.querySelector(this.config.selectors.responseContainer);
    if (!container) {
      return false;
    }

    // Bind AbortController to any DOM events if needed, but MutationObserver uses disconnect
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    this.observer.observe(container, { childList: true, subtree: true, characterData: true });
    
    console.log('[ResponseObserver] Attached and observing.');
    return true;
  }

  public disconnect(): void {
    this.abortController.abort();
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public destroy(): void {
    this.disconnect();
    // Explicitly nullify DOM references to prevent leaks
    this.currentResponseNode = null;
    this.isDestroyed = true;
    console.log('[ResponseObserver] Destroyed.');
  }

  private handleMutations(mutations: MutationRecord[]): void {
    if (this.isDestroyed) return;
    
    this.hasPendingMutations = true;
    if (this.rafId === null) {
      // Queue single DOM read per frame to prevent layout thrashing
      this.rafId = requestAnimationFrame(() => this.processDOM());
    }
  }

  private processDOM(): void {
    this.rafId = null;
    if (this.isDestroyed || !this.hasPendingMutations) return;
    this.hasPendingMutations = false;

    // Target Loss Detection
    if (this.currentResponseNode && !this.currentResponseNode.isConnected) {
      this.emitCompletion();
      this.currentResponseNode = null;
    }

    // 1. Single DOM Read
    const responseNodes = document.querySelectorAll(this.config.selectors.responseBlock);
    if (responseNodes.length === 0) return;

    const latestNode = responseNodes[responseNodes.length - 1];
    const isStreaming = document.querySelector(this.config.selectors.streamingIndicator) !== null;
    const currentText = latestNode.textContent || '';

    // Regenerated response / New response
    // If the node changed, or if the text shrunk (e.g. wiped for regen)
    if (this.currentResponseNode !== latestNode || currentText.length < this.cursor.textLength) {
      if (this.currentResponseNode) {
        this.emitCompletion();
      }

      this.currentResponseNode = latestNode;
      this.cursor = { textLength: 0 };
      this.startTime = Date.now();

      this.publish({
        sessionId: this.sessionId,
        promptHash: this.promptHashCache,
        isStarting: true,
        deltaText: null,
        isCompleted: false,
        chunkLength: 0,
        totalLength: 0,
        durationMs: 0
      });
    }

    // 2. Process chunk delta using Cursor
    if (currentText.length > this.cursor.textLength) {
      const delta = currentText.substring(this.cursor.textLength);
      
      // Duplicate suppression (empty delta mathematically)
      if (delta.length > 0) {
        this.publish({
          sessionId: this.sessionId,
          promptHash: this.promptHashCache,
          isStarting: false,
          deltaText: delta,
          isCompleted: false,
          chunkLength: delta.length,
          totalLength: currentText.length,
          durationMs: 0
        });
        
        // Advance cursor
        this.cursor.textLength = currentText.length;
      }
    }

    // 3. Completion Check
    if (!isStreaming && this.currentResponseNode) {
      // Stream indicator vanished, finish
      this.emitCompletion();
      this.currentResponseNode = null;
    }
  }

  private emitCompletion(): void {
    const currentText = this.currentResponseNode?.textContent || '';
    
    // Safety check: don't fabricate events if we never started
    // But since we are calling this when a node exists, it started.
    this.publish({
      sessionId: this.sessionId,
      promptHash: this.promptHashCache,
      isStarting: false,
      deltaText: null,
      isCompleted: true,
      chunkLength: 0,
      totalLength: currentText.length,
      durationMs: Date.now() - this.startTime
    });
  }

  private publish(snapshot: ResponseSnapshot): void {
    const events = translateResponseSnapshot(snapshot);
    events.forEach(e => this.eventBus.publish(e.type, e as any));
  }
}
