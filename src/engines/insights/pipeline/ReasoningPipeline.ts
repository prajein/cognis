import { EventBusContract, createDomainEvent } from '../../../core/event-bus';
import { InsightEvents } from '../../../core/event-bus/registry';
import { InsightGeneratedPayload } from '../../../core/event-bus/contracts';
import { toSessionId } from '../../../core/types/session.types';
import { InsightStrategy } from '../interfaces';
import { InsightValidator } from '../InsightValidator';
import { ReasoningContextBuilder } from './ReasoningContextBuilder';

export class ReasoningPipeline {
  private readonly validator = new InsightValidator();

  constructor(
    private readonly eventBus: EventBusContract,
    private readonly contextBuilder: ReasoningContextBuilder,
    private readonly strategies: InsightStrategy[]
  ) {}

  /**
   * Executes the cognitive reasoning pipeline.
   * @param sessionId The session that triggered the evaluation.
   */
  public async execute(sessionId: string): Promise<void> {
    // 1. Context Builder asynchronously constructs fully materialized read models
    const context = await this.contextBuilder.build(sessionId);

    // 2. Execute Strategies synchronously and deterministically
    for (const strategy of this.strategies) {
      const candidates = strategy.execute(context);

      for (const candidate of candidates) {
        // 3. Insight Validator
        if (this.validator.isValid(candidate)) {
          // 4. Publisher
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

    const event = createDomainEvent(
      InsightEvents.GENERATED,
      toSessionId(sessionId),
      'InsightEngine',
      payload
    );

    this.eventBus.publish(InsightEvents.GENERATED, event);
  }
}
