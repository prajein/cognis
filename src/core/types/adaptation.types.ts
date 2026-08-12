import { GapType } from './gap.types';

/** The singleton profile ID used for all local adaptation records. */
export const ADAPTATION_PROFILE_ID = 'default-user' as const;

/**
 * PersistedGapPreference
 *
 * One record per GapType per user. Stores cumulative behavioral evidence
 * derived from ghost text acceptance and rejection across sessions.
 *
 * Design rules:
 * - Only raw evidence is persisted. Policy state (nextProbeThreshold etc.) is reconstructed.
 * - PROBING state is never persisted. It resolves to SUPPRESSED at flush.
 * - activeProbeInterventionId is never persisted.
 * - suppressedDetections always resets to 0 at session start.
 */
export interface PersistedGapPreference {
  /** Composite key: `${profileId}::${gapType}` e.g. "default-user::audience" */
  readonly id: string;
  readonly profileId: string;
  readonly gapType: GapType;

  /** Cumulative cross-session behavioral evidence. */
  totalExposures: number;
  totalAcceptances: number;
  totalExplicitRejections: number;

  /**
   * The resolved preference state at the end of the last session.
   * Never PROBING. If the session ended mid-probe, this is SUPPRESSED.
   */
  persistedState: 'ACTIVE' | 'SUPPRESSED';

  /**
   * Version tag of the adaptation policy that wrote this record.
   * Used by future policy versions to reconstruct derived state correctly.
   * M10 value: 'm10.0'
   */
  policyVersion: string;

  /** Unix epoch ms of the first evidence recorded for this gap type. */
  readonly firstSeenAt: number;

  /** Unix epoch ms of the last session that flushed this record. */
  lastUpdatedAt: number;

  /**
   * The session ID that last flushed this record.
   * Guards against double-writes from the same session.
   */
  lastSessionId: string;
}
