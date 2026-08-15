import { CognisDatabase } from '../indexeddb/CognisDatabase';

/**
 * RetentionRepository
 *
 * Privileged storage primitive for time-based historical retention.
 * Operates separately from standard domain repositories (like EventRepository)
 * which remain strictly append-only or bounded by specific domain contracts.
 */
export class RetentionRepository {
  constructor(private readonly db: CognisDatabase) {}

  /**
   * Deletes records older than the cutoff timestamp from the specified stores,
   * bounded by a batch size to prevent long-running transaction blocks.
   *
   * @param storeNames Array of store names to prune (e.g., 'events', 'signal_frame')
   * @param cutoff Timestamp (ms) representing the oldest allowed record.
   * @param batchSize Maximum number of total records to delete across all stores in this batch.
   * @returns A map of how many records were deleted per store in this transaction.
   */
  public async deleteOlderThan(
    storeNames: string[],
    cutoff: number,
    batchSize: number
  ): Promise<{ storeCounts: Record<string, number>; totalDeleted: number }> {
    if (batchSize <= 0) {
      throw new Error('Batch size must be > 0');
    }

    if (storeNames.length === 0) {
      return { storeCounts: {}, totalDeleted: 0 };
    }

    // Execute within a single cross-store readwrite transaction for atomicity
    return this.db.transaction(storeNames, 'readwrite', async (tx) => {
      const storeCounts: Record<string, number> = {};
      let totalDeleted = 0;

      for (const storeName of storeNames) {
        storeCounts[storeName] = 0;
        const store = tx.objectStore(storeName);

        // We require stores to have a 'by-timestamp' index for efficient deletion
        if (!store.indexNames.contains('by-timestamp')) {
          throw new Error(`Store '${storeName}' lacks the 'by-timestamp' index required for retention.`);
        }

        const index = store.index('by-timestamp');
        const range = IDBKeyRange.upperBound(cutoff);

        // Process this store using a cursor
        const result = await new Promise<number>((resolve, reject) => {
          let count = 0;
          const request = index.openCursor(range);

          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor && totalDeleted < batchSize) {
              cursor.delete();
              count++;
              totalDeleted++;
              cursor.continue();
            } else {
              resolve(count);
            }
          };

          request.onerror = () => reject(request.error);
        });

        storeCounts[storeName] = result;

        if (totalDeleted >= batchSize) {
          break; // Stop processing further stores if we hit the limit
        }
      }

      return { storeCounts, totalDeleted };
    });
  }
}
