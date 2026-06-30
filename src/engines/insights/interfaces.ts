import { TaxonomyDomain, InsightCandidate } from '../../core/types/insight.types';
import { EventBusContract } from '../../core/event-bus/types';

export interface ReasoningContext {
  readonly sessionId: string;
  readonly now: number;
  
  /**
   * Retrieves all historical event timestamps (ms) for a specific gap type or marker.
   * This represents the Evidence Collector abstraction for strategies.
   */
  getEventHistory(marker: string): number[];
}

export interface InsightStrategy {
  readonly version: string; // e.g. 'v1.0.0'
  readonly strategyName: string;
  readonly taxonomyDomains: ReadonlyArray<TaxonomyDomain>;
  
  /**
   * Evaluates the current context and returns potential insights.
   */
  execute(context: ReasoningContext): InsightCandidate[];
}

export interface IInsightEngine {
  start(eventBus: EventBusContract): void;
  stop(): void;
}
