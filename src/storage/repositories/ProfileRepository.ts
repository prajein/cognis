import { CognisDatabase } from '../indexeddb/CognisDatabase';
import { UserProfileRecord } from '../../core/types/profile.types';

/**
 * ProfileRepository
 *
 * Generic CRUD operations for the `user_profiles` IndexedDB object store.
 * Used exclusively by the Identity Profile Writer (and any future readers).
 *
 * This layer is completely agnostic to payload semantics. It persists the
 * UserProfileRecord which contains the opaque `onboarding` configuration.
 */
export class ProfileRepository {
  private static readonly STORE_NAME = 'user_profiles';

  constructor(private readonly db: CognisDatabase) {}

  public async get(profileId: string): Promise<UserProfileRecord | undefined> {
    return this.db.transaction(ProfileRepository.STORE_NAME, 'readonly', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(ProfileRepository.STORE_NAME);
        const request = store.get(profileId);

        request.onsuccess = () => resolve(request.result as UserProfileRecord | undefined);
        request.onerror = () => reject(request.error);
      });
    });
  }

  public async put(profileRecord: UserProfileRecord): Promise<void> {
    return this.db.transaction(ProfileRepository.STORE_NAME, 'readwrite', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(ProfileRepository.STORE_NAME);
        const request = store.put(profileRecord);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Atomically updates a profile record within a single readwrite transaction.
   * Provides optimistic concurrency through the updater function.
   */
  public async update(
    profileId: string,
    updater: (model: UserProfileRecord | undefined) => UserProfileRecord
  ): Promise<void> {
    return this.db.transaction(ProfileRepository.STORE_NAME, 'readwrite', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(ProfileRepository.STORE_NAME);
        const getRequest = store.get(profileId);

        getRequest.onsuccess = () => {
          try {
            const currentModel = getRequest.result as UserProfileRecord | undefined;
            const updatedModel = updater(currentModel);
            const putRequest = store.put(updatedModel);

            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          } catch (error) {
            reject(error);
          }
        };

        getRequest.onerror = () => reject(getRequest.error);
      });
    });
  }
}
