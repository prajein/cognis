import { ReadModelRepository } from '../../../storage/repositories/ReadModelRepository';
import { ReasoningContext } from '../interfaces';
import { SessionReadModel } from '../../../storage/projections/builders/SessionProjectionBuilder';
import { AutomaticityReadModel } from '../../../storage/projections/builders/AutomaticityProjectionBuilder';
import { GapProfileReadModel } from '../../../storage/projections/builders/GapProfileProjectionBuilder';
import { IdentityReadModel } from '../../../storage/projections/builders/IdentityProjectionBuilder';
import { ResponseMetricsReadModel } from '../../../storage/projections/builders/ResponseMetricsProjectionBuilder';

export class ReasoningContextBuilder {
  constructor(private readonly readModelRepo: ReadModelRepository) {}

  public async build(sessionId: string): Promise<ReasoningContext> {
    const now = Date.now();
    
    // Fetch all read models asynchronously in parallel (Performance budget: <10ms)
    const [
      sessionModel,
      automaticityModel,
      gapModel,
      identityModel,
      responseModel
    ] = await Promise.all([
      this.readModelRepo.get<SessionReadModel>(`session-v1_${sessionId}`),
      this.readModelRepo.get<AutomaticityReadModel>(`automaticity-v1_${sessionId}`),
      this.readModelRepo.get<GapProfileReadModel>(`gap-profile-v1_${sessionId}`),
      this.readModelRepo.get<IdentityReadModel>(`identity-v1_${sessionId}`),
      this.readModelRepo.get<ResponseMetricsReadModel>(`response-metrics-v1_${sessionId}`)
    ]);

    // Replace any missing projections with fully materialized Default Read Models.
    // Strategies will never have to perform null checks.
    return {
      sessionId,
      now,
      sessionMetrics: sessionModel ?? this.createDefaultSessionReadModel(sessionId, now),
      automaticityProfile: automaticityModel ?? this.createDefaultAutomaticityReadModel(sessionId, now),
      gapProfile: gapModel ?? this.createDefaultGapReadModel(sessionId, now),
      identityProfile: identityModel ?? this.createDefaultIdentityReadModel(sessionId, now),
      responseMetrics: responseModel ?? this.createDefaultResponseMetricsReadModel(sessionId, now),
    };
  }

  private createDefaultSessionReadModel(sessionId: string, now: number): SessionReadModel {
    return {
      projectionId: `session-v1_${sessionId}`,
      sessionId,
      platform: 'unknown',
      startTime: now,
      status: 'active',
      totalPauseDurationMs: 0,
      lastUpdated: now
    };
  }

  private createDefaultAutomaticityReadModel(sessionId: string, now: number): AutomaticityReadModel {
    return {
      projectionId: `automaticity-v1_${sessionId}`,
      sessionId,
      skills: {},
      lastUpdated: now
    };
  }

  private createDefaultGapReadModel(sessionId: string, now: number): GapProfileReadModel {
    const emptyGapState = {
      detectedCount: 0,
      displayedCount: 0,
      acceptedCount: 0,
      dismissedCount: 0,
      rejectionCount: 0,
      lastDetectedAt: 0
    };
    return {
      projectionId: `gap-profile-v1_${sessionId}`,
      sessionId,
      gaps: {
        'intentionality': { ...emptyGapState },
        'audience': { ...emptyGapState },
        'constraint': { ...emptyGapState },
        'stakes': { ...emptyGapState },
        'assumption': { ...emptyGapState },
        'mechanism': { ...emptyGapState },
        'temporal': { ...emptyGapState },
        'second_order': { ...emptyGapState }
      },
      lastUpdated: now
    };
  }

  private createDefaultIdentityReadModel(sessionId: string, now: number): IdentityReadModel {
    return {
      projectionId: `identity-v1_${sessionId}`,
      sessionId,
      insights: [],
      lastUpdated: now
    };
  }

  private createDefaultResponseMetricsReadModel(sessionId: string, now: number): ResponseMetricsReadModel {
    return {
      projectionId: `response-metrics-v1_${sessionId}`,
      sessionId,
      totalResponses: 0,
      sumQualityScore: 0,
      sumReasoningScore: 0,
      sumStructuralScore: 0,
      flagsFrequency: {},
      lastUpdated: now
    };
  }
}
