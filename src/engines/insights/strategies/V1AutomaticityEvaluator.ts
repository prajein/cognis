import { InsightStrategy, ReasoningContext } from '../interfaces';
import { TaxonomyDomain, InsightCandidate } from '../../../core/types/insight.types';
import { ConfidenceCalculator } from '../ConfidenceCalculator';

export class V1AutomaticityEvaluator implements InsightStrategy {
  public readonly version = 'v1.0.0';
  public readonly strategyName = 'V1AutomaticityEvaluator';
  public readonly taxonomyDomains: ReadonlyArray<TaxonomyDomain> = ['Automaticity'];

  private readonly calculator = new ConfidenceCalculator();

  public execute(context: ReasoningContext): InsightCandidate[] {
    // Automaticity inference unavailable: current telemetry does not contain 
    // sufficient skill-specific longitudinal evidence to support an automaticity claim.
    // (Note: No evidence ≠ no automaticity)
    //
    // To reinstate, this strategy requires:
    //   1. A mechanism to identify the skill domain the user is practising.
    //   2. Cross-session read models tracking gap acceptance trends per domain.
    //   3. A declining gap-detection trend across >= N sessions for a given skill.
    //
    // Returning [] is the honest response until those signals exist.
    // See: M7 architecture audit (2026-08-10).
    return [];
  }
}
