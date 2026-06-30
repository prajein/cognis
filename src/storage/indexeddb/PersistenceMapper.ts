import { DomainEvent } from '../../core/event-bus/contracts';
import { EventType, ResponseEvents } from '../../core/event-bus/registry';

export interface PersistenceEventV1DTO extends Omit<DomainEvent<any>, 'payload'> {
  readonly payload: Record<string, unknown>;
}

type TransportPolicyMap = {
  [K in EventType]?: ReadonlyArray<string>; // Storing string keys of payload
};

/**
 * DefaultPersistenceMapper
 * 
 * An Anti-Corruption Layer (ACL) for the Event Store.
 * Responsible for sanitizing transport-only data from events before persistence,
 * ensuring strict compliance with ADR-019.
 * 
 * Operates purely functionally without mutating the original DomainEvent.
 */
export class DefaultPersistenceMapper {
  private readonly transportOnlyFields: TransportPolicyMap = {
    [ResponseEvents.CHUNK]: ['chunkText']
  };

  public sanitize(event: DomainEvent<any>): PersistenceEventV1DTO {
    const fieldsToRemove = this.transportOnlyFields[event.type];
    
    if (!fieldsToRemove || fieldsToRemove.length === 0) {
      return event as PersistenceEventV1DTO;
    }

    // Pure functional omission
    const sanitizedPayload = Object.fromEntries(
      Object.entries(event.payload).filter(([key]) => !fieldsToRemove.includes(key))
    );

    return { 
      ...event, 
      payload: sanitizedPayload 
    };
  }
}
