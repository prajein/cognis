import { DomainEvent, GapDetectedPayload, GhostTextAcceptedPayload, GhostTextDismissedPayload } from '../../../core/event-bus/contracts';
import { CognitiveEvents, GhostTextEvents, SessionEvents, EventType } from '../../../core/event-bus/registry';
import { ProjectionBuilder } from '../interfaces';
import { ReadModelRepository } from '../../repositories/ReadModelRepository';
import { GapType } from '../../../core/types/gap.types';

export interface GapProfileReadModel {
  projectionId: string; // e.g. "gap-profile-v1_SESSION_ID" or "gap-profile-v1_global"
  sessionId: string;
  gaps: Record<GapType, {
    detectedCount: number;
    acceptedCount: number;
    dismissedCount: number;
    lastDetectedAt: number;
    emaScore?: number; // Running EMA gap score (only maintained on the global model)
  }>;
  lastUpdated: number;
}

const ALL_GAP_TYPES: GapType[] = [
  'intentionality',
  'audience',
  'constraint',
  'stakes',
  'assumption',
  'mechanism',
  'temporal',
  'second_order'
];

export class GapProfileProjectionBuilder implements ProjectionBuilder {
  public readonly projectionId = 'gap-profile-v1';
  
  public readonly consumedEvents: ReadonlyArray<EventType> = [
    CognitiveEvents.GAP_DETECTED,
    GhostTextEvents.ACCEPTED,
    GhostTextEvents.DISMISSED,
    SessionEvents.ENDED
  ];

  constructor(private readonly repo: ReadModelRepository) {}

  public async handleEvent(event: DomainEvent<any>): Promise<void> {
    if (event.type === SessionEvents.ENDED) {
      await this.handleSessionEnded(event);
      return;
    }

    const sessionId = event.sessionId;
    const sessionModelId = `${this.projectionId}_${sessionId}`;
    const globalModelId = `${this.projectionId}_global`;

    // Retrieve session-specific and global models
    let sessionModel = await this.repo.get<GapProfileReadModel>(sessionModelId);
    let globalModel = await this.repo.get<GapProfileReadModel>(globalModelId);

    if (!sessionModel) {
      sessionModel = this.initializeModel(sessionModelId, sessionId, event.timestamp);
    }
    if (!globalModel) {
      globalModel = this.initializeModel(globalModelId, 'global', event.timestamp);
    }

    switch (event.type) {
      case CognitiveEvents.GAP_DETECTED: {
        const payload = event.payload as GapDetectedPayload;
        const gapType = payload.gapType;
        
        sessionModel.gaps[gapType].detectedCount++;
        sessionModel.gaps[gapType].lastDetectedAt = event.timestamp;
        
        globalModel.gaps[gapType].detectedCount++;
        globalModel.gaps[gapType].lastDetectedAt = event.timestamp;
        break;
      }
      case GhostTextEvents.ACCEPTED: {
        const payload = event.payload as GhostTextAcceptedPayload;
        const gapType = payload.gapType;
        
        sessionModel.gaps[gapType].acceptedCount++;
        globalModel.gaps[gapType].acceptedCount++;
        break;
      }
      case GhostTextEvents.DISMISSED: {
        const payload = event.payload as GhostTextDismissedPayload;
        // In contracts.ts, GhostTextDismissedPayload contains stem and reason.
        // We cannot map it back to a gap type easily unless the stem matches something in config,
        // or we scan. For now, since the payload doesn't contain gapType, we will record it under
        // all gaps or skip. Let's skip to avoid incorrect counts, which conforms to the code comment.
        break;
      }
    }

    sessionModel.lastUpdated = event.timestamp;
    globalModel.lastUpdated = event.timestamp;

    await this.repo.put(sessionModel);
    await this.repo.put(globalModel);
  }

  /**
   * Applies the Exponential Moving Average (EMA) decay to the global gap profile when a session ends.
   */
  private async handleSessionEnded(event: DomainEvent<any>): Promise<void> {
    const sessionId = event.sessionId;
    const sessionModelId = `${this.projectionId}_${sessionId}`;
    const globalModelId = `${this.projectionId}_global`;

    const sessionModel = await this.repo.get<GapProfileReadModel>(sessionModelId);
    let globalModel = await this.repo.get<GapProfileReadModel>(globalModelId);

    if (!globalModel) {
      globalModel = this.initializeModel(globalModelId, 'global', event.timestamp);
    }

    const decay = 0.15; // EMA decay rate from sprint plan

    for (const gapType of ALL_GAP_TYPES) {
      const sessionCount = sessionModel ? (sessionModel.gaps[gapType]?.detectedCount || 0) : 0;
      const currentEma = globalModel.gaps[gapType].emaScore || 0;
      
      // Compute the new EMA score: EMA = prevEMA * (1 - decay) + sessionCount * decay
      const newEma = currentEma * (1 - decay) + sessionCount * decay;
      
      globalModel.gaps[gapType].emaScore = parseFloat(newEma.toFixed(4));
    }

    globalModel.lastUpdated = event.timestamp;
    await this.repo.put(globalModel);
  }

  private initializeModel(projectionId: string, sessionId: string, timestamp: number): GapProfileReadModel {
    const gaps = {} as Record<GapType, any>;
    for (const gapType of ALL_GAP_TYPES) {
      gaps[gapType] = {
        detectedCount: 0,
        acceptedCount: 0,
        dismissedCount: 0,
        lastDetectedAt: 0,
        emaScore: 0
      };
    }

    return {
      projectionId,
      sessionId,
      gaps,
      lastUpdated: timestamp
    };
  }

  public async clear(): Promise<void> {
    // In a real system we would scan by prefix to delete all session read models
    const globalId = `${this.projectionId}_global`;
    await this.repo.delete(globalId);
    console.log(`[GapProfileProjectionBuilder] Global read model cleared.`);
  }
}
