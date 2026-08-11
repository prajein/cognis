import { EventBus } from '../../core/event-bus/EventBus';
import { PlatformConfig } from '../selectors/interfaces';
import { translateResponseSnapshot, ResponseSnapshot } from '../translators/ResponseTranslator';
import { SessionId } from '../../core/types/session.types';
import { PromptEvents, SessionEvents } from '../../core/event-bus/registry';
import { DomainEvent } from '../../core/event-bus/contracts';

export interface ResponseCursor {
  textLength: number;
}

export class ResponseObserver {
  private observer: MutationObserver | null = null;
  private abortController: AbortController = new AbortController();
  
  private currentResponseNode: Element | null = null;
  private cursor: ResponseCursor = { textLength: 0 };
  private startTime = 0;
  
  // Pending Identity (latest submission, not yet bound to a response)
  private pendingPromptEventId?: string;
  private pendingPromptHash?: string;
  private pendingWasEnriched?: boolean;

  // Active Generation Identity (immutable for the currently streaming response)
  private activePromptEventId?: string;
  private activePromptHash?: string;
  private activeWasEnriched?: boolean;

  private isDestroyed = false;
  private unsubscribes: Array<() => void> = [];

  private rafId: number | null = null;
  private hasPendingMutations = false;
  private completionTimeout: ReturnType<typeof setTimeout> | null = null;
  private isGenerating = false;

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

    // Subscribe to PromptEvents.SENT to capture metadata for correlation
    this.unsubscribes.push(
      this.eventBus.subscribe(PromptEvents.SENT, (event: DomainEvent<any>) => {
        this.pendingPromptEventId = event.id;
        this.pendingPromptHash = event.payload.promptHash;
        this.pendingWasEnriched = event.payload.wasEnriched;
      })
    );

    // Explicitly reset on session boundary events
    const clearCache = () => {
      this.pendingPromptEventId = undefined;
      this.pendingPromptHash = undefined;
      this.pendingWasEnriched = undefined;
      this.activePromptEventId = undefined;
      this.activePromptHash = undefined;
      this.activeWasEnriched = undefined;
    };
    this.unsubscribes.push(this.eventBus.subscribe(SessionEvents.STARTED, clearCache));
    this.unsubscribes.push(this.eventBus.subscribe(SessionEvents.ENDED, clearCache));

    // Bind AbortController to any DOM events if needed, but MutationObserver uses disconnect
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    this.observer.observe(container, { childList: true, subtree: true, characterData: true });
    
    // Ignore historical messages already in the DOM (unless actively streaming right now)
    const responseNodes = document.querySelectorAll(this.config.selectors.responseBlock);
    if (responseNodes.length > 0) {
      const isStreaming = document.querySelector(this.config.selectors.streamingIndicator) !== null;
      if (!isStreaming) {
        const latestNode = responseNodes[responseNodes.length - 1];
        this.currentResponseNode = latestNode;
        this.cursor.textLength = latestNode.textContent?.length || 0;
      }
    }

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
    if (this.completionTimeout !== null) {
      clearTimeout(this.completionTimeout);
      this.completionTimeout = null;
    }
    // Clean up subscriptions
    while (this.unsubscribes.length > 0) {
      this.unsubscribes.pop()?.();
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

    // Target loss is now handled gracefully: if responseNodes is empty, we emit completion.
    // If it's not empty, we evaluate if it's a DOM replacement vs new generation.

    const responseNodes = document.querySelectorAll(this.config.selectors.responseBlock);
    if (responseNodes.length === 0) {
      if (this.currentResponseNode && this.isGenerating) {
        this.emitCompletion();
      }
      this.currentResponseNode = null;
      return;
    }

    const latestNode = responseNodes[responseNodes.length - 1];
    const isStreaming = document.querySelector(this.config.selectors.streamingIndicator) !== null;
    const currentText = latestNode.textContent || '';

    // Regenerated response / New response
    // If the node changed, or if the text shrunk (e.g. wiped for regen)
    if (this.currentResponseNode !== latestNode || currentText.length < this.cursor.textLength) {
      
      // Is this a DOM replacement within the same generation?
      // If the node changed, but we are actively generating and the text hasn't shrunk,
      // it's a DOM replacement (e.g. placeholder swap or midway wrapper swap).
      const isDomReplacement = this.isGenerating && 
                               this.currentResponseNode !== latestNode && 
                               currentText.length >= this.cursor.textLength;

      if (isDomReplacement) {
        // Just update the node reference. Do not snapshot, do not emit started/completed, do not reset cursor.
        this.currentResponseNode = latestNode;
      } else {
        if (this.currentResponseNode && this.isGenerating) {
          this.emitCompletion();
        }

        this.currentResponseNode = latestNode;
        this.cursor = { textLength: 0 };
        this.startTime = Date.now();
        
        this.isGenerating = true;

        // SNAPSHOT the correlation identity at the genuine generation boundary
        this.activePromptEventId = this.pendingPromptEventId;
        this.activePromptHash = this.pendingPromptHash;
        this.activeWasEnriched = this.pendingWasEnriched;

        // Consume the pending prompt so we don't accidentally reuse it for subsequent unrelated responses
        this.pendingPromptEventId = undefined;
        this.pendingPromptHash = undefined;
        this.pendingWasEnriched = undefined;

        this.publish({
          sessionId: this.sessionId,
          promptHash: this.activePromptHash ?? 'unattributed_hash',
          promptEventId: this.activePromptEventId,
          wasEnriched: this.activeWasEnriched,
          isStarting: true,
          deltaText: null,
          isCompleted: false,
          chunkLength: 0,
          totalLength: 0,
          durationMs: 0
        });
      }
    }

    // 2. Process chunk delta using Cursor
    if (currentText.length > this.cursor.textLength) {
      const delta = currentText.substring(this.cursor.textLength);
      
      // Duplicate suppression (empty delta mathematically)
      if (delta.length > 0) {
        this.publish({
          sessionId: this.sessionId,
          promptHash: this.activePromptHash ?? 'unattributed_hash',
          promptEventId: this.activePromptEventId,
          wasEnriched: this.activeWasEnriched,
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

    // 3. Completion Check via Debounce
    // We clear any existing completion timeout since we just received a mutation.
    if (this.completionTimeout !== null) {
      clearTimeout(this.completionTimeout);
      this.completionTimeout = null;
    }

    // If there is an explicit streaming indicator, we definitely aren't done.
    // If there ISN'T an explicit streaming indicator, we wait 1000ms. If no mutations happen in that time, we consider it done.
    if (!isStreaming && this.isGenerating) {
      this.completionTimeout = setTimeout(() => {
        if (this.isGenerating) {
          this.emitCompletion();
        }
      }, 1000);
    }
  }

  private emitCompletion(): void {
    if (!this.isGenerating) return;
    this.isGenerating = false;
    
    if (this.completionTimeout !== null) {
      clearTimeout(this.completionTimeout);
      this.completionTimeout = null;
    }

    const currentText = this.currentResponseNode?.textContent || '';
    
    // Safety check: don't fabricate events if we never started
    // But since we are calling this when a node exists, it started.
    this.publish({
      sessionId: this.sessionId,
      promptHash: this.activePromptHash ?? 'unattributed_hash',
      promptEventId: this.activePromptEventId,
      wasEnriched: this.activeWasEnriched,
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
