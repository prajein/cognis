/**
 * EventRepository
 * 
 * Implements the EventStoreContract using IndexedDB.
 * Enforces append-only, immutable storage of DomainEvents.
 * 
 * Architectural Constraints:
 * - Uses `IDBObjectStore.add()` exclusively (never `put()`) to prevent accidental overwrites.
 * - Performs no business logic or enrichment.
 * - Queries are executed via IndexedDB indexes for optimal performance.
 */

import { DomainEvent } from '../../core/event-bus/contracts';
import { EventType } from '../../core/event-bus/registry';
import { EventId, SessionId, Timestamp } from '../../core/types/session.types';
import { EventStoreContract } from '../types';
import { CognisDatabase } from '../indexeddb/CognisDatabase';

export class EventRepository implements EventStoreContract {
  private static readonly STORE_NAME = 'events';

  constructor(private readonly db: CognisDatabase) {}

  public async append(event: DomainEvent<any>): Promise<void> {
    return this.db.transaction(EventRepository.STORE_NAME, 'readwrite', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(EventRepository.STORE_NAME);
        // add() rejects duplicates (EventId keyPath), enforcing immutability
        const request = store.add(event);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          // If the error is a ConstraintError, it means we attempted to insert a duplicate EventId.
          // In an append-only store, this could indicate a replay or a UUID collision.
          reject(request.error || new Error(`[EventRepository] Failed to append event ${event.id}`));
        };
      });
    });
  }

  public async getById(id: EventId): Promise<DomainEvent<any> | undefined> {
    return this.db.transaction(EventRepository.STORE_NAME, 'readonly', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(EventRepository.STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result as DomainEvent<any> | undefined);
        request.onerror = () => reject(request.error);
      });
    });
  }

  public async getBySession(sessionId: SessionId): Promise<DomainEvent<any>[]> {
    return this.db.transaction(EventRepository.STORE_NAME, 'readonly', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(EventRepository.STORE_NAME);
        const index = store.index('by-session');
        const request = index.getAll(IDBKeyRange.only(sessionId));

        request.onsuccess = () => resolve(request.result as DomainEvent<any>[]);
        request.onerror = () => reject(request.error);
      });
    });
  }

  public async getByType(type: EventType): Promise<DomainEvent<any>[]> {
    return this.db.transaction(EventRepository.STORE_NAME, 'readonly', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(EventRepository.STORE_NAME);
        const index = store.index('by-type');
        const request = index.getAll(IDBKeyRange.only(type));

        request.onsuccess = () => resolve(request.result as DomainEvent<any>[]);
        request.onerror = () => reject(request.error);
      });
    });
  }

  public async getBySessionAndType(sessionId: SessionId, type: EventType): Promise<DomainEvent<any>[]> {
    return this.db.transaction(EventRepository.STORE_NAME, 'readonly', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(EventRepository.STORE_NAME);
        const index = store.index('by-session-type');
        const request = index.getAll(IDBKeyRange.only([sessionId, type]));

        request.onsuccess = () => resolve(request.result as DomainEvent<any>[]);
        request.onerror = () => reject(request.error);
      });
    });
  }

  public async getByTimeRange(start: Timestamp, end: Timestamp): Promise<DomainEvent<any>[]> {
    return this.db.transaction(EventRepository.STORE_NAME, 'readonly', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(EventRepository.STORE_NAME);
        const index = store.index('by-timestamp');
        const request = index.getAll(IDBKeyRange.bound(start, end));

        request.onsuccess = () => resolve(request.result as DomainEvent<any>[]);
        request.onerror = () => reject(request.error);
      });
    });
  }

  public async getBySessionOrdered(sessionId: SessionId): Promise<DomainEvent<any>[]> {
    return this.db.transaction(EventRepository.STORE_NAME, 'readonly', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(EventRepository.STORE_NAME);
        const index = store.index('by-session-timestamp');
        
        // IDBKeyRange.bound([sessionId, 0], [sessionId, Infinity]) ensures we get
        // all events for this sessionId, ordered by timestamp ascending.
        const request = index.getAll(IDBKeyRange.bound([sessionId, 0], [sessionId, Infinity]));

        request.onsuccess = () => resolve(request.result as DomainEvent<any>[]);
        request.onerror = () => reject(request.error);
      });
    });
  }

  public async count(): Promise<number> {
    return this.db.transaction(EventRepository.STORE_NAME, 'readonly', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(EventRepository.STORE_NAME);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  public async countBySession(sessionId: SessionId): Promise<number> {
    return this.db.transaction(EventRepository.STORE_NAME, 'readonly', (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(EventRepository.STORE_NAME);
        const index = store.index('by-session');
        const request = index.count(IDBKeyRange.only(sessionId));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }
}
