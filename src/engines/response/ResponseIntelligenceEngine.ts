import { EventBusContract } from '../../core/event-bus/types';
import { ResponseEvents } from '../../core/event-bus/registry';
import { DomainEvent } from '../../core/event-bus/contracts';
import { ResponseIntelligenceEngine as IResponseIntelligenceEngine } from './interfaces';
import { ReconstructorBuffer } from './ReconstructorBuffer';
import { AnalysisPipeline } from './pipeline/AnalysisPipeline';

export class ResponseIntelligenceEngine implements IResponseIntelligenceEngine {
  private eventBus: EventBusContract | null = null;
  private pipeline: AnalysisPipeline | null = null;
  
  // Map of sessionId -> ReconstructorBuffer
  private activeBuffers = new Map<string, ReconstructorBuffer>();
  private unsubscribeHandlers: Array<() => void> = [];

  public start(eventBus: EventBusContract): void {
    if (this.eventBus) return; // Already started
    
    this.eventBus = eventBus;
    this.pipeline = new AnalysisPipeline(eventBus);

    // Subscribe to response streaming events
    this.unsubscribeHandlers.push(
      eventBus.subscribe(ResponseEvents.STARTED, this.handleStarted.bind(this))
    );
    this.unsubscribeHandlers.push(
      eventBus.subscribe(ResponseEvents.CHUNK, this.handleChunk.bind(this))
    );
    this.unsubscribeHandlers.push(
      eventBus.subscribe(ResponseEvents.COMPLETED, this.handleCompleted.bind(this))
    );
    this.unsubscribeHandlers.push(
      eventBus.subscribe(ResponseEvents.ABANDONED, this.handleAbandoned.bind(this))
    );
  }

  public stop(): void {
    // Unsubscribe from EventBus
    for (const unsubscribe of this.unsubscribeHandlers) {
      unsubscribe();
    }
    this.unsubscribeHandlers = [];
    this.eventBus = null;
    this.pipeline = null;

    // Explicitly destroy all buffers for memory safety
    for (const buffer of this.activeBuffers.values()) {
      buffer.destroy();
    }
    this.activeBuffers.clear();
  }

  private handleStarted(event: DomainEvent<any>): void {
    const { sessionId, payload } = event;
    const { promptHash } = payload;
    
    if (!this.pipeline) return;

    // Initialize a new buffer for this session
    if (this.activeBuffers.has(sessionId)) {
      // Clean up zombie buffer if it exists
      this.activeBuffers.get(sessionId)?.destroy();
    }

    const buffer = new ReconstructorBuffer(
      sessionId,
      promptHash,
      this.pipeline,
      (completedSessionId) => {
        this.activeBuffers.delete(completedSessionId);
      }
    );

    this.activeBuffers.set(sessionId, buffer);
  }

  private handleChunk(event: DomainEvent<any>): void {
    const { sessionId, payload } = event;
    const buffer = this.activeBuffers.get(sessionId);
    
    if (!buffer) return; // Ignore if no buffer exists (fail-safe for restarts)
    
    // Per ADR-019, chunkText is transient and only present during sync dispatch
    if (payload.chunkText) {
      buffer.append(payload.chunkText);
    }
  }

  private handleCompleted(event: DomainEvent<any>): void {
    const { sessionId } = event;
    const buffer = this.activeBuffers.get(sessionId);
    
    if (buffer) {
      buffer.seal(); // This triggers analysis and subsequent destruction
    }
  }

  private handleAbandoned(event: DomainEvent<any>): void {
    const { sessionId } = event;
    const buffer = this.activeBuffers.get(sessionId);
    
    if (buffer) {
      buffer.abandon('user_abandoned'); // Discards without analysis
    }
  }
}
