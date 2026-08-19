import { InsightStrategy, ReasoningContext } from '../interfaces';
import { TaxonomyDomain, InsightCandidate } from '../../../core/types/insight.types';
import { ConfidenceCalculator } from '../ConfidenceCalculator';
import { GapType } from '../../../core/types/gap.types';

/** Matches InsightValidator.MINIMUM_EVIDENCE — below this, a trend is noise. */
const MIN_DETECTED_COUNT = 5;
/** Dismissed at least this often (of shown) counts as "not landing". */
const HIGH_REJECTION_RATIO = 0.7;
/** Dismissed at most this often (of shown) counts as "landing". */
const LOW_REJECTION_RATIO = 0.2;

/**
 * FormulationGapTrendStrategy
 *
 * What & why: the Gap Detection Engine already tracks, per gap type, how many
 * times a gap was detected/displayed/accepted/dismissed this session
 * (`GapProfileReadModel`). This strategy is the first pass at reading a
 * *trend* out of that existing data — no new read model needed — rather than
 * treating each detection as an isolated event: is a recurring gap nudge
 * actually changing behavior, or is the user tuning it out?
 *
 * Two directions, both requiring `MIN_DETECTED_COUNT` occurrences so a single
 * detection can't masquerade as a trend (the same evidence bar
 * `InsightValidator` already enforces):
 *   - High rejection ratio: the same gap keeps getting flagged and dismissed
 *     — the nudge isn't working for this gap type.
 *   - Low rejection ratio (with at least one acceptance): the user is
 *     starting to engage with nudges for this gap type — an early habit
 *     signal.
 *
 * Confidence reuses `ConfidenceCalculator` by treating the detection count as
 * repeated same-age evidence (we only have an aggregate `lastDetectedAt`, not
 * per-event timestamps, in the read model) — a reasonable approximation, not
 * a precise decay curve.
 */
export class FormulationGapTrendStrategy implements InsightStrategy {
  public readonly version = 'v1.0.0';
  public readonly strategyName = 'FormulationGapTrendStrategy';
  public readonly taxonomyDomains: ReadonlyArray<TaxonomyDomain> = ['Gap', 'Prompting'];

  private readonly calculator = new ConfidenceCalculator();

  public execute(context: ReasoningContext): InsightCandidate[] {
    const candidates: InsightCandidate[] = [];
    const { gaps } = context.gapProfile;

    for (const gapType of Object.keys(gaps) as GapType[]) {
      const stat = gaps[gapType];
      if (!stat || stat.detectedCount < MIN_DETECTED_COUNT || stat.displayedCount === 0) {
        // Not enough signal to call this a trend — the honest v1 stance,
        // matching V1AutomaticityEvaluator's "no evidence != no automaticity".
        continue;
      }

      const rejectionRatio = stat.rejectionCount / stat.displayedCount;
      const acceptanceRatio = stat.acceptedCount / stat.displayedCount;
      // Approximation: the read model only retains the latest detection
      // timestamp, not one per occurrence, so treat every detection as
      // evidence at that single age.
      const evidence = new Array(stat.detectedCount).fill(stat.lastDetectedAt);

      if (rejectionRatio >= HIGH_REJECTION_RATIO) {
        const confidence = this.calculator.calculate(
          evidence,
          MIN_DETECTED_COUNT,
          rejectionRatio,
          false,
          0,
          context.now,
        );
        candidates.push({
          id: `formulation-gap-trend_${context.sessionId}_${gapType}_recurring`,
          domain: 'Gap',
          title: `Recurring blind spot: ${gapType}`,
          summary:
            `The ${gapType} gap has been detected ${stat.detectedCount} times this session and ` +
            `dismissed ${Math.round(rejectionRatio * 100)}% of the times it was shown — this nudge isn't landing.`,
          confidence,
          evidenceCount: stat.detectedCount,
          metadata: { gapType, rejectionRatio, detectedCount: stat.detectedCount },
        });
      } else if (rejectionRatio <= LOW_REJECTION_RATIO && acceptanceRatio > 0) {
        const confidence = this.calculator.calculate(
          evidence,
          MIN_DETECTED_COUNT,
          acceptanceRatio,
          false,
          0,
          context.now,
        );
        candidates.push({
          id: `formulation-gap-trend_${context.sessionId}_${gapType}_forming`,
          domain: 'Prompting',
          title: `Forming habit: addressing ${gapType}`,
          summary:
            `The ${gapType} gap has been detected ${stat.detectedCount} times this session and ` +
            `accepted ${Math.round(acceptanceRatio * 100)}% of the times it was shown — this nudge is landing.`,
          confidence,
          evidenceCount: stat.detectedCount,
          metadata: { gapType, acceptanceRatio, detectedCount: stat.detectedCount },
        });
      }
    }

    return candidates;
  }
}
