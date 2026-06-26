/**
 * createDomainEvent — Domain Event factory
 *
 * What & why: Domain engines must publish fully-formed `DomainEvent<T>` envelopes
 * onto the EventBus, but the envelope requires a freshly-minted `EventId` and a
 * `Timestamp`. Rather than scatter `crypto.randomUUID()` / `Date.now()` calls
 * across every engine (untestable, non-deterministic), this factory centralises
 * envelope construction and lets callers inject a clock and id source.
 *
 * - Tests inject a deterministic clock + id source for reproducible output.
 * - Production uses the runtime defaults (`crypto.randomUUID`, `Date.now`).
 * - Arc-ready: the factory has no platform/DOM/browser coupling; future hardware
 *   producers build envelopes through the exact same path.
 *
 * Location rationale: `src/shared/` is the cross-cutting utility home defined in
 * the approved repository skeleton and is not a protected foundation area, so
 * engines may depend on it without reaching into another module.
 */

import { DomainEvent, CognisEventMap } from '../../core/event-bus/contracts';
import { EventType } from '../../core/event-bus/registry';
import {
  EventId,
  SessionId,
  Timestamp,
  toEventId,
  toTimestamp,
} from '../../core/types/session.types';

/** Supplies the wall-clock time (Unix epoch ms) for an event. */
export type Clock = () => Timestamp;

/** Supplies a unique identifier for an event. */
export type EventIdFactory = () => EventId;

/**
 * Optional overrides for envelope minting. Defaults are runtime-standard and
 * available in every JavaScript host Cognis targets (browser + service worker).
 */
export interface EventFactoryOptions {
  readonly clock?: Clock;
  readonly idFactory?: EventIdFactory;
}

/** Default clock: the host's millisecond wall clock. */
export const defaultClock: Clock = () => toTimestamp(Date.now());

/** Default id source: RFC-4122 UUID v4 from the host crypto implementation. */
export const defaultEventIdFactory: EventIdFactory = () =>
  toEventId(crypto.randomUUID());

/**
 * Builds a fully-formed, type-checked DomainEvent envelope.
 *
 * The generic `T` is pinned to the registry event type, so the `payload`
 * argument is validated against `CognisEventMap[T]` at compile time.
 *
 * @param type      Registry event type (e.g. 'gap.detected').
 * @param sessionId The session this event belongs to.
 * @param source    The producing module (e.g. 'gap-detection-engine').
 * @param payload   The event-specific, type-checked payload.
 * @param options   Optional clock / id overrides (for tests or hardware).
 */
export function createDomainEvent<T extends EventType>(
  type: T,
  sessionId: SessionId,
  source: string,
  payload: CognisEventMap[T],
  options: EventFactoryOptions = {},
): DomainEvent<CognisEventMap[T]> {
  const clock = options.clock ?? defaultClock;
  const idFactory = options.idFactory ?? defaultEventIdFactory;

  return {
    id: idFactory(),
    type,
    timestamp: clock(),
    sessionId,
    source,
    payload,
  };
}
