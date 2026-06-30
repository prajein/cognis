import { Migration } from '../indexeddb/CognisDatabase';

export const v3Migration: Migration = {
  version: 3,
  upgrade(db: IDBDatabase, transaction: IDBTransaction): void {
    // 1. Create the read_models object store
    if (!db.objectStoreNames.contains('read_models')) {
      const store = db.createObjectStore('read_models', { keyPath: 'projectionId' });
      // We can index by userId or sessionId if needed for querying later
      // store.createIndex('by-session', 'sessionId', { unique: false });
    }
  }
};
