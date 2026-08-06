import { DomainEvent, InsightGeneratedPayload } from '../../../core/event-bus/contracts';
import { InsightEvents } from '../../../core/event-bus/registry';
import { ProjectionBuilder } from '../interfaces';
import { ReadModelRepository } from '../../repositories/ReadModelRepository';
import { TaxonomyDomain } from '../../../core/types/insight.types';

export interface InsightReadModel {
  readonly projectionId: string;
  readonly sessionId: string;
  readonly insights: ReadonlyArray<{
    readonly id: string;
    readonly domain: TaxonomyDomain;
    readonly title: string;
    readonly summary: string;
    readonly confidence: number;
    readonly evidenceCount: number;
    readonly generatedAt: number;
  }>;
  readonly lastUpdated: number;
}

export class InsightProjectionBuilder implements ProjectionBuilder {
  public readonly projectionId = 'insight-v1';
  public readonly consumedEvents = [InsightEvents.GENERATED];

  constructor(private readonly repo: ReadModelRepository) {}

  public async handleEvent(event: DomainEvent<InsightGeneratedPayload>): Promise<void> {
    const id = `${this.projectionId}_${event.sessionId}`;

    await this.repo.update<InsightReadModel>(id, (model) => {
      const currentModel: InsightReadModel = model ?? {
        projectionId: id,
        sessionId: event.sessionId,
        insights: [],
        lastUpdated: 0
      };

      const payload = event.payload;

      const newInsight = {
        id: payload.insightId,
        domain: payload.domain,
        title: payload.title,
        summary: payload.summary,
        confidence: payload.confidence,
        evidenceCount: payload.evidenceCount,
        generatedAt: event.timestamp
      };

      // Ensure we don't duplicate insights by ID (idempotency)
      const exists = currentModel.insights.some(i => i.id === newInsight.id);
      
      const newInsights = exists
        ? currentModel.insights
        : [...currentModel.insights, newInsight];

      return {
        ...currentModel,
        insights: newInsights,
        lastUpdated: event.timestamp
      };
    });
  }

  public async clear(): Promise<void> {
    // A true clear would use cursor iteration on IndexedDB.
  }
}
