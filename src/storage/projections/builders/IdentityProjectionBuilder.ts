import { DomainEvent, InsightGeneratedPayload, SessionOnboardingCompletedPayload } from '../../../core/event-bus/contracts';
import { InsightEvents, SessionEvents, EventType } from '../../../core/event-bus/registry';
import { ProjectionBuilder } from '../interfaces';
import { ReadModelRepository } from '../../repositories/ReadModelRepository';

export interface IdentityReadModel {
  projectionId: string; // e.g. "identity-v1_SESSION_ID" or "identity-v1_global"
  sessionId: string;
  insights: Array<{
    type: string;
    summary: string;
    timestamp: number;
  }>;
  onboarding?: {
    environment: string;
    goal: string;
    exhausting: string;
    completedAt: number;
  };
  lastUpdated: number;
}

export class IdentityProjectionBuilder implements ProjectionBuilder {
  public readonly projectionId = 'identity-v1';
  
  public readonly consumedEvents: ReadonlyArray<EventType> = [
    InsightEvents.GENERATED,
    SessionEvents.ONBOARDING_COMPLETED
  ];

  constructor(private readonly repo: ReadModelRepository) {}

  public async handleEvent(event: DomainEvent<any>): Promise<void> {
    const id = `${this.projectionId}_global`; // Seed a global profile rather than per-session, as Identity is a long-term user profile
    
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
      const existing = model.insights.find(i => i.timestamp === event.timestamp && i.type === payload.domain);
      if (!existing) {
        model.insights.push({
          type: payload.domain,
          summary: payload.summary,
          timestamp: event.timestamp
        });
      }
    } else if (event.type === SessionEvents.ONBOARDING_COMPLETED) {
      const payload = event.payload as SessionOnboardingCompletedPayload;
      model.onboarding = {
        environment: payload.environment,
        goal: payload.goal,
        exhausting: payload.exhausting,
        completedAt: event.timestamp
      };
    }

    model.lastUpdated = event.timestamp;
    await this.repo.put(model);
  }

  public async clear(): Promise<void> {
    const id = `${this.projectionId}_global`;
    await this.repo.delete(id);
    console.log(`[IdentityProjectionBuilder] Read model cleared.`);
  }
}
