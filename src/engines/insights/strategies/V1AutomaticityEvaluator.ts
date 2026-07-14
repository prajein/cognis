import { InsightStrategy, ReasoningContext } from '../interfaces';
import { TaxonomyDomain, InsightCandidate } from '../../../core/types/insight.types';
import { ConfidenceCalculator } from '../ConfidenceCalculator';

export class V1AutomaticityEvaluator implements InsightStrategy {
  public readonly version = 'v1.0.0';
  public readonly strategyName = 'V1AutomaticityEvaluator';
  public readonly taxonomyDomains: ReadonlyArray<TaxonomyDomain> = ['Automaticity'];

  private readonly calculator = new ConfidenceCalculator();

  public execute(context: ReasoningContext): InsightCandidate[] {
    const candidates: InsightCandidate[] = [];
    
    // Evaluate TypeScript mastery progression as an example skill.
    // In a full implementation, this would iterate over known skills.
    
    // 1. Gather evidence from fully materialized Read Models
    const syntaxErrors = context.gapProfile.gaps['mechanism']?.detectedCount ?? 0;
    const successfulCompilationsCount = context.responseMetrics.totalResponses;

    // We synthesize an evidence array for the calculator based on the Read Model's metrics
    const simulatedRecentActivity = Array.from({ length: successfulCompilationsCount }, () => context.responseMetrics.lastUpdated);

    // Hysteresis & Thresholding: 
    // If the user has many recent successes and few errors, they are transitioning to Autonomous.
    
    // For V1, we simulate a simple heuristic:
    if (successfulCompilationsCount > 20 && syntaxErrors < 5) {
      
      const confidence = this.calculator.calculate(
        simulatedRecentActivity, 
        20, // required threshold
        0.9, // high baseline for this strong heuristic
        false, 
        0, 
        context.now
      );

      candidates.push({
        id: crypto.randomUUID(),
        domain: 'Automaticity',
        title: 'TypeScript Skill Progression',
        summary: 'User has transitioned to Autonomous phase for TypeScript syntax.',
        confidence,
        evidenceCount: successfulCompilationsCount,
        metadata: {
          skill: 'TypeScript',
          newPhase: 'Autonomous'
        }
      });
    }

    return candidates;
  }
}
