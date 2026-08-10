import { OnboardingCompletedPayload } from '../event-bus/contracts';

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
}
