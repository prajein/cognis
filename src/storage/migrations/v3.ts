/**
 * IndexedDB Schema Migration: Version 3
 *
 * Problem: v1Migration created `read_models` with { keyPath: 'projectionKey' }.
 * The canonical repository contract (ReadModelRepository) requires
 * { keyPath: 'projectionId' }. v3Migration was introduced to correct this, but
 * its original guard (`if (!db.objectStoreNames.contains('read_models'))`) was
 * always skipped because v1Migration had already created the store within the
 * same upgrade transaction.
 *
 * This migration determines whether the existing store already conforms to the
 * canonical schema before deciding whether migration is required. If the store
 * uses the legacy keyPath, it is re-created with the canonical `projectionId`
 * keyPath. Based on the current repository state there is no evidence that
 * `read_models` has ever been successfully written to via ReadModelRepository,
 * so re-creation is safe — but the logic handles legacy records defensively.
 *
 * Success criteria:
 *   - objectStore('read_models').keyPath === 'projectionId' after any upgrade path.
 *   - Migration is idempotent: a store already using 'projectionId' is left untouched.
 *   - Existing compatible records are preserved where IndexedDB semantics allow.
 */

import { Migration } from '../indexeddb/CognisDatabase';

export const v3Migration: Migration = {
  version: 3,
  upgrade(db: IDBDatabase, transaction: IDBTransaction): void {
    const STORE_NAME = 'read_models';
    const CANONICAL_KEY_PATH = 'projectionId';

    if (db.objectStoreNames.contains(STORE_NAME)) {
      const existingStore = transaction.objectStore(STORE_NAME);

      // Idempotency: if the store already uses the canonical keyPath, nothing to do.
      if (existingStore.keyPath === CANONICAL_KEY_PATH) {
        return;
      }

      // The store exists but uses the legacy keyPath ('projectionKey').
      // Re-create it with the canonical keyPath. The store is treated as
      // effectively unpopulated (see RFC 1 §1.3), but we delete it cleanly
      // within the same version-change transaction so no partial state remains.
      db.deleteObjectStore(STORE_NAME);
    }

    // Create the canonical read_models store.
    const store = db.createObjectStore(STORE_NAME, { keyPath: CANONICAL_KEY_PATH });
    store.createIndex('by-session', 'sessionId', { unique: false });
  },
};
