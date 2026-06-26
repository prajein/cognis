/**
 * IndexedDB Schema Migration: Version 1
 * 
 * Defines the initial database schema for the Cognis Event Store.
 * Creates the core `events` object store and its query indexes,
 * along with placeholder stores for future read models and profiles.
 * 
 * Architectural Constraints:
 * - Migrations run exactly once when the database is created or upgraded.
 * - Migrations must be idempotent (e.g., checking `objectStoreNames.contains`).
 * - No data manipulation occurs here, only structural schema definitions.
 */

export const v1Migration = {
  version: 1,
  upgrade(db: IDBDatabase, transaction: IDBTransaction): void {
    // 1. Domain Events Store (Append-only facts)
    if (!db.objectStoreNames.contains('events')) {
      const eventsStore = db.createObjectStore('events', { keyPath: 'id' });
      
      // Single-field indexes
      eventsStore.createIndex('by-session', 'sessionId', { unique: false });
      eventsStore.createIndex('by-type', 'type', { unique: false });
      eventsStore.createIndex('by-timestamp', 'timestamp', { unique: false });
      
      // Compound indexes for optimal queries without client-side filtering
      eventsStore.createIndex('by-session-type', ['sessionId', 'type'], { unique: false });
      eventsStore.createIndex('by-session-timestamp', ['sessionId', 'timestamp'], { unique: false });
    }

    // 2. User Profiles Store (Future longitudinal models)
    if (!db.objectStoreNames.contains('user_profiles')) {
      db.createObjectStore('user_profiles', { keyPath: 'profileId' });
    }

    // 3. Read Models Store (Future queryable projections)
    if (!db.objectStoreNames.contains('read_models')) {
      db.createObjectStore('read_models', { keyPath: 'projectionKey' });
    }
  }
};
