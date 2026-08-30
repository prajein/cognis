import { GapType } from '../../../core/types/gap.types';

/**
 * Shared marker-naming convention for gap-related evidence, used by every
 * strategy that reasons over gap.detected / ghosttext.accepted history.
 *
 * ReasoningContext.getEventHistory(marker) returns `readonly number[]`
 * (timestamps only, no payload -- confirmed against the real
 * ReasoningPipeline context builder), so gapType cannot be recovered by
 * inspecting a generic 'gap.detected' history array. Every consumer queries
 * ONE COMPOSITE MARKER PER GAP TYPE instead, matching the pre-scoped-marker
 * pattern already used by V1AutomaticityEvaluator (e.g. 'success:typescript').
 *
 * The exact naming convention below is a documented assumption. It is
 * centralized here so that if the real convention differs once confirmed
 * with the team, it is a one-place fix for every strategy that depends on it.
 */

export const ALL_GAP_TYPES: readonly GapType[] = [
  'intentionality',
  'audience',
  'constraint',
  'stakes',
  'assumption',
  'mechanism',
  'temporal',
  'second_order',
];

export function buildGapMarker(gapType: GapType): string {
  return `gap.detected:${gapType}`;
}

export function buildResolutionMarker(gapType: GapType): string {
  return `ghosttext.accepted:${gapType}`;
}