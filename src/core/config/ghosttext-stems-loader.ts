/**
 * Ghost Text Stems Loader
 *
 * What & why: loads the versioned ghost-text stem templates from
 * `ghosttext_stems.json` at runtime and exposes them through a typed API. The
 * Ghost Text engine reads its wording and timing knobs from here so copy can be
 * tuned without a code change (Engineering Constitution: "never hardcode numbers
 * or text"; "config loads at runtime").
 *
 * Mirrors the gap-rules-loader / activation-profile-loader pattern.
 */

import ghostTextStemsJson from "./ghosttext_stems.json";
import { GapType } from "../types/gap.types";

// ---------------------------------------------------------------------------
// Config Types
// ---------------------------------------------------------------------------

/** Timing / sizing knobs for ghost-text generation. */
export interface GhostTextSettings {
  /** Minimum pause (ms) that triggers a ghost-text offer. */
  readonly pauseThresholdMs: number;
  /** How recently (ms) a gap must have been detected to surface a stem. */
  readonly gapRecencyMs: number;
  /** Maximum allowed stem length (characters). */
  readonly maxStemLength: number;
}

/** Stem templates for every gap type. */
export type GhostTextStems = Readonly<Record<GapType, readonly string[]>>;

/** Root ghost-text stems configuration. */
export interface GhostTextStemsConfig {
  readonly version: string;
  readonly note?: string;
  readonly settings: GhostTextSettings;
  readonly stems: GhostTextStems;
}

// ---------------------------------------------------------------------------
// Loaded Config
// ---------------------------------------------------------------------------

const ghostTextStemsConfig: GhostTextStemsConfig =
  ghostTextStemsJson as GhostTextStemsConfig;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns the complete ghost-text stems configuration. */
export function getGhostTextStemsConfig(): GhostTextStemsConfig {
  return ghostTextStemsConfig;
}

/** Returns the timing / sizing settings block. */
export function getGhostTextSettings(): GhostTextSettings {
  return ghostTextStemsConfig.settings;
}

/** Returns the stem templates for a specific gap type. */
export function getStemsForGap(gapType: GapType): readonly string[] {
  return ghostTextStemsConfig.stems[gapType] ?? [];
}
