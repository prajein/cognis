import { CognisDatabase } from '../indexeddb/CognisDatabase';

/**
 * ReadModelRepository
 * 
 * Generic CRUD operations for the `read_models` IndexedDB object store.
 * Used exclusively by Projection Builders.
 */
export class ReadModelRepository {
  private static readonly STORE_NAME = 'read_models';

  constructor(private readonly db: CognisDatabase) {}

  public async get<T>(projectionId: string): Promise<T | undefined> {
    return this.db.transaction(ReadModelRepository.STORE_NAME, 'readonly', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(ReadModelRepository.STORE_NAME);
        const request = store.get(projectionId);

        request.onsuccess = () => resolve(request.result as T | undefined);
        request.onerror = () => reject(request.error);
      });
    });
  }

  public async put<T extends { projectionId: string }>(readModel: T): Promise<void> {
    return this.db.transaction(ReadModelRepository.STORE_NAME, 'readwrite', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(ReadModelRepository.STORE_NAME);
        // put() updates or inserts, allowing idempotency
        const request = store.put(readModel);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  public async delete(projectionId: string): Promise<void> {
    return this.db.transaction(ReadModelRepository.STORE_NAME, 'readwrite', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(ReadModelRepository.STORE_NAME);
        const request = store.delete(projectionId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Atomically updates a read model within a single readwrite transaction.
   * Prevents lost updates when multiple events trigger concurrent modifications.
   */
  public async update<T extends { projectionId: string }>(
    projectionId: string,
    updater: (model: T | undefined) => T
  ): Promise<void> {
    return this.db.transaction(ReadModelRepository.STORE_NAME, 'readwrite', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(ReadModelRepository.STORE_NAME);
        const getRequest = store.get(projectionId);

        getRequest.onsuccess = () => {
          try {
            const currentModel = getRequest.result as T | undefined;
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
  /**
   * Retrieves all records whose `projectionId` starts with the given prefix.
   *
   * Uses an IDBKeyRange cursor (lower bound inclusive, upper bound exclusive via
   * the high-Unicode sentinel '\uffff') so the scan is index-efficient and does
   * not load the entire object store into memory.
   *
   * Used by background query handlers to find projections by projection type
   * (e.g. all sessions: prefix = 'session-v1_').
   */
  public async getAllByPrefix<T>(prefix: string): Promise<T[]> {
    return this.db.transaction(ReadModelRepository.STORE_NAME, 'readonly', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(ReadModelRepository.STORE_NAME);
        const range = IDBKeyRange.bound(prefix, prefix + '\uffff');
        const request = store.openCursor(range);
        const results: T[] = [];

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            results.push(cursor.value as T);
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => reject(request.error);
      });
    });
  }
}
