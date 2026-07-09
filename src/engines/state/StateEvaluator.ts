import { StateSnapshot } from './StateSnapshot';
import { StateLabel } from '../../core/types/state.types';
import { StateEngineRules } from '../../core/config/state-rules-loader';

export class StateEvaluator {
  constructor(private readonly rules: StateEngineRules) {}

  public evaluate(snapshot: StateSnapshot): StateLabel {
    // 1. Overload Check: High velocity OR high revisions OR short pauses
    if (
      snapshot.typingVelocity > this.rules.thresholds.velocity.overload ||
      snapshot.revisionRate > this.rules.thresholds.revisionRate.overload
    ) {
      return 'overload';
    }

    // 2. Coasting Check: Low velocity AND few revisions
    if (
      snapshot.typingVelocity < this.rules.thresholds.velocity.coasting &&
      snapshot.revisionRate < this.rules.thresholds.revisionRate.coasting
    ) {
      return 'coasting';
    }

    // 3. Stretch Check: Default productive zone
    return 'stretch';
  }
}
