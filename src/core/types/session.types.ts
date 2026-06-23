/**
 * Session Domain Types
 *
 * Branded types for identifiers used across all Cognis modules.
 * Branded types prevent accidental misuse of raw strings/numbers
 * where semantically distinct identifiers are expected.
 *
 * These types are stable contracts. Arc hardware must produce
 * identifiers conforming to these same shapes.
 */

// ---------------------------------------------------------------------------
// Branded type symbols
// ---------------------------------------------------------------------------

declare const __sessionIdBrand: unique symbol;
declare const __eventIdBrand: unique symbol;
declare const __timestampBrand: unique symbol;

// ---------------------------------------------------------------------------
// Branded types
// ---------------------------------------------------------------------------

/**
 * Unique identifier for a user session.
 * A session begins when the user opens an AI platform tab
 * and ends when they leave or explicitly close it.
 */
export type SessionId = string & { readonly __brand: typeof __sessionIdBrand };

/**
 * Unique identifier for a single domain event.
 * Every event persisted to IndexedDB carries a unique EventId.
 */
export type EventId = string & { readonly __brand: typeof __eventIdBrand };

/**
 * Unix epoch timestamp in milliseconds.
 * All event timestamps across Cognis use this type.
 */
export type Timestamp = number & { readonly __brand: typeof __timestampBrand };

// ---------------------------------------------------------------------------
// Brand constructors
// ---------------------------------------------------------------------------

/** Cast a raw string to a SessionId. */
export function toSessionId(id: string): SessionId {
  return id as SessionId;
}

/** Cast a raw string to an EventId. */
export function toEventId(id: string): EventId {
  return id as EventId;
}

/** Cast a raw number (unix ms) to a Timestamp. */
export function toTimestamp(ms: number): Timestamp {
  return ms as Timestamp;
}
