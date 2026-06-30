import { DomainEvent } from '../../core/event-bus/contracts';
import { EventType } from '../../core/event-bus/registry';

/**
 * ProjectionBuilder
 * 
 * Contract for all Read Model builders.
 * Projection Builders consume immutable Domain Events and produce query-optimized state.
 * 
 * Architectural Constraints:
 * 1. Must be purely deterministic. The same sequence of events MUST produce the exact same Read Model.
 * 2. handleEvent MUST be idempotent. Replaying an event should not duplicate state.
 * 3. Never writes to the 'events' store, only to the 'read_models' store.
 */
export interface ProjectionBuilder {
  /** 
   * Uniquely identifies this read model and its version (e.g., 'session-v1') 
   * This is used as the primary key in the `read_models` object store.
   */
  readonly projectionId: string;

  /** List of event types this builder consumes. */
  readonly consumedEvents: ReadonlyArray<EventType>;

  /** 
   * Handles a single event. 
   * Used during both live EventBus subscriptions and sequential replay.
   * MUST be idempotent.
   */
  handleEvent(event: DomainEvent<any>): Promise<void>;

  /** 
   * Clears the read model completely. 
   * Used prior to a full rebuild.
   */
  clear(): Promise<void>;
}
