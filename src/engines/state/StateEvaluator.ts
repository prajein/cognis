import { StateSnapshot } from './StateSnapshot';
import { StateLabel } from '../../core/types/state.types';
import { StateEngineRules } from '../../core/config/state-rules-loader';

export class StateEvaluator {
  constructor(private readonly rules: StateEngineRules) {}

  public evaluate(snapshot: StateSnapshot): StateLabel {
    const minSamples = this.rules.baseline?.minSamplesBeforeBaseline ?? 5;

    // Cold-start fallback if baseline is not yet established
    if (!this.rules.baseline || snapshot.sampleCount < minSamples || snapshot.baselineWpm <= 0) {
      return this.evaluateColdStart(snapshot);
    }

    const baseline = snapshot.baselineWpm;
    const wpm = snapshot.wordsPerMinute;
    const { coastingAbovePercent, overloadBelowPercent } = this.rules.baseline.wpmDeviation;

    // 1. Coasting Check: ~+20% WPM above baseline with low revision rate
    const coastingWpmThreshold = baseline * (1 + coastingAbovePercent);
    if (
      wpm >= coastingWpmThreshold &&
      snapshot.revisionRate < this.rules.thresholds.revisionRate.coasting
    ) {
      return 'coasting';
    }

    // 2. Overload Check: ~-30% WPM below baseline AND heavy deletion
    const overloadWpmThreshold = baseline * (1 - overloadBelowPercent);
    if (
      wpm <= overloadWpmThreshold &&
      snapshot.revisionRate >= this.rules.thresholds.revisionRate.stretch
    ) {
      return 'overload';
    }

    // 3. Stretch Check: Productive zone (near baseline, low deletion, cognitive pauses)
    return 'stretch';
  }

  private evaluateColdStart(snapshot: StateSnapshot): StateLabel {
    if (
      snapshot.typingVelocity > this.rules.thresholds.velocity.overload ||
      snapshot.revisionRate > this.rules.thresholds.revisionRate.overload
    ) {
      return 'overload';
    }

    if (
      snapshot.typingVelocity < this.rules.thresholds.velocity.coasting &&
      snapshot.revisionRate < this.rules.thresholds.revisionRate.coasting
    ) {
      return 'coasting';
    }

    return 'stretch';
  }
}
