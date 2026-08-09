/**
 * Response Intelligence Constants
 *
 * Shared linguistic markers and thresholds used by deterministic
 * response analyzers.
 */

/**
 * Common markers that indicate assumptions or implicit conditions.
 */
export const ASSUMPTION_MARKERS = [
  "assume",
  "assuming",
  "suppose",
  "supposing",
  "let's say",
  "provided that",
  "given that",
  "if",
  "typically",
  "generally",
  "usually",
  "in most cases",
] as const;

/**
 * Common uncertainty / hedge markers.
 */
export const UNCERTAINTY_MARKERS = [
  "maybe",
  "perhaps",
  "possibly",
  "might",
  "could",
  "appears",
  "seems",
  "likely",
  "probably",
  "unclear",
] as const;

/**
 * Markers that indicate the model admits a limitation.
 */
export const LIMITATION_MARKERS = [
  "i don't know",
  "i am not sure",
  "cannot determine",
  "insufficient information",
  "depends",
  "without more information",
] as const;

/**
 * Default thresholds used by analyzers.
 */
export const RESPONSE_ANALYSIS_THRESHOLDS = {
  ASSUMPTION_HEAVY: 5,
  UNCERTAINTY_HIGH: 4,
  GAP_THRESHOLD: 3,
} as const;

export const RESPONSE_FLAGS = {
  ASSUMPTION_HEAVY: "assumption_heavy",
  EXPLICIT_REASONING: "explicit_reasoning",
} as const;