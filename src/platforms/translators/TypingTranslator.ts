import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { PromptEvents, CognitiveEvents } from '../../core/event-bus/registry';
import { SessionId } from '../../core/types/session.types';
import { DomainEvent } from '../../core/event-bus/contracts';

export interface TypingSnapshot {
  sessionId: SessionId;
  isTyping: boolean;
  textLength: number;
  wordCount: number;
  currentTextHash: string;
  revisionDepth: number;
  
  isPause: boolean;
  pauseDurationMs: number;

  isSent: boolean;
}

/**
 * Pure, stateless translator that converts a raw typing/input observation
 * into canonical domain events (prompt.typed and pause.detected).
 * 
 * Contains no debounce timers, memory of previous inputs, or DOM references.
 */
export function translateTypingSnapshot(snapshot: TypingSnapshot): DomainEvent<any>[] {
  const events: DomainEvent<any>[] = [];
  
  if (snapshot.isTyping) {
    events.push(createDomainEvent(
      PromptEvents.TYPED,
      snapshot.sessionId,
      'perception.typing',
      {
        textLength: snapshot.textLength,
        wordCount: snapshot.wordCount,
        currentTextHash: snapshot.currentTextHash,
        revisionDepth: snapshot.revisionDepth
      }
    ));
  }

  if (snapshot.isSent) {
    events.push(createDomainEvent(
      PromptEvents.SENT,
      snapshot.sessionId,
      'perception.typing',
      {
        promptHash: snapshot.currentTextHash,
        textLength: snapshot.textLength,
        wordCount: snapshot.wordCount,
        wasEnriched: false
      }
    ));
  }
  
  if (snapshot.isPause) {
    events.push(createDomainEvent(
      CognitiveEvents.PAUSE_DETECTED,
      snapshot.sessionId,
      'perception.typing',
      {
        durationMs: snapshot.pauseDurationMs,
        textLength: snapshot.textLength
      }
    ));
  }
  
  return events;
}
