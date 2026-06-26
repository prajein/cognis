/**
 * Storage Layer Contracts
 * 
 * Defines the canonical interfaces for persistence in Cognis.
 * Per Constitution Section 3, these interfaces decouple domain logic
 * from concrete storage technologies (e.g., IndexedDB, SQLite).
 */

import { DomainEvent } from '../core/event-bus/contracts';
import { EventType } from '../core/event-bus/registry';
import { EventId, SessionId, Timestamp } from '../core/types/session.types';

/**
 * EventStoreContract
 * 
 * The authoritative query and persistence interface for domain events.
 * Implementations of this contract (e.g., EventRepository) must guarantee
 * append-only immutability. No update or delete operations are permitted.
 * 
 * Events retrieved through this contract represent the undisputed
 * historical truth of the system (Constitution Section 2).
 */
export interface EventStoreContract {
  /**
   * Persists a domain event.
   * Must reject duplicates (based on EventId) rather than overwriting.
   */
  append(event: DomainEvent<any>): Promise<void>;

  /** Retrieves a specific event by its unique ID. */
  getById(id: EventId): Promise<DomainEvent<any> | undefined>;

  /** Retrieves all events for a given session, unordered. */
  getBySession(sessionId: SessionId): Promise<DomainEvent<any>[]>;

  /** Retrieves all events of a specific type across all sessions. */
  getByType(type: EventType): Promise<DomainEvent<any>[]>;

  /** Retrieves all events of a specific type within a specific session. */
  getBySessionAndType(sessionId: SessionId, type: EventType): Promise<DomainEvent<any>[]>;

  /** Retrieves all events created between the start and end timestamps (inclusive). */
  getByTimeRange(start: Timestamp, end: Timestamp): Promise<DomainEvent<any>[]>;

  /** 
   * Retrieves all events for a given session, strictly ordered by timestamp ascending.
   * This is the primary method for session replay.
   */
  getBySessionOrdered(sessionId: SessionId): Promise<DomainEvent<any>[]>;

  /** Returns the total number of events persisted. */
  count(): Promise<number>;

  /** Returns the total number of events persisted for a given session. */
  countBySession(sessionId: SessionId): Promise<number>;
}
