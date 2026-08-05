import { PlatformAdapter } from '../interfaces/PlatformAdapter';
import { EventBus } from '../../core/event-bus/EventBus';
import { SessionId } from '../../core/types/session.types';
import { ResponseObserver } from '../observers/ResponseObserver';
import { TypingObserver } from '../observers/TypingObserver';
import { SelectorRegistry } from '../selectors/registry';

/**
 * ChatGPT Platform Adapter
 *
 * Acts exclusively as a Composition Root.
 * Instantiates dedicated Observers based on versioned selectors.
 * Strictly isolating DOM APIs from pure business logic.
 * Contains ZERO enrichment, state, or analytics logic.
 */
export class ChatGPTAdapter implements PlatformAdapter {
  private responseObserver: ResponseObserver | null = null;
  private typingObserver: TypingObserver | null = null;

  constructor(
    private readonly eventBus: EventBus
  ) {}

  public start(sessionId: SessionId): void {
    const config = SelectorRegistry.resolve(window.location.href);
    if (!config) {
      console.warn('[ChatGPTAdapter] Platform configuration not found for URL.');
      return;
    }

    this.responseObserver = new ResponseObserver(this.eventBus, config, sessionId);
    this.typingObserver = new TypingObserver(this.eventBus, config, sessionId);

    this.responseObserver.connect();
    this.typingObserver.connect();
    
    console.log('[ChatGPTAdapter] Started observing ChatGPT via Composition Root.');
  }

  public stop(): void {
    if (this.responseObserver) {
      this.responseObserver.destroy();
      this.responseObserver = null;
    }
    if (this.typingObserver) {
      this.typingObserver.destroy();
      this.typingObserver = null;
    }
    
    console.log('[ChatGPTAdapter] Stopped observing ChatGPT.');
  }
}
