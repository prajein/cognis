import { DomainEvent, InsightGeneratedPayload } from '../../../core/event-bus/contracts';
import { InsightEvents, EventType } from '../../../core/event-bus/registry';
import { ProjectionBuilder } from '../interfaces';
import { ReadModelRepository } from '../../repositories/ReadModelRepository';

export interface IdentityReadModel {
  projectionId: string;
  sessionId: string;
  insights: Array<{
    type: string;
    summary: string;
    timestamp: number;
  }>;
  lastUpdated: number;
}

export class IdentityProjectionBuilder implements ProjectionBuilder {
  public readonly projectionId = 'identity-v1';
  // Simplified for this milestone: just tracking insights to form identity
  public readonly consumedEvents: ReadonlyArray<EventType> = [
    InsightEvents.GENERATED
  ];

  constructor(private readonly repo: ReadModelRepository) {}

  public async handleEvent(event: DomainEvent<any>): Promise<void> {
    const id = `${this.projectionId}_${event.sessionId}`;
    
    let model = await this.repo.get<IdentityReadModel>(id);

    if (!model) {
      model = {
        projectionId: id,
        sessionId: event.sessionId,
        insights: [],
        lastUpdated: event.timestamp
      };
    }

    if (event.type === InsightEvents.GENERATED) {
      const payload = event.payload as InsightGeneratedPayload;
      
      // Enforce idempotency: prevent adding the same insight event twice during replay
      const existing = model.insights.find(i => i.timestamp === event.timestamp && i.type === payload.insightType);
      if (!existing) {
        model.insights.push({
          type: payload.insightType,
          summary: payload.summary,
          timestamp: event.timestamp
        });
      }
    }

    model.lastUpdated = event.timestamp;
    await this.repo.put(model);
  }

  public async clear(): Promise<void> {
    console.warn(`[IdentityProjectionBuilder] clear() not implemented for bulk deletion.`);
  }
}
