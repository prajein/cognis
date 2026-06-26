/**
 * Gap Engine Types
 *
 * What & why: internal types for the Gap Detection engine. These describe the
 * *inputs* the engine reasons over and the *signals* it produces. They live in
 * the engine module (not protected `core/`) because they are engine-internal —
 * the only shared contracts are `GapType` (core) and the `gap.detected` payload
 * (event contracts). The engine can be replaced without touching these.
 */

import { GapType } from "../../core/types/gap.types";
import { StateLabel } from "../../core/types/state.types";

/**
 * A single detected gap with an estimated confidence.
 *
 * Confidence is a model estimate in [0, 1], never a measurement
 * (Disclosure Rule — Full Software Spec Part XVI).
 */
export interface GapSignal {
  readonly gapType: GapType;
  readonly confidence: number;
}

/**
 * The full input to a gap-analysis pass.
 *
 * `text` is transient sensory input supplied in-memory by the perception layer.
 * It is NEVER persisted and NEVER placed on the EventBus — only the resulting
 * `gap.detected { gapType, confidence }` signal is published. The remaining
 * fields are behavioural context already carried by domain events.
 */
export interface GapAnalysisInput {
  /** Live prompt text (in-memory only; optional — omit for metric-only passes). */
  readonly text?: string;
  /** Current cognitive state, tracked from `state.changed` events. */
  readonly state: StateLabel;
  /** Number of revisions to the prompt, from the latest `prompt.typed` event. */
  readonly revisionDepth: number;
}

/** The result of a gap-analysis pass: signals above the emit threshold. */
export interface GapAnalysisResult {
  readonly signals: readonly GapSignal[];
}
