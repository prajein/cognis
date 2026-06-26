/**
 * Gap Rules Loader
 *
 * What & why: loads the versioned, on-device gap-detection rule set from
 * `gap_rules.json` at runtime and exposes it through a typed API. The Gap
 * Detection engine reads its thresholds, markers and weights from here so that
 * tuning the rules never requires a code change (Engineering Constitution:
 * "never hardcode numbers or text"; "config loads at runtime").
 *
 * Mirrors the activation-profile-loader pattern for consistency.
 */

import gapRulesJson from "./gap_rules.json";
import { StateLabel } from "../types/state.types";
import { GapType } from "../types/gap.types";

// ---------------------------------------------------------------------------
// Config Types
// ---------------------------------------------------------------------------

/** Tunable, config-driven knobs for gap detection. */
export interface GapRuleSettings {
  /** Minimum prompt length (chars) before text rules run. */
  readonly minTextLength: number;
  /** Minimum confidence required to emit a gap signal. */
  readonly emitThreshold: number;
  /** Maximum gap signals emitted per analysis pass. */
  readonly maxSignals: number;
  /** Pause duration (ms) that marks a cognitive pause (ghost-text trigger). */
  readonly cognitivePauseMs: number;
}

/** Additive confidence adjustment per cognitive state. */
export type StateModifiers = Readonly<Record<StateLabel, number>>;

/** Additive confidence adjustment derived from revision depth. */
export interface RevisionModifier {
  readonly perRevision: number;
  readonly max: number;
}

/** A single gap-type rule. */
export interface GapRule {
  readonly gapType: GapType;
  /** Confidence when the gap is present, before modifiers. */
  readonly baseConfidence: number;
  /** If any marker appears in the prompt, the gap is considered addressed. */
  readonly satisfiedWhenAnyPresent: readonly string[];
}

/** Root gap-rules configuration. */
export interface GapRulesConfig {
  readonly version: string;
  readonly note?: string;
  readonly settings: GapRuleSettings;
  readonly stateModifiers: StateModifiers;
  readonly revisionModifier: RevisionModifier;
  readonly rules: readonly GapRule[];
}

// ---------------------------------------------------------------------------
// Loaded Config
// ---------------------------------------------------------------------------

const gapRulesConfig: GapRulesConfig = gapRulesJson as GapRulesConfig;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns the complete gap-rules configuration. */
export function getGapRulesConfig(): GapRulesConfig {
  return gapRulesConfig;
}

/** Returns the tunable settings block. */
export function getGapRuleSettings(): GapRuleSettings {
  return gapRulesConfig.settings;
}

/** Returns every gap rule in taxonomy order. */
export function getGapRules(): readonly GapRule[] {
  return gapRulesConfig.rules;
}

/** Returns the rule for a specific gap type, if defined. */
export function getGapRule(gapType: GapType): GapRule | undefined {
  return gapRulesConfig.rules.find((rule) => rule.gapType === gapType);
}

/** Returns the per-state additive confidence modifiers. */
export function getStateModifiers(): StateModifiers {
  return gapRulesConfig.stateModifiers;
}

/** Returns the revision-depth confidence modifier. */
export function getRevisionModifier(): RevisionModifier {
  return gapRulesConfig.revisionModifier;
}
