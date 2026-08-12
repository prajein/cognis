import { OnboardingCompletedPayload } from '../event-bus/contracts';
import { SessionId, Timestamp } from './session.types';
import { GapType } from './gap.types';

/**
 * User Profile Record
 *
 * Represents the longitudinal state of a user's profile, including their
 * initial onboarding configuration.
 *
 * By architecture (Week 3), the onboarding payload is treated as opaque
 * configuration by the storage layer. It is typed exactly as the event
 * payload to isolate semantic knowledge to the UI.
 */

export type GapTransferState = 'ACTIVE' | 'MAYBE_TRANSFERRED' | 'TRANSFERRED';

export interface GapLongitudinalState {
  gapType: GapType;
  lastSeen: {
    sessionId: SessionId;
    endedAt: Timestamp;
  } | null;
  sessionsSinceLastSeen: number;
  transferState: GapTransferState;
}

export interface UserProfileRecord {
  /**
   * Unique identifier for the user profile.
   * By Week 3 architecture, this is always 'default-user'.
   */
  readonly profileId: string;

  /**
   * The timestamp of the last domain event that successfully modified this profile.
   * Used for atomic optimistic concurrency checks during updates.
   */
  readonly lastModified: number;

  /**
   * The event ID of the last domain event that successfully modified this profile.
   * Used to prevent duplicate event processing.
   */
  readonly lastEventId?: string;

  /**
   * The user's onboarding configuration.
   * Typed exactly as the OnboardingCompletedPayload.
   */
  readonly onboarding: OnboardingCompletedPayload;

  /**
   * Recent meaningful sessions, ordered by endedAt ascending, then sessionId.
   * Capped at the 7 most recent sessions.
   * This is an audit/history window, NOT authoritative for state machines.
   */
  readonly recentCountedSessions: Array<{
    sessionId: SessionId;
    endedAt: Timestamp;
  }>;

  /**
   * Ledger of session IDs that have already been folded into this profile.
   * Provides transactional idempotency.
   */
  readonly foldedSessions: string[];

  /**
   * Gap longitudinal states used to derive transfer policy.
   */
  readonly gapHistory: Record<GapType, GapLongitudinalState>;
}
