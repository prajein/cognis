import { DomainEvent } from '../../core/event-bus/contracts';
import { EventType, ResponseEvents, PromptEvents } from '../../core/event-bus/registry';

export interface PersistenceEventV1DTO extends Omit<DomainEvent<any>, 'payload'> {
  readonly payload: Record<string, unknown>;
}

type TransportPolicyMap = {
  [K in EventType]?: ReadonlyArray<string>; // Fields to KEEP (allowlist) or fields to REMOVE (blocklist) depending on strategy
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
  // For privacy-sensitive events, we use an explicit ALLOWLIST.
  // Any field not on this list is dropped, protecting against unknown raw text fields.
  private readonly allowedFields: TransportPolicyMap = {
    [PromptEvents.TYPED]: ['textLength', 'wordCount', 'currentTextHash', 'revisionDepth'],
    [PromptEvents.SENT]: ['promptHash', 'textLength', 'wordCount', 'wasEnriched'],
    [PromptEvents.CANCELLED]: ['textLength', 'textHash'],
    [PromptEvents.ENRICHED]: ['enrichmentVersion', 'appliedLayers', 'stateLabel'],
    [ResponseEvents.STARTED]: ['promptHash', 'promptEventId', 'wasEnriched'],
    [ResponseEvents.COMPLETED]: ['responseLength', 'durationMs'],
    [ResponseEvents.ABANDONED]: ['partialLength', 'durationMs'],
    [ResponseEvents.ANALYSIS_COMPLETED]: [
      'promptHash', 'promptEventId', 'wasEnriched',
      'structuralScore', 'reasoningScore', 'completenessScore',
      'assumptionScore', 'gapCompletionScore', 'qualityScore', 'flags'
    ]
  };

  // For non-privacy-sensitive events with known transient data, we use a BLOCKLIST.
  private readonly blockedFields: TransportPolicyMap = {
    [ResponseEvents.CHUNK]: ['chunkText']
  };

  public sanitize(event: DomainEvent<any>): PersistenceEventV1DTO {
    let sanitizedPayload = event.payload;

    const allowed = this.allowedFields[event.type];
    if (allowed) {
      sanitizedPayload = Object.fromEntries(
        Object.entries(sanitizedPayload).filter(([key]) => allowed.includes(key))
      );
    }

    const blocked = this.blockedFields[event.type];
    if (blocked) {
      sanitizedPayload = Object.fromEntries(
        Object.entries(sanitizedPayload).filter(([key]) => !blocked.includes(key))
      );
    }

    return {
      ...event,
      payload: sanitizedPayload
    };
  }
}
