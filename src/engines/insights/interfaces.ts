import { TaxonomyDomain, InsightCandidate } from '../../core/types/insight.types';
import { EventBusContract } from '../../core/event-bus/types';
import { SessionReadModel } from '../../storage/projections/builders/SessionProjectionBuilder';
import { AutomaticityReadModel } from '../../storage/projections/builders/AutomaticityProjectionBuilder';
import { GapProfileReadModel } from '../../storage/projections/builders/GapProfileProjectionBuilder';
import { IdentityReadModel } from '../../storage/projections/builders/IdentityProjectionBuilder';
import { ResponseMetricsReadModel } from '../../storage/projections/builders/ResponseMetricsProjectionBuilder';
import { GlobalAnalyticalProfileReadModel } from '../../storage/projections/builders/GlobalAnalyticalProfileProjectionBuilder';

export interface ReasoningContext {
  readonly sessionId: string;
  readonly now: number;
  
  // Fully materialized immutable read models
  readonly sessionMetrics: Readonly<SessionReadModel>;
  readonly automaticityProfile: Readonly<AutomaticityReadModel>;
  readonly gapProfile: Readonly<GapProfileReadModel>;
  readonly identityProfile: Readonly<IdentityReadModel>;
  readonly responseMetrics: Readonly<ResponseMetricsReadModel>;
  readonly globalAnalyticalProfile: Readonly<GlobalAnalyticalProfileReadModel>;
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

import { ReadModelRepository } from '../../storage/repositories/ReadModelRepository';

export interface IInsightEngine {
  start(eventBus: EventBusContract, readModelRepo: ReadModelRepository): void;
  stop(): void;
}
