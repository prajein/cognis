import { InsightStrategy, ReasoningContext } from '../interfaces';
import { TaxonomyDomain, InsightCandidate } from '../../../core/types/insight.types';
import { ConfidenceCalculator } from '../ConfidenceCalculator';

/**
 * V1ReasoningDepthEvaluator
 *
 * Domain: Reasoning
 *
 * SCOPE CHANGE FROM THE ORIGINAL DESIGN (see design rationale doc):
 * The original design proposed a linear-regression trend over per-response
 * `reasoningScore` values. That design is NOT implementable against the
 * confirmed ReasoningContext.getEventHistory(marker) contract, which returns
 * `readonly number[]` -- bare event timestamps, no payload access. There is
 * currently no way to retrieve `reasoningScore` per event through this API.
 *
 * Rather than ship code that claims to measure "depth" while actually
 * measuring something else, this version is descoped to a FREQUENCY-based
 * signal: the trend in how often the user has exchanges substantial enough
 * to trigger full response analysis (`response.analysis.completed`). This is
 * an honestly-labeled proxy for reasoning ENGAGEMENT, not reasoning QUALITY
 * or DEPTH -- the metadata and internal naming reflect this distinction
 * explicitly so it is never confused with the originally scoped signal.
 *
 * Once ReasoningContext exposes payload-level event access, this strategy
 * should be revisited and upgraded to the original score-trend design,
 * which is the more valuable signal.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const LOOKBACK_DAYS = 30;
const MIN_EVIDENCE_COUNT = 5;
const RESPONSE_ANALYSIS_MARKER = 'response.analysis.completed';

/** Minimum relative change in density required before claiming a trend (avoids reporting noise). */
const TREND_THRESHOLD = 0.25;

function spanDaysEndingAt(timestamps: readonly number[], end: number): number {
  if (timestamps.length === 0) return 1;
  const earliest = Math.min(...timestamps);
  return Math.max(1, (end - earliest) / MS_PER_DAY);
}

export class V1ReasoningDepthEvaluator implements InsightStrategy {
  public readonly version = 'v1.0.0';
  public readonly strategyName = 'V1ReasoningDepthEvaluator';
  public readonly taxonomyDomains: ReadonlyArray<TaxonomyDomain> = ['Reasoning'];

  private readonly calculator = new ConfidenceCalculator();

  public execute(context: ReasoningContext): InsightCandidate[] {
    const tracker = context.globalAnalyticalProfile.responseAnalysis;
    const earlierCount = tracker.historicalCount;
    const recent = tracker.recentTimestamps;
    const totalCount = earlierCount + recent.length;

    if (totalCount < MIN_EVIDENCE_COUNT) {
      return [];
    }

    const lookbackStart = context.now - LOOKBACK_DAYS * MS_PER_DAY;

    // Both a real recent sample AND a real historical baseline are required
    if (recent.length < MIN_EVIDENCE_COUNT || earlierCount < MIN_EVIDENCE_COUNT) {
      return [];
    }

    const recentDensity = recent.length / spanDaysEndingAt(recent, context.now);
    
    // Calculate historical span using the tracked earliest timestamp
    const earlierSpanDays = earlierCount === 0 ? 1 : Math.max(1, (lookbackStart - tracker.historicalEarliest) / MS_PER_DAY);
    const earlierDensity = earlierCount / earlierSpanDays;

    if (earlierDensity === 0) {
      return [];
    }

    const relativeChange = (recentDensity - earlierDensity) / earlierDensity;
    if (Math.abs(relativeChange) < TREND_THRESHOLD) {
      return []; // change too small to be a meaningful trend, not just noise
    }

    const isIncreasing = relativeChange > 0;

    const confidence = this.calculator.calculate(
      recent,
      MIN_EVIDENCE_COUNT,
      // Conservative baseline: per the WS1 baseline evaluation, ReasoningAnalyzer
      // is the lowest-accuracy of the four response analyzers on pure score
      // error. This strategy starts every insight from reduced trust as an
      // honest, blanket acknowledgment of known upstream measurement
      // uncertainty -- see design rationale doc, Confidence Calibration.
      0.6,
      false,
      earlierCount,
      context.now,
    );

    return [
      {
        id: crypto.randomUUID(),
        domain: 'Reasoning',
        title: isIncreasing
          ? 'Increasing engagement in reasoning-heavy exchanges'
          : 'Decreasing engagement in reasoning-heavy exchanges',
        summary: isIncreasing
          ? 'You have had a notably higher rate of in-depth AI exchanges recently compared to your earlier history.'
          : 'Your rate of in-depth AI exchanges has dropped recently compared to your earlier history.',
        confidence,
        evidenceCount: recent.length,
        metadata: {
          signalType: 'engagement_frequency', // explicitly NOT depth/quality -- see class doc
          relativeChange,
          recentDensity,
          earlierDensity,
        },
      },
    ];
  }
}
