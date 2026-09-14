import { InsightStrategy, ReasoningContext } from '../interfaces';
import { TaxonomyDomain, InsightCandidate } from '../../../core/types/insight.types';
import { GapType } from '../../../core/types/gap.types';
import { ConfidenceCalculator } from '../ConfidenceCalculator';
import { ALL_GAP_TYPES, buildGapMarker, buildResolutionMarker } from './gapEventMarkers';

/**
 * V1GapResolutionEvaluator
 *
 * Domain: Gap
 *
 * Signal: identifies which cognitive gap types are chronic for a user
 * (recurring, largely unresolved) versus improving over time, based on
 * gap.detected frequency and ghosttext.accepted resolution correlation,
 * per gap type. See gapEventMarkers.ts for the shared marker convention
 * used by this strategy and V1PromptingPatternEvaluator.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const LOOKBACK_DAYS = 30;

/** Minimum total occurrences (any time) before a gap type is even considered. */
const MIN_EVIDENCE_COUNT = 5;

/** Occurrences-per-day within the lookback window above which a gap type reads as "chronic". */
const CHRONIC_DENSITY_THRESHOLD = 0.15; // ~5+ occurrences in the 30-day window

/** Recent density must fall to this fraction (or below) of historical density to call it "improving". */
const IMPROVEMENT_RATIO_THRESHOLD = 0.5;

/** Resolution ratio must stay below this to still call a pattern "chronic" (i.e., not mostly resolved). */
const RESOLUTION_RATIO_CEILING = 0.5;

function densityPerDay(timestamps: readonly number[], windowDays: number): number {
  return timestamps.length / windowDays;
}

/** Days spanned by a set of timestamps, ending at `end`. Never returns less than 1 (avoids div-by-zero). */
function spanDaysEndingAt(timestamps: readonly number[], end: number): number {
  if (timestamps.length === 0) return 1;
  const earliest = Math.min(...timestamps);
  return Math.max(1, (end - earliest) / MS_PER_DAY);
}

export class V1GapResolutionEvaluator implements InsightStrategy {
  public readonly version = 'v1.0.0';
  public readonly strategyName = 'V1GapResolutionEvaluator';
  public readonly taxonomyDomains: ReadonlyArray<TaxonomyDomain> = ['Gap'];

  private readonly calculator = new ConfidenceCalculator();

  public execute(context: ReasoningContext): InsightCandidate[] {
    const candidates: InsightCandidate[] = [];
    const lookbackStart = context.now - LOOKBACK_DAYS * MS_PER_DAY;

    for (const gapType of ALL_GAP_TYPES) {
      const candidate = this.evaluateGapType(gapType, context, lookbackStart);
      if (candidate) candidates.push(candidate);
    }

    return candidates;
  }

  private evaluateGapType(
    gapType: GapType,
    context: ReasoningContext,
    lookbackStart: number,
  ): InsightCandidate | null {
    const all = context.getEventHistory(buildGapMarker(gapType));
    if (all.length < MIN_EVIDENCE_COUNT) {
      return null; // not enough evidence, ever, to say anything meaningful
    }

    const recent = all.filter((t) => t >= lookbackStart);
    const earlier = all.filter((t) => t < lookbackStart);
    const recentDensity = densityPerDay(recent, LOOKBACK_DAYS);

    // --- Chronic path: enough recent evidence, still frequent, largely unresolved ---
    if (recent.length >= MIN_EVIDENCE_COUNT && recentDensity >= CHRONIC_DENSITY_THRESHOLD) {
      const resolutions = context
        .getEventHistory(buildResolutionMarker(gapType))
        .filter((t) => t >= lookbackStart);
      const resolutionRatio = resolutions.length / recent.length;

      if (resolutionRatio < RESOLUTION_RATIO_CEILING) {
        const confidence = this.calculator.calculate(
          recent,
          MIN_EVIDENCE_COUNT,
          0.8,
          false,
          earlier.length,
          context.now,
        );
        return {
          id: crypto.randomUUID(),
          domain: 'Gap',
          title: `Chronic gap: ${gapType}`,
          summary: `You have consistently under-specified ${gapType} in recent prompts, with limited evidence of resolution.`,
          confidence,
          evidenceCount: recent.length,
          metadata: {
            gapType,
            pattern: 'chronic',
            recentDensity,
            resolutionRatio,
            resolutionInferredNotExact: true,
          },
        };
      }
    }

    // --- Improving path: meaningful historical pattern, now clearly reduced ---
    if (earlier.length >= MIN_EVIDENCE_COUNT) {
      const historicalDensity = densityPerDay(earlier, spanDaysEndingAt(earlier, lookbackStart));
      const isMeaningfulHistory = historicalDensity >= CHRONIC_DENSITY_THRESHOLD;
      const hasDropped = recentDensity <= historicalDensity * IMPROVEMENT_RATIO_THRESHOLD;

      if (isMeaningfulHistory && hasDropped) {
        const confidence = this.calculator.calculate(
          earlier,
          MIN_EVIDENCE_COUNT,
          0.65,
          false,
          recent.length,
          context.now,
        );
        return {
          id: crypto.randomUUID(),
          domain: 'Gap',
          title: `Improving gap: ${gapType}`,
          summary: `Your prompts have shown a meaningful reduction in ${gapType} gaps compared to your earlier history.`,
          confidence,
          evidenceCount: earlier.length,
          metadata: {
            gapType,
            pattern: 'improving',
            recentDensity,
            historicalDensity,
          },
        };
      }
    }

    return null; // no notable pattern in either direction
  }
}
