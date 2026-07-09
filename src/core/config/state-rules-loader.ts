import rules from './state_engine_rules.json';

export interface StateThresholds {
  coasting: number;
  stretch: number;
  overload: number;
}

export interface StateEngineHysteresis {
  cooldownMs: number;
  requiredSustainedMeasurements: number;
}

export interface StateEngineRules {
  version: string;
  note?: string;
  thresholds: {
    velocity: StateThresholds;
    revisionRate: StateThresholds;
    pauseDurationMs: StateThresholds;
  };
  hysteresis: StateEngineHysteresis;
}

export class StateRulesLoader {
  public static load(): StateEngineRules {
    // In a full implementation, we could validate against the JSON schema here
    return rules as StateEngineRules;
  }
}
