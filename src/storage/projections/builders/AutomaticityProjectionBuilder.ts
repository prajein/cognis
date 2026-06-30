import { DomainEvent, AutomaticityUpdatedPayload } from '../../../core/event-bus/contracts';
import { InsightEvents, EventType } from '../../../core/event-bus/registry';
import { ProjectionBuilder } from '../interfaces';
import { ReadModelRepository } from '../../repositories/ReadModelRepository';

export interface AutomaticityReadModel {
  projectionId: string; // "automaticity-v1_SESSION_ID"
  sessionId: string;
  skills: Record<string, {
    currentPhase: string;
    currentScore: number;
    history: Array<{ phase: string; score: number; timestamp: number }>;
  }>;
  lastUpdated: number;
}

export class AutomaticityProjectionBuilder implements ProjectionBuilder {
  public readonly projectionId = 'automaticity-v1';
  public readonly consumedEvents: ReadonlyArray<EventType> = [
    InsightEvents.AUTOMATICITY_UPDATED
  ];

  constructor(private readonly repo: ReadModelRepository) {}

  public async handleEvent(event: DomainEvent<any>): Promise<void> {
    const id = `${this.projectionId}_${event.sessionId}`;
    
    let model = await this.repo.get<AutomaticityReadModel>(id);

    if (!model) {
      model = {
        projectionId: id,
        sessionId: event.sessionId,
        skills: {},
        lastUpdated: event.timestamp
      };
    }

    if (event.type === InsightEvents.AUTOMATICITY_UPDATED) {
      const payload = event.payload as AutomaticityUpdatedPayload;
      
      if (!model.skills[payload.skillDomain]) {
        model.skills[payload.skillDomain] = {
          currentPhase: payload.currentPhase,
          currentScore: payload.score,
          history: []
        };
      }

      // Enforce idempotency
      const history = model.skills[payload.skillDomain].history;
      const alreadyRecorded = history.find(h => h.timestamp === event.timestamp);

      if (!alreadyRecorded) {
        model.skills[payload.skillDomain].currentPhase = payload.currentPhase;
        model.skills[payload.skillDomain].currentScore = payload.score;
        history.push({
          phase: payload.currentPhase,
          score: payload.score,
          timestamp: event.timestamp
        });
      }
    }

    model.lastUpdated = event.timestamp;
    await this.repo.put(model);
  }

  public async clear(): Promise<void> {
    console.warn(`[AutomaticityProjectionBuilder] clear() not implemented for bulk deletion.`);
  }
}
