import { PlatformAdapter } from '../interfaces/PlatformAdapter';
import { ChatGPTAdapter } from '../chatgpt/ChatGPTAdapter';
import { EventBus } from '../../core/event-bus/EventBus';
import { SessionId, toSessionId } from '../../core/types/session.types';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { SessionEvents } from '../../core/event-bus/registry';

/**
 * Platform Manager
 *
 * Responsible for detecting the current host environment (e.g., ChatGPT, Claude)
 * based on URL or DOM signatures, and instantiating the correct PlatformAdapter.
 * It manages the lifecycle of the active adapter and orchestrates global session events.
 */
export class PlatformManager {
  private activeAdapter: PlatformAdapter | null = null;
  private currentSessionId: SessionId | null = null;
  private isVisible = true;

  private boundOnVisibilityChange = this.onVisibilityChange.bind(this);
  private boundOnBeforeUnload = this.onBeforeUnload.bind(this);

  constructor(private readonly eventBus: EventBus) {}

  /**
   * Detects the platform based on the current window location and starts the adapter.
   */
  public detectAndStart(currentUrl: string = window.location.href): void {
    if (this.activeAdapter) {
      this.stop();
    }

    this.currentSessionId = toSessionId(crypto.randomUUID());

    this.activeAdapter = this.createAdapterForUrl(currentUrl);
    
    if (this.activeAdapter) {
      // 1. Emit Session Started event before instantiating adapters
      this.eventBus.publish(SessionEvents.STARTED, createDomainEvent(
        SessionEvents.STARTED,
        this.currentSessionId,
        'perception.lifecycle',
        { platform: this.getPlatformName(currentUrl) }
      ));

      // 2. Start the platform adapter
      this.activeAdapter.start();
      
      // 3. Bind lifecycle listeners for session pause/end logic
      document.addEventListener('visibilitychange', this.boundOnVisibilityChange);
      window.addEventListener('beforeunload', this.boundOnBeforeUnload);
    } else {
      console.warn('[PlatformManager] No supported platform detected for URL:', currentUrl);
    }
  }

  /**
   * Stops the currently active adapter and emits session.ended.
   */
  public stop(): void {
    if (this.activeAdapter) {
      this.activeAdapter.stop();
      this.activeAdapter = null;
    }
    
    document.removeEventListener('visibilitychange', this.boundOnVisibilityChange);
    window.removeEventListener('beforeunload', this.boundOnBeforeUnload);

    if (this.currentSessionId) {
      this.eventBus.publish(SessionEvents.ENDED, createDomainEvent(
        SessionEvents.ENDED,
        this.currentSessionId,
        'perception.lifecycle',
        { reason: 'explicit' }
      ));
      this.currentSessionId = null;
    }
  }

  private onVisibilityChange(): void {
    const isNowVisible = document.visibilityState === 'visible';
    if (!this.currentSessionId) return;

    if (isNowVisible && !this.isVisible) {
      this.isVisible = true;
      this.eventBus.publish(SessionEvents.RESUMED, createDomainEvent(
        SessionEvents.RESUMED,
        this.currentSessionId,
        'perception.lifecycle',
        { pauseDurationMs: 0 }
      ));
    } else if (!isNowVisible && this.isVisible) {
      this.isVisible = false;
      this.eventBus.publish(SessionEvents.PAUSED, createDomainEvent(
        SessionEvents.PAUSED,
        this.currentSessionId,
        'perception.lifecycle',
        { reason: 'tab_hidden' }
      ));
    }
  }

  private onBeforeUnload(): void {
    if (this.currentSessionId) {
      this.eventBus.publish(SessionEvents.ENDED, createDomainEvent(
        SessionEvents.ENDED,
        this.currentSessionId,
        'perception.lifecycle',
        { reason: 'navigation' }
      ));
    }
  }

  private createAdapterForUrl(url: string): PlatformAdapter | null {
    if (url.includes('chatgpt.com')) {
      return new ChatGPTAdapter(this.eventBus, this.currentSessionId!);
    }
    return null;
  }

  private getPlatformName(url: string): string {
    if (url.includes('chatgpt.com')) return 'chatgpt';
    return 'unknown';
  }
}
