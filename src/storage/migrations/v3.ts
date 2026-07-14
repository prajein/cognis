import { Migration } from '../indexeddb/CognisDatabase';

export const v3Migration: Migration = {
  version: 3,
  upgrade(db: IDBDatabase, transaction: IDBTransaction): void {
    // Drop the old read_models store if it exists to fix the keyPath conflict from v1
    if (db.objectStoreNames.contains('read_models')) {
      db.deleteObjectStore('read_models');
    }
    
    // Create the read_models object store with the correct keyPath
    const store = db.createObjectStore('read_models', { keyPath: 'projectionId' });
    
    // Index by session to enable queries by session ID
    store.createIndex('by-session', 'sessionId', { unique: false });
  }
};
