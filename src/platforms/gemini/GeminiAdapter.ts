import { PlatformAdapter } from '../interfaces/PlatformAdapter';
import { EventBus } from '../../core/event-bus/EventBus';
import { SessionId } from '../../core/types/session.types';
import { ResponseObserver } from '../observers/ResponseObserver';
import { TypingObserver } from '../observers/TypingObserver';
import { GhostTextObserver } from '../observers/GhostTextObserver';
import { ReadingObserver } from '../observers/ReadingObserver';
import { SelectorRegistry } from '../selectors/registry';
import { GapDetectionEngine } from '../../engines/gap/GapDetectionEngine';
import { PromptEnricher } from '../interfaces/PromptEnricher';
import { SubmitInterceptor } from '../observers/SubmitInterceptor';
import { GhostTextMeasurementObserver } from '../observers/GhostTextMeasurementObserver';

/**
 * Gemini Platform Adapter
 *
 * Acts exclusively as a Composition Root, mirroring ChatGPTAdapter/ClaudeAdapter
 * exactly: instantiates the same observers against versioned selectors, strictly
 * isolating DOM APIs from pure business logic. Contains ZERO enrichment, state,
 * or analytics logic of its own.
 *
 * Uses the generic `ResponseObserver` (same as ChatGPTAdapter) rather than a
 * bespoke observer, since Gemini's streaming DOM behavior hasn't been verified
 * against the live site (see `../selectors/gemini-v1.ts`). If Gemini turns out
 * to have Claude-style non-monotonic streaming, a dedicated
 * `GeminiResponseObserver` (mirroring `ClaudeResponseObserver`) would replace
 * this the same way Claude's does — swap one constructor call, nothing else.
 */
export class GeminiAdapter implements PlatformAdapter {
  private responseObserver: ResponseObserver | null = null;
  private typingObserver: TypingObserver | null = null;
  private ghostTextObserver: GhostTextObserver | null = null;
  private ghostTextMeasurementObserver: GhostTextMeasurementObserver | null = null;
  private readingObserver: ReadingObserver | null = null;
  private submitInterceptor: SubmitInterceptor | null = null;

  constructor(
    private readonly eventBus: EventBus,
    private readonly gapEngine?: GapDetectionEngine,
    private readonly promptEnricher?: PromptEnricher
  ) {}

  public start(sessionId: SessionId): void {
    const config = SelectorRegistry.resolve(window.location.href);
    if (!config) {
      console.warn('[GeminiAdapter] Platform configuration not found for URL.');
      return;
    }

    this.responseObserver = new ResponseObserver(this.eventBus, config, sessionId);
    this.typingObserver = new TypingObserver(this.eventBus, config, sessionId, this.gapEngine);
    this.ghostTextObserver = new GhostTextObserver(this.eventBus, config, sessionId);
    this.ghostTextMeasurementObserver = new GhostTextMeasurementObserver(this.eventBus, config, sessionId);
    this.readingObserver = new ReadingObserver(this.eventBus, config, sessionId);
    this.submitInterceptor = new SubmitInterceptor(this.eventBus, config, sessionId, this.promptEnricher);

    this.responseObserver.connect();
    this.typingObserver.connect();
    this.ghostTextObserver.connect();
    this.ghostTextMeasurementObserver.connect();
    this.readingObserver.connect();
    this.submitInterceptor.connect();

    console.log('[GeminiAdapter] Started observing Gemini via Composition Root.');
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
    if (this.ghostTextObserver) {
      this.ghostTextObserver.destroy();
      this.ghostTextObserver = null;
    }
    if (this.ghostTextMeasurementObserver) {
      this.ghostTextMeasurementObserver.destroy();
      this.ghostTextMeasurementObserver = null;
    }
    if (this.readingObserver) {
      this.readingObserver.destroy();
      this.readingObserver = null;
    }
    if (this.submitInterceptor) {
      this.submitInterceptor.destroy();
      this.submitInterceptor = null;
    }

    console.log('[GeminiAdapter] Stopped observing Gemini.');
  }
}
