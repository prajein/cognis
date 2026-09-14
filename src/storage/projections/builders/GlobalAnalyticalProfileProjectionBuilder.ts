import { DomainEvent } from '../../../core/event-bus/contracts';
import { CognitiveEvents, GhostTextEvents, ResponseEvents, EventType } from '../../../core/event-bus/registry';
import { ProjectionBuilder } from '../interfaces';
import { ReadModelRepository } from '../../repositories/ReadModelRepository';
import { GapType } from '../../../core/types/gap.types';

export interface BoundedHistoryTracker {
  historicalCount: number;
  historicalEarliest: number;
  recentTimestamps: number[];
}

export interface GlobalAnalyticalProfileReadModel {
  projectionId: string;
  responseAnalysis: BoundedHistoryTracker;
  gaps: Record<GapType, {
    detection: BoundedHistoryTracker;
    resolution: BoundedHistoryTracker;
  }>;
  lastUpdated: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const LOOKBACK_DAYS = 30;

export class GlobalAnalyticalProfileProjectionBuilder implements ProjectionBuilder {
  public readonly projectionId = 'global-analytical-profile-v1';
  public readonly consumedEvents: ReadonlyArray<EventType> = [
    ResponseEvents.ANALYSIS_COMPLETED,
    CognitiveEvents.GAP_DETECTED,
    GhostTextEvents.ACCEPTED
  ];

  constructor(private readonly repo: ReadModelRepository) {}

  public async handleEvent(event: DomainEvent<any>): Promise<void> {
    const id = this.projectionId; // Global scope, not session scoped!
    
    let model = await this.repo.get<GlobalAnalyticalProfileReadModel>(id);

    if (!model) {
      model = this.createDefaultModel(event.timestamp);
    }

    const now = event.timestamp;

    switch (event.type) {
      case ResponseEvents.ANALYSIS_COMPLETED: {
        this.trackEvent(model.responseAnalysis, now);
        break;
      }
      case CognitiveEvents.GAP_DETECTED: {
        const payload = event.payload;
        if (payload.gapType) {
          this.ensureGapType(model, payload.gapType);
          this.trackEvent(model.gaps[payload.gapType as GapType].detection, now);
        }
        break;
      }
      case GhostTextEvents.ACCEPTED: {
        const payload = event.payload;
        if (payload.gapType) {
          this.ensureGapType(model, payload.gapType);
          this.trackEvent(model.gaps[payload.gapType as GapType].resolution, now);
        }
        break;
      }
    }

    // Prune all trackers in the model against `now`
    this.pruneAllTrackers(model, now);

    model.lastUpdated = now;
    await this.repo.put(model);
  }

  public async clear(): Promise<void> {
    console.warn(`[GlobalAnalyticalProfileProjectionBuilder] clear() not implemented for bulk deletion.`);
  }

  private createDefaultModel(now: number): GlobalAnalyticalProfileReadModel {
    return {
      projectionId: this.projectionId,
      responseAnalysis: this.createEmptyTracker(),
      gaps: {} as Record<GapType, any>,
      lastUpdated: now
    };
  }

  private createEmptyTracker(): BoundedHistoryTracker {
    return {
      historicalCount: 0,
      historicalEarliest: 0,
      recentTimestamps: []
    };
  }

  private ensureGapType(model: GlobalAnalyticalProfileReadModel, type: GapType): void {
    if (!model.gaps[type]) {
      model.gaps[type] = {
        detection: this.createEmptyTracker(),
        resolution: this.createEmptyTracker()
      };
    }
  }

  /**
   * Pushes the new event into the tracker.
   * Note: The pruning phase actually maintains the invariants.
   */
  private trackEvent(tracker: BoundedHistoryTracker, timestamp: number): void {
    if (tracker.historicalEarliest === 0) {
      tracker.historicalEarliest = timestamp;
    }
    tracker.recentTimestamps.push(timestamp);
  }

  /**
   * Enforces the bounded 30-day window across all trackers.
   * Any timestamp older than `now - 30 days` is removed from `recentTimestamps`
   * and increments `historicalCount`.
   */
  private pruneAllTrackers(model: GlobalAnalyticalProfileReadModel, now: number): void {
    this.pruneTracker(model.responseAnalysis, now);
    for (const gapType of Object.keys(model.gaps) as GapType[]) {
      this.pruneTracker(model.gaps[gapType as GapType].detection, now);
      this.pruneTracker(model.gaps[gapType as GapType].resolution, now);
    }
  }

  private pruneTracker(tracker: BoundedHistoryTracker, now: number): void {
    const cutoff = now - (LOOKBACK_DAYS * MS_PER_DAY);
    const stillRecent: number[] = [];

    // Sort to guarantee monotonicity if out-of-order events arrived
    tracker.recentTimestamps.sort((a, b) => a - b);

    for (const t of tracker.recentTimestamps) {
      if (t < cutoff) {
        tracker.historicalCount++;
      } else {
        stillRecent.push(t);
      }
    }
    tracker.recentTimestamps = stillRecent;
  }
}
