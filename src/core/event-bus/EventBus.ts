import { EventBusContract, EventHandler, ErrorReporter } from './types';
import { EventType } from './registry';
import { DomainEvent, CognisEventMap } from './contracts';

/**
 * Process-Local EventBus Implementation
 *
 * A synchronous broker for domain events that routes events within the same Javascript runtime context.
 * It adheres strictly to the Cognis Engineering Constitution requirements:
 * - < 5ms dispatch execution (synchronous dispatch).
 * - Subscriber error isolation.
 * - Complete lack of business logic, persistence, or intelligence.
 */
export class EventBus implements EventBusContract {
  /** Map of event types to their set of registered handlers. */
  private readonly handlers = new Map<EventType, Set<EventHandler<any>>>();

  /** Service used for reporting subscriber errors. */
  private readonly errorReporter: ErrorReporter;

  constructor(errorReporter: ErrorReporter) {
    this.errorReporter = errorReporter;
  }

  /**
   * Publish a domain event to all registered subscribers synchronously.
   *
   * @template T - The event type string from the registry.
   * @param type - The event type to publish.
   * @param event - The full DomainEvent envelope with typed payload.
   */
  public publish<T extends EventType>(
    type: T,
    event: DomainEvent<CognisEventMap[T]>
  ): void {
    const typeHandlers = this.handlers.get(type);
    if (!typeHandlers || typeHandlers.size === 0) {
      return;
    }
    for (const handler of typeHandlers) {
      try {
        handler(event);
      } catch (error) {
        // Isolate subscriber failures and report them via the injected reporter
        this.errorReporter.report(error, { eventType: type, source: 'EventBus' });
      }
    }
  }

  /**
   * Subscribe to a specific event type.
   *
   * @template T - The event type string from the registry.
   * @param type - The event type to subscribe to.
   * @param handler - The handler to invoke when the event is published.
   * @returns An unsubscribe function. Calling it removes this handler.
   */
  public subscribe<T extends EventType>(
    type: T,
    handler: EventHandler<T>
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    const typeHandlers = this.handlers.get(type)!;
    // TypeScript requires casting here because Set<EventHandler<any>> is wider than EventHandler<T>
    typeHandlers.add(handler as EventHandler<any>);

    return () => {
      typeHandlers.delete(handler as EventHandler<any>);
      // Remove the Set entirely if it becomes empty to prevent memory leaks over time
      if (typeHandlers.size === 0) {
        this.handlers.delete(type);
      }
    };
  }
}
