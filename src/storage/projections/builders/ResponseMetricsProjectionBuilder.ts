import { DomainEvent, ResponseAnalysisCompletedPayload } from '../../../core/event-bus/contracts';
import { ResponseEvents } from '../../../core/event-bus/registry';
import { ProjectionBuilder } from '../interfaces';
import { ReadModelRepository } from '../../repositories/ReadModelRepository';

/**
 * ResponseMetricsReadModel
 * 
 * Aggregates AI response quality over time.
 * Maintains absolute sums rather than floating-point averages 
 * to prevent calculation drift across thousands of sessions.
 */
export interface ResponseMetricsReadModel {
  readonly projectionId: string;
  readonly sessionId: string;
  readonly totalResponses: number;
  readonly sumQualityScore: number;
  readonly sumReasoningScore: number;
  readonly sumStructuralScore: number;
  readonly flagsFrequency: Record<string, number>;
  readonly lastUpdated: number;
}

export class ResponseMetricsProjectionBuilder implements ProjectionBuilder {
  public readonly projectionId = 'response-metrics-v1';
  public readonly consumedEvents = [ResponseEvents.ANALYSIS_COMPLETED];

  constructor(private readonly repo: ReadModelRepository) {}

  public async handleEvent(event: DomainEvent<ResponseAnalysisCompletedPayload>): Promise<void> {
    const id = `${this.projectionId}_${event.sessionId}`;

    await this.repo.update<ResponseMetricsReadModel>(id, (model) => {
      // Seed default if it doesn't exist
      const currentModel: ResponseMetricsReadModel = model ?? {
        projectionId: id,
        sessionId: event.sessionId,
        totalResponses: 0,
        sumQualityScore: 0,
        sumReasoningScore: 0,
        sumStructuralScore: 0,
        flagsFrequency: {},
        lastUpdated: 0
      };

      const payload = event.payload;

      return {
        ...currentModel,
        totalResponses: currentModel.totalResponses + 1,
        sumQualityScore: currentModel.sumQualityScore + payload.qualityScore,
        sumReasoningScore: currentModel.sumReasoningScore + payload.reasoningScore,
        sumStructuralScore: currentModel.sumStructuralScore + payload.structuralScore,
        flagsFrequency: this.mergeFlags(currentModel.flagsFrequency, payload.flags),
        lastUpdated: event.timestamp
      };
    });
  }

  public async clear(): Promise<void> {
    // During a full rebuild, the orchestrator should ideally clear specific projection keys
    // Since we suffix projectionId with sessionId, a clean wipe involves querying and deleting.
    // For now, since projection clearing logic depends on ProjectionManager, we provide a placeholder.
    // Note: A true clear would use cursor iteration on IndexedDB, which can be implemented 
    // in ReadModelRepository if needed.
  }

  private mergeFlags(
    currentFlags: Record<string, number>,
    newFlags: ReadonlyArray<string>
  ): Record<string, number> {
    const merged = { ...currentFlags };
    for (const flag of newFlags) {
      merged[flag] = (merged[flag] || 0) + 1;
    }
    return merged;
  }
}
