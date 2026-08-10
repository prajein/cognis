import { EventBusContract } from '../../core/event-bus/types';
import { DomainEvent, OnboardingCompletedPayload } from '../../core/event-bus/contracts';
import { ProfileRepository } from '../../storage/repositories/ProfileRepository';
import { UserProfileRecord } from '../../core/types/profile.types';

/**
 * IdentityProfileWriter
 *
 * A Background engine responsible for processing Identity events and persisting
 * them to the User Profile.
 *
 * Architecture Rules:
 * - Subscribes to identity.onboarding.completed
 * - Persists to the 'default-user' singleton key.
 * - Uses event.id to provide exact delivery idempotency.
 * - Uses event.timestamp to protect against older out-of-order events.
 * - Equal timestamps with different event IDs are accepted.
 * - The profile is updated using latest-write-wins for technically valid non-stale events.
 * - Intentional re-onboarding product semantics remain unresolved.
 */
export class IdentityProfileWriter {
  private static readonly SINGLETON_PROFILE_ID = 'default-user';

  constructor(private readonly profileRepo: ProfileRepository) {}

  public start(eventBus: EventBusContract): void {
    eventBus.subscribe('identity.onboarding.completed', this.handleOnboardingCompleted.bind(this));
  }

  private async handleOnboardingCompleted(event: DomainEvent<OnboardingCompletedPayload>): Promise<void> {
    try {
      await this.profileRepo.update(
        IdentityProfileWriter.SINGLETON_PROFILE_ID,
        (currentModel: UserProfileRecord | undefined): UserProfileRecord => {
          if (currentModel) {
            // Prevent exact duplicates: if we already processed this exact event, ignore.
            if (currentModel.lastEventId === event.id) {
              return currentModel;
            }

            // Prevent stale writes: if a newer event already updated this profile, ignore this older one.
            if (event.timestamp < currentModel.lastModified) {
              return currentModel;
            }
          }

          return {
            profileId: IdentityProfileWriter.SINGLETON_PROFILE_ID,
            lastModified: event.timestamp,
            lastEventId: event.id,
            onboarding: event.payload,
          };
        }
      );
      console.log('[IdentityProfileWriter] Successfully recorded onboarding.completed.');
    } catch (error) {
      console.error('[IdentityProfileWriter] Failed to update profile:', error);
    }
  }
}
