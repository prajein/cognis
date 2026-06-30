/**
 * EventStoreSubscriber
 * 
 * Bridges the synchronous EventBus to the asynchronous Event Store.
 * 
 * Architectural Responsibilities:
 * - Subscribes to EVERY domain event defined in the registry.
 * - Forwards events to the EventRepository for persistence.
 * - Handles persistence asynchronously (fire-and-forget) to ensure
 *   the <5ms EventBus dispatch latency budget is maintained.
 * - Isolates IndexedDB errors from the EventBus (a storage failure
 *   must never crash a domain engine or halt event routing).
 */

import { EventBusContract, ErrorReporter as BusErrorReporter } from '../../core/event-bus/types';
import { DomainEvent } from '../../core/event-bus/contracts';
import { EventStoreContract } from '../types';
import {
  SessionEvents,
  PromptEvents,
  CognitiveEvents,
  GhostTextEvents,
  ResponseEvents,
  InsightEvents,
  HardwareEvents,
  EventType
} from '../../core/event-bus/registry';
import { DefaultPersistenceMapper, PersistenceEventV1DTO } from './PersistenceMapper';

/**
 * Interface for delegating error logging, keeping the subscriber
 * decoupled from specific logging or telemetry implementations.
 */
export interface ErrorReporter {
  report(error: Error, context?: Record<string, unknown>): void;
}

export class EventStoreSubscriber {
  constructor(
    private readonly eventBus: EventBusContract,
    private readonly eventRepository: EventStoreContract,
    private readonly errorReporter: ErrorReporter,
    private readonly mapper: DefaultPersistenceMapper = new DefaultPersistenceMapper()
  ) { }

  /**
   * Initializes subscriptions to all known domain events.
   * This guarantees that the system's "memory" records everything.
   */
  public subscribeToAll(): void {
    const allNamespaces = [
      SessionEvents,
      PromptEvents,
      CognitiveEvents,
      GhostTextEvents,
      ResponseEvents,
      InsightEvents,
      HardwareEvents
    ];

    for (const namespace of allNamespaces) {
      for (const eventType of Object.values(namespace)) {
        this.eventBus.subscribe(eventType as EventType, this.handleEvent);
      }
    }
  }

  /**
   * Handles incoming events from the EventBus.
   * 
   * NOTE: This method is intentionally an arrow function so `this` is bound,
   * but it does NOT return a Promise to the EventBus. The persistence happens
   * asynchronously in the background. This is a critical architectural invariant.
   */
  private handleEvent = (event: DomainEvent<any>): void => {
    // Persistence Mapping (Sanitization) - ADR-019
    // Strip transport-only fields before appending to the EventStore.
    const persistenceDto: PersistenceEventV1DTO = this.mapper.sanitize(event);

    // Fire-and-forget: append returns a Promise, but we don't await it here.
    // The EventBus synchronous dispatch loop returns immediately.
    this.eventRepository.append(persistenceDto).catch((error) => {
      // Isolate failures: Storage errors are reported but do not crash the bus.
      this.errorReporter.report(
        error instanceof Error ? error : new Error(String(error)),
        {
          eventId: event.id,
          eventType: event.type,
          sessionId: event.sessionId
        }
      );
    });
  };
}
