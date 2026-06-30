import { EventBusContract } from '../../../core/event-bus/types';
import { InsightEvents } from '../../../core/event-bus/registry';
import { InsightGeneratedPayload } from '../../../core/event-bus/contracts';
import { EventId, SessionId, Timestamp } from '../../../core/types/session.types';
import { InsightStrategy, ReasoningContext } from '../interfaces';
import { InsightValidator } from '../InsightValidator';

export class ReasoningPipeline {
  private readonly validator = new InsightValidator();

  constructor(
    private readonly eventBus: EventBusContract,
    private readonly strategies: InsightStrategy[]
  ) {}

  /**
   * Executes the 8-stage cognitive reasoning pipeline.
   * @param sessionId The session that triggered the evaluation.
   */
  public execute(sessionId: string): void {
    const now = Date.now();

    // 1 & 2. Context Builder & Evidence Collector
    // In a real implementation, this would query the Read Models (Projection DB)
    // to build the context. For now, we mock the Context Builder.
    const context: ReasoningContext = {
      sessionId,
      now,
      getEventHistory: (marker: string) => {
        // Mock evidence: return some recent timestamps simulating events.
        if (marker === 'success:typescript') {
          return Array.from({ length: 25 }, (_, i) => now - (i * 1000 * 60 * 60 * 24)); // 25 days of success
        }
        return [];
      }
    };

    // 4, 5, 6. Execute Strategies (which encapsulate Signal Weighting, Confidence, Conflict)
    for (const strategy of this.strategies) {
      const candidates = strategy.execute(context);

      for (const candidate of candidates) {
        // 7. Insight Validator
        if (this.validator.isValid(candidate)) {
          // 8. Publisher
          this.publishInsight(sessionId, candidate);
        }
      }
    }
  }

  private publishInsight(sessionId: string, candidate: import('../../../core/types/insight.types').InsightCandidate): void {
    const payload: InsightGeneratedPayload = {
      insightId: candidate.id,
      domain: candidate.domain,
      title: candidate.title,
      summary: candidate.summary,
      confidence: candidate.confidence,
      evidenceCount: candidate.evidenceCount
    };

    this.eventBus.publish(InsightEvents.GENERATED, {
      id: crypto.randomUUID() as EventId,
      type: InsightEvents.GENERATED,
      timestamp: Date.now() as Timestamp,
      sessionId: sessionId as SessionId,
      source: 'InsightEngine',
      payload
    });
  }
}
