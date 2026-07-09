import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { ResponseEvents } from '../../core/event-bus/registry';
import { SessionId } from '../../core/types/session.types';
import { DomainEvent } from '../../core/event-bus/contracts';

export interface ResponseSnapshot {
  sessionId: SessionId;
  promptHash: string;
  isStarting: boolean;
  deltaText: string | null;
  isCompleted: boolean;
  chunkLength: number;
  totalLength: number;
  durationMs: number;
}

/**
 * Pure, stateless translator that converts a DOM observation snapshot
 * into an ordered array of canonical domain events.
 * 
 * Does not cache DOM nodes or hold any state variables.
 */
export function translateResponseSnapshot(snapshot: ResponseSnapshot): DomainEvent<any>[] {
  const events: DomainEvent<any>[] = [];
  
  if (snapshot.isStarting) {
    events.push(createDomainEvent(
      ResponseEvents.STARTED,
      snapshot.sessionId,
      'perception.response',
      { promptHash: snapshot.promptHash }
    ));
  }
  
  if (snapshot.deltaText !== null && snapshot.deltaText.length > 0) {
    events.push(createDomainEvent(
      ResponseEvents.CHUNK,
      snapshot.sessionId,
      'perception.response',
      {
        chunkText: snapshot.deltaText,
        chunkLength: snapshot.chunkLength,
        totalLength: snapshot.totalLength
      }
    ));
  }
  
  if (snapshot.isCompleted) {
    events.push(createDomainEvent(
      ResponseEvents.COMPLETED,
      snapshot.sessionId,
      'perception.response',
      {
        responseLength: snapshot.totalLength,
        durationMs: snapshot.durationMs
      }
    ));
  }
  
  return events;
}
