import { PlatformAdapter } from '../interfaces/PlatformAdapter';
import { ChatGPTAdapter } from '../chatgpt/ChatGPTAdapter';
import { ClaudeAdapter } from '../claude/ClaudeAdapter';
import { GeminiAdapter } from '../gemini/GeminiAdapter';
import { EventBus } from '../../core/event-bus/EventBus';
import { SessionId, toSessionId } from '../../core/types/session.types';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { SessionEvents } from '../../core/event-bus/registry';
import { GapDetectionEngine } from '../../engines/gap/GapDetectionEngine';
import { PromptEnricher } from '../interfaces/PromptEnricher';

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

  constructor(
    private readonly eventBus: EventBus,
    private readonly gapEngine?: GapDetectionEngine,
    private readonly promptEnricher?: PromptEnricher
  ) {}

  /**
   * Phase 1: Prepares the platform adapter based on URL. Does not start observation.
   */
  public prepareAdapter(currentUrl: string = window.location.href): void {
    if (this.activeAdapter) {
      this.endObservation();
    }

    this.activeAdapter = this.createAdapterForUrl(currentUrl);

    if (!this.activeAdapter) {
      console.warn('[PlatformManager] No supported platform detected for URL:', currentUrl);
    }
  }

  /**
   * Phase 2: Begins observation for an explicit or implicitly created session.
   */
  public beginObservation(sessionId?: SessionId): void {
    if (!this.activeAdapter) {
      console.warn('[PlatformManager] Cannot begin observation: no active adapter prepared.');
      return;
    }

    if (this.currentSessionId) {
      console.warn('[PlatformManager] Observation already active for session:', this.currentSessionId);
      return;
    }

    let actualSessionId = sessionId;
    let generatedEvent = null;

    if (!actualSessionId) {
      actualSessionId = toSessionId(crypto.randomUUID());
      const platform = this.getPlatformName(window.location.href);

      generatedEvent = createDomainEvent(
        SessionEvents.STARTED,
        actualSessionId,
        'platform-adapter',
        { platform }
      );
    }

    // Set state before publishing to prevent reentrancy loops from synchronous listeners
    this.currentSessionId = actualSessionId;

    if (generatedEvent) {
      this.eventBus.publish(SessionEvents.STARTED, generatedEvent);
    }

    // Start the platform adapter
    this.activeAdapter.start(this.currentSessionId);

    // Bind lifecycle listeners for session pause/end logic
    document.addEventListener('visibilitychange', this.boundOnVisibilityChange);
    window.addEventListener('beforeunload', this.boundOnBeforeUnload);
  }

  /**
   * Phase 3: Ends observation when a session is explicitly ended by the user.
   */
  public endObservation(): void {
    if (this.activeAdapter) {
      this.activeAdapter.stop();
    }

    document.removeEventListener('visibilitychange', this.boundOnVisibilityChange);
    window.removeEventListener('beforeunload', this.boundOnBeforeUnload);

    this.currentSessionId = null;
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
      return new ChatGPTAdapter(this.eventBus, this.gapEngine, this.promptEnricher);
    }
    if (url.includes('claude.ai')) {
      return new ClaudeAdapter(this.eventBus, this.gapEngine, this.promptEnricher);
    }
    if (url.includes('gemini.google.com')) {
      return new GeminiAdapter(this.eventBus, this.gapEngine, this.promptEnricher);
    }
    return null;
  }

  private getPlatformName(url: string): string {
    if (url.includes('chatgpt.com')) return 'chatgpt';
    if (url.includes('claude.ai')) return 'claude';
    if (url.includes('gemini.google.com')) return 'gemini';
    return 'unknown';
  }
}
