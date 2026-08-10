/**
 * IndexedDB Schema Migration: Version 4
 *
 * Adds the `adaptation_preferences` object store to persist M10 cross-session
 * adaptation evidence.
 *
 * Success criteria:
 *   - objectStore('adaptation_preferences') is created with `id` keyPath.
 *   - index `by-profileId` is created.
 *   - Idempotent: checks if store exists before creation.
 */

import { Migration } from '../indexeddb/CognisDatabase';

export const v4Migration: Migration = {
  version: 4,
  upgrade(db: IDBDatabase): void {
    const STORE_NAME = 'adaptation_preferences';

    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      // Index by profileId to retrieve all gap preferences for a single user
      store.createIndex('by-profileId', 'profileId', { unique: false });
    }
  },
};
