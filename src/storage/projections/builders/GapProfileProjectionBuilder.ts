import { DomainEvent, GapDetectedPayload, GhostTextAcceptedPayload, GhostTextDismissedPayload } from '../../../core/event-bus/contracts';
import { CognitiveEvents, GhostTextEvents, EventType } from '../../../core/event-bus/registry';
import { ProjectionBuilder } from '../interfaces';
import { ReadModelRepository } from '../../repositories/ReadModelRepository';
import { GapType } from '../../../core/types/gap.types';

export interface GapProfileReadModel {
  projectionId: string; // "gap-profile-v1_SESSION_ID"
  sessionId: string;
  gaps: Record<GapType, {
    detectedCount: number;
    acceptedCount: number;
    dismissedCount: number;
    lastDetectedAt: number;
  }>;
  lastUpdated: number;
}

export class GapProfileProjectionBuilder implements ProjectionBuilder {
  public readonly projectionId = 'gap-profile-v1';
  public readonly consumedEvents: ReadonlyArray<EventType> = [
    CognitiveEvents.GAP_DETECTED,
    GhostTextEvents.ACCEPTED,
    GhostTextEvents.DISMISSED
  ];

  constructor(private readonly repo: ReadModelRepository) {}

  public async handleEvent(event: DomainEvent<any>): Promise<void> {
    const id = `${this.projectionId}_${event.sessionId}`;
    
    let model = await this.repo.get<GapProfileReadModel>(id);

    if (!model) {
      model = {
        projectionId: id,
        sessionId: event.sessionId,
        gaps: {} as Record<GapType, any>,
        lastUpdated: event.timestamp
      };
    }

    const initGapType = (type: GapType) => {
      if (!model!.gaps[type]) {
        model!.gaps[type] = {
          detectedCount: 0,
          acceptedCount: 0,
          dismissedCount: 0,
          lastDetectedAt: 0
        };
      }
    };

    switch (event.type) {
      case CognitiveEvents.GAP_DETECTED: {
        const payload = event.payload as GapDetectedPayload;
        initGapType(payload.gapType);
        model.gaps[payload.gapType].detectedCount++;
        model.gaps[payload.gapType].lastDetectedAt = event.timestamp;
        break;
      }
      case GhostTextEvents.ACCEPTED: {
        const payload = event.payload as GhostTextAcceptedPayload;
        initGapType(payload.gapType);
        model.gaps[payload.gapType].acceptedCount++;
        break;
      }
      case GhostTextEvents.DISMISSED: {
        // We might not know the exact gap type that was dismissed from the payload in contracts.ts, 
        // but for now let's assume we can map it or it's recorded. Wait, contracts.ts says GhostTextDismissedPayload
        // only has `stem` and `reason`. We can't map to gapType easily without a broader lookup, 
        // so we'll skip incrementing dismissed gap specifically here unless the contract updates.
        break;
      }
    }

    model.lastUpdated = event.timestamp;
    await this.repo.put(model);
  }

  public async clear(): Promise<void> {
    console.warn(`[GapProfileProjectionBuilder] clear() not implemented for bulk deletion.`);
  }
}
