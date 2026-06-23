/**
 * Event Bus Types
 *
 * Defines the handler signature and the EventBus contract interface.
 * These types govern how modules interact with the EventBus
 * without defining any runtime behavior.
 *
 * The EventBusContract is what engines and adapters depend on.
 * The actual EventBus implementation will satisfy this interface
 * but is defined separately (not in this file).
 */

import { DomainEvent, CognisEventMap } from './contracts';
import { EventType } from './registry';

// ---------------------------------------------------------------------------
// Error Reporter
// ---------------------------------------------------------------------------

/**
 * Abstraction for reporting subscriber execution errors.
 * Ensures the EventBus remains decoupled from specific logging/telemetry tools.
 */
export interface ErrorReporter {
  report(error: unknown, context: { eventType: string; source: string }): void;
}

// ---------------------------------------------------------------------------
// Event Handler
// ---------------------------------------------------------------------------

/**
 * Typed event handler function.
 * Receives the full DomainEvent envelope with payload type
 * inferred from the event type string via CognisEventMap.
 *
 * @template T - An event type string from the registry.
 */
export type EventHandler<T extends EventType> =
  (event: DomainEvent<CognisEventMap[T]>) => void;

// ---------------------------------------------------------------------------
// Event Bus Contract
// ---------------------------------------------------------------------------

/**
 * Contract for the Cognis Event Bus.
 *
 * All modules interact with the EventBus exclusively through
 * this interface. The implementation is a separate concern.
 *
 * The EventBus must:
 * - Route events synchronously within the same execution context.
 * - Maintain event dispatch latency under 5ms (Constitution Section 2).
 * - Never contain business logic (Constitution Section 3).
 * - Never persist events (that is the Storage Layer's responsibility).
 */
export interface EventBusContract {
  /**
   * Publish a domain event to all registered subscribers.
   *
   * @template T - The event type string from the registry.
   * @param type - The event type to publish.
   * @param event - The full DomainEvent envelope with typed payload.
   */
  publish<T extends EventType>(
    type: T,
    event: DomainEvent<CognisEventMap[T]>,
  ): void;

  /**
   * Subscribe to a specific event type.
   *
   * @template T - The event type string from the registry.
   * @param type - The event type to subscribe to.
   * @param handler - The handler to invoke when the event is published.
   * @returns An unsubscribe function. Calling it removes this handler.
   */
  subscribe<T extends EventType>(
    type: T,
    handler: EventHandler<T>,
  ): () => void;
}
