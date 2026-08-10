import { CognisDatabase } from '../indexeddb/CognisDatabase';
import { PersistedGapPreference } from '../../core/types/adaptation.types';

export class AdaptationPreferenceRepository {
  private static readonly STORE_NAME = 'adaptation_preferences';

  constructor(private readonly db: CognisDatabase) {}

  /**
   * Atomically flushes a session's evidence to the persistent store.
   * Merges evidence additively across sessions.
   * Guarantees idempotency via `lastSessionId`.
   */
  public async flush(record: PersistedGapPreference, sessionId: string): Promise<void> {
    return this.db.transaction(AdaptationPreferenceRepository.STORE_NAME, 'readwrite', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(AdaptationPreferenceRepository.STORE_NAME);
        const getRequest = store.get(record.id);

        getRequest.onsuccess = () => {
          try {
            const existing = getRequest.result as PersistedGapPreference | undefined;

            // Idempotency: if this session has already flushed this record, ignore.
            if (existing && existing.lastSessionId === sessionId) {
              return resolve();
            }

            const merged: PersistedGapPreference = {
              ...record,
              totalExposures: (existing?.totalExposures ?? 0) + record.totalExposures,
              totalAcceptances: (existing?.totalAcceptances ?? 0) + record.totalAcceptances,
              totalExplicitRejections: (existing?.totalExplicitRejections ?? 0) + record.totalExplicitRejections,
              firstSeenAt: existing?.firstSeenAt ?? record.firstSeenAt,
              lastUpdatedAt: record.lastUpdatedAt,
              lastSessionId: sessionId,
            };

            const putRequest = store.put(merged);
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

  /**
   * Retrieves all adaptation preferences for a given user profile.
   */
  public async getAll(profileId: string): Promise<PersistedGapPreference[]> {
    return this.db.transaction(AdaptationPreferenceRepository.STORE_NAME, 'readonly', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(AdaptationPreferenceRepository.STORE_NAME);
        const index = store.index('by-profileId');
        const request = index.getAll(profileId);

        request.onsuccess = () => resolve(request.result as PersistedGapPreference[]);
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Removes a single adaptation preference record.
   */
  public async deleteOne(id: string): Promise<void> {
    return this.db.transaction(AdaptationPreferenceRepository.STORE_NAME, 'readwrite', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(AdaptationPreferenceRepository.STORE_NAME);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Removes all adaptation preference records for a given user profile.
   */
  public async deleteAll(profileId: string): Promise<void> {
    return this.db.transaction(AdaptationPreferenceRepository.STORE_NAME, 'readwrite', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(AdaptationPreferenceRepository.STORE_NAME);
        const index = store.index('by-profileId');
        const request = index.getAllKeys(profileId);

        request.onsuccess = () => {
          const keys = request.result;
          let deletedCount = 0;
          
          if (keys.length === 0) {
            return resolve();
          }

          for (const key of keys) {
            const deleteReq = store.delete(key);
            deleteReq.onsuccess = () => {
              deletedCount++;
              if (deletedCount === keys.length) {
                resolve();
              }
            };
            deleteReq.onerror = () => reject(deleteReq.error);
          }
        };
        request.onerror = () => reject(request.error);
      });
    });
  }
}
