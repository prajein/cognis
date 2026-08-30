import { InsightStrategy, ReasoningContext } from '../interfaces';
import { TaxonomyDomain, InsightCandidate } from '../../../core/types/insight.types';
import { ConfidenceCalculator } from '../ConfidenceCalculator';
import { ALL_GAP_TYPES, buildGapMarker } from './gapEventMarkers';

/**
 * V1PromptingPatternEvaluator
 *
 * Domain: Prompting
 *
 * Signal: whether the user's overall prompt quality is improving over time,
 * inferred from a decline in TOTAL gap.detected frequency across all 8 gap
 * types combined. Declining frequency = fewer under-specified prompts =
 * improving prompt quality. This is distinct from V1GapResolutionEvaluator,
 * which reports per-gap-type chronic/improving patterns; this strategy
 * reports a single holistic trend across the user's prompting behavior as
 * a whole.
 *
 * EVIDENCE ACCESS NOTE: same constraint as V1GapResolutionEvaluator --
 * ReasoningContext.getEventHistory(marker) returns timestamps only, no
 * payload, so this strategy sums counts across the 8 per-gap-type composite
 * markers (see gapEventMarkers.ts) rather than filtering a single generic
 * 'gap.detected' history by payload.
 *
 * OUTPUT LANGUAGE NOTE: the RFC's example output references "sessions"
 * (e.g. "over the last 30 sessions"). Session boundaries are not
 * recoverable from bare timestamps via getEventHistory, so this strategy
 * reports over a fixed day-based window instead and says so explicitly in
 * the summary, rather than claiming a session count it cannot verify.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const LOOKBACK_DAYS = 30;
const MIN_EVIDENCE_COUNT = 5;

/** Minimum relative change in total gap frequency required to claim a trend. */
const TREND_THRESHOLD = 0.25;

function spanDaysEndingAt(timestamps: readonly number[], end: number): number {
  if (timestamps.length === 0) return 1;
  const earliest = Math.min(...timestamps);
  return Math.max(1, (end - earliest) / MS_PER_DAY);
}

export class V1PromptingPatternEvaluator implements InsightStrategy {
  public readonly version = 'v1.0.0';
  public readonly strategyName = 'V1PromptingPatternEvaluator';
  public readonly taxonomyDomains: ReadonlyArray<TaxonomyDomain> = ['Prompting'];

  private readonly calculator = new ConfidenceCalculator();

  public execute(context: ReasoningContext): InsightCandidate[] {
    const lookbackStart = context.now - LOOKBACK_DAYS * MS_PER_DAY;

    // Aggregate all gap types into one combined timeline -- this strategy
    // cares about overall prompting quality, not any single gap category.
    const allTimestamps: number[] = [];
    for (const gapType of ALL_GAP_TYPES) {
      allTimestamps.push(...context.getEventHistory(buildGapMarker(gapType)));
    }

    if (allTimestamps.length < MIN_EVIDENCE_COUNT) {
      return []; // not enough total gap history to say anything about a trend
    }

    const recent = allTimestamps.filter((t) => t >= lookbackStart);
    const earlier = allTimestamps.filter((t) => t < lookbackStart);

    if (recent.length < MIN_EVIDENCE_COUNT || earlier.length < MIN_EVIDENCE_COUNT) {
      return []; // need a real sample on both sides of the window to claim a trend
    }

    const recentDensity = recent.length / spanDaysEndingAt(recent, context.now);
    const earlierDensity = earlier.length / spanDaysEndingAt(earlier, lookbackStart);

    if (earlierDensity === 0) {
      return [];
    }

    const relativeChange = (recentDensity - earlierDensity) / earlierDensity;
    if (Math.abs(relativeChange) < TREND_THRESHOLD) {
      return []; // change too small to be a meaningful trend
    }

    const isImproving = relativeChange < 0; // declining gap frequency = improving prompt quality
    const percentChange = Math.round(Math.abs(relativeChange) * 100);

    const confidence = this.calculator.calculate(
      recent,
      MIN_EVIDENCE_COUNT,
      0.75,
      false,
      earlier.length,
      context.now,
    );

    return [
      {
        id: crypto.randomUUID(),
        domain: 'Prompting',
        title: isImproving
          ? 'Prompt specificity is improving'
          : 'Prompt specificity is declining',
        summary: isImproving
          ? `Your prompts have become approximately ${percentChange}% more specific over the last ${LOOKBACK_DAYS} days, based on a drop in detected context gaps.`
          : `Your prompts have shown approximately ${percentChange}% more under-specification over the last ${LOOKBACK_DAYS} days, based on a rise in detected context gaps.`,
        confidence,
        evidenceCount: recent.length,
        metadata: {
          signalType: 'aggregate_gap_frequency',
          isImproving,
          percentChange,
          recentDensity,
          earlierDensity,
          windowDays: LOOKBACK_DAYS,
        },
      },
    ];
  }
}
