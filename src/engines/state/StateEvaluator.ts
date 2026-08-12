import { StateSnapshot } from './StateSnapshot';
import { StateLabel } from '../../core/types/state.types';
import { StateEngineRules } from '../../core/config/state-rules-loader';

export interface StateEvaluation {
  readonly state: StateLabel;
  readonly confidence: number;
}

export class StateEvaluator {
  private static readonly COLD_START_CONFIDENCE = 0.4;
  private static readonly RULE_MATCH_CONFIDENCE = 0.7;

  constructor(private readonly rules: StateEngineRules) { }

  public evaluate(snapshot: StateSnapshot): StateEvaluation {
    const minSamples = this.rules.baseline?.minSamplesBeforeBaseline ?? 5;

    // Cold-start fallback if baseline is not yet established
    if (!this.rules.baseline || snapshot.sampleCount < minSamples || snapshot.baselineWpm <= 0) {
      return this.evaluateColdStart(snapshot);
    }

    const baseline = snapshot.baselineWpm;
    const wpm = snapshot.wordsPerMinute;
    const revisionThresholds = this.rules.thresholds.revisionRate;
    const pauseThresholds = this.rules.thresholds.pauseDurationMs;
    const { coastingAbovePercent, overloadBelowPercent, stretchTolerancePercent = 0.15 } = this.rules.baseline.wpmDeviation;

    // 1. Coasting Check: ~+20% WPM above baseline with low revision rate
    const coastingWpmThreshold = baseline * (1 + coastingAbovePercent);
    if (
      wpm >= coastingWpmThreshold &&
      snapshot.revisionRate < revisionThresholds.coasting
    ) {
      return { state: 'coasting', confidence: StateEvaluator.RULE_MATCH_CONFIDENCE };
    }

    // 2. Overload Check: ~-30% WPM below baseline AND heavy deletion
    const overloadWpmThreshold = baseline * (1 - overloadBelowPercent);
    if (
      wpm <= overloadWpmThreshold &&
      snapshot.revisionRate >= revisionThresholds.overload
    ) {
      return { state: 'overload', confidence: StateEvaluator.RULE_MATCH_CONFIDENCE };
    }

    // 3. Stretch Check: Productive zone (near baseline, low deletion, cognitive pauses)
    const isNearBaseline = Math.abs(wpm - baseline) / baseline <= stretchTolerancePercent;
    const isLowRevision = snapshot.revisionRate < revisionThresholds.stretch;
    const isLongPause = snapshot.pauseDurationMs >= pauseThresholds.stretch;

    if (isNearBaseline && isLowRevision && isLongPause) {
      return { state: 'stretch', confidence: StateEvaluator.RULE_MATCH_CONFIDENCE };
    }

    // Steady-state baseline interaction lacking explicit cognitive markers
    return { state: 'unknown', confidence: 0.0 };
  }

  private evaluateColdStart(snapshot: StateSnapshot): StateEvaluation {
    if (
      snapshot.typingVelocity > this.rules.thresholds.velocity.overload ||
      snapshot.revisionRate > this.rules.thresholds.revisionRate.overload
    ) {
      return { state: 'overload', confidence: StateEvaluator.COLD_START_CONFIDENCE };
    }

    if (
      snapshot.typingVelocity < this.rules.thresholds.velocity.coasting &&
      snapshot.revisionRate < this.rules.thresholds.revisionRate.coasting
    ) {
      return { state: 'coasting', confidence: StateEvaluator.COLD_START_CONFIDENCE };
    }

    return { state: 'unknown', confidence: 0.0 };
  }
}
