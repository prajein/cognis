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
  /**
   * Weighted-evidence score (v0.2, [0, 1]) at or above which a gap is
   * considered addressed. Optional for backward compatibility with configs
   * (and test fixtures) predating the weighted matcher; defaults to 0.5 in
   * `GapHeuristics` when omitted.
   */
  readonly addressedThreshold?: number;
}

/**
 * A single evidence marker for a gap rule. Plain strings (the v0.1 shape)
 * are treated as full-weight (1.0) markers; the object form lets tuning
 * down-weight generic/ambiguous markers without a code change.
 */
export type MarkerEntry = string | { readonly marker: string; readonly weight?: number };

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
  /**
   * Evidence markers. Presence accumulates weighted evidence toward "this
   * gap is addressed" (v0.2); absence, or partial/near-miss evidence, feeds
   * a gap signal. See `GapHeuristics.matchScore`.
   */
  readonly satisfiedWhenAnyPresent: readonly MarkerEntry[];
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
