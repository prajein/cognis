import { StateLabel } from '../../core/types/state.types';
import { StateEngineRules } from '../../core/config/state-rules-loader';

export class TransitionPolicy {
  private currentState: StateLabel = 'stretch'; // default starting state
  private lastTransitionTime: number = 0;
  private sustainedState: StateLabel | null = null;
  private sustainedCount: number = 0;

  constructor(private readonly rules: StateEngineRules) {}

  public getCurrentState(): StateLabel {
    return this.currentState;
  }

  public reset(initialState: StateLabel = 'stretch'): void {
    this.currentState = initialState;
    this.lastTransitionTime = 0;
    this.sustainedState = null;
    this.sustainedCount = 0;
  }

  public approveTransition(proposedState: StateLabel, now: number): StateLabel | null {
    // 1. Cooldown Enforcement
    if (now - this.lastTransitionTime < this.rules.hysteresis.cooldownMs) {
      return null;
    }

    // 2. No-op if unchanged
    if (proposedState === this.currentState) {
      this.sustainedCount = 0;
      this.sustainedState = null;
      return null;
    }

    // 3. Sustained Measurement Enforcement
    if (proposedState === this.sustainedState) {
      this.sustainedCount++;
    } else {
      this.sustainedState = proposedState;
      this.sustainedCount = 1;
    }

    // 4. Approve transition if sustained
    if (this.sustainedCount >= this.rules.hysteresis.requiredSustainedMeasurements) {
      this.currentState = proposedState;
      this.lastTransitionTime = now;
      this.sustainedCount = 0;
      this.sustainedState = null;
      return proposedState;
    }

    return null;
  }
}
