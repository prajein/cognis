/**
 * SyntheticEventGenerator — Domain Event builder for the Mock Harness
 *
 * What & why: wraps `createDomainEvent` to provide convenient builder methods
 * for every event type that the Mock Harness needs to simulate. Each method
 * returns a fully-formed, type-checked `DomainEvent<T>` envelope ready for
 * `EventBusContract.publish()`.
 *
 * Architectural constraints:
 * - Depends ONLY on `core/event-bus` and `core/types`.
 * - Never imports engines, storage, platforms, or sidepanel modules.
 * - All identifiers use branded types (`SessionId`, `EventId`, `Timestamp`).
 * - Raw prompt text is hashed via `cyrb53` before inclusion in payloads.
 *   The hash function is duplicated here (rather than importing from
 *   `TypingObserver`) to avoid a dependency from mock → perception layer.
 */

import { DomainEvent, CognisEventMap } from '../../core/event-bus/contracts';
import {
  createDomainEvent,
  EventFactoryOptions,
} from '../../core/event-bus/createDomainEvent';
import {
  SessionEvents,
  PromptEvents,
  CognitiveEvents,
  ResponseEvents,
  HardwareEvents,
  InsightEvents,
} from '../../core/event-bus/registry';
import { SessionId } from '../../core/types/session.types';
import { StateLabel } from '../../core/types/state.types';
import { GapType } from '../../core/types/gap.types';

// ---------------------------------------------------------------------------
// Source tag — stamped on every event envelope produced by this generator.
// ---------------------------------------------------------------------------

const SOURCE = 'mock-harness';

// ---------------------------------------------------------------------------
// Hash utility (cyrb53)
// ---------------------------------------------------------------------------

/**
 * cyrb53 — fast, non-cryptographic string hash.
 *
 * Duplicated from `TypingObserver` to avoid a cross-layer dependency
 * (mock → perception). Both implementations must produce identical output
 * for the same input. If the algorithm is ever centralised into a shared
 * utility, both call sites should be updated.
 */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export class SyntheticEventGenerator {
  constructor(
    private readonly sessionId: SessionId,
    private readonly options: EventFactoryOptions = {},
  ) {}

  // ── Session Events ──────────────────────────────────────────────────────

  sessionStarted(
    platform: string,
    taskId?: string,
  ): DomainEvent<CognisEventMap['session.started']> {
    return createDomainEvent(
      SessionEvents.STARTED,
      this.sessionId,
      SOURCE,
      { platform, taskId },
      this.options,
    );
  }

  sessionEnded(
    reason: 'tab_closed' | 'navigation' | 'timeout' | 'explicit' = 'explicit',
  ): DomainEvent<CognisEventMap['session.ended']> {
    return createDomainEvent(
      SessionEvents.ENDED,
      this.sessionId,
      SOURCE,
      { reason },
      this.options,
    );
  }

  sessionPaused(
    reason: 'tab_hidden' | 'idle' | 'explicit' = 'idle',
  ): DomainEvent<CognisEventMap['session.paused']> {
    return createDomainEvent(
      SessionEvents.PAUSED,
      this.sessionId,
      SOURCE,
      { reason },
      this.options,
    );
  }

  sessionResumed(
    pauseDurationMs: number,
  ): DomainEvent<CognisEventMap['session.resumed']> {
    return createDomainEvent(
      SessionEvents.RESUMED,
      this.sessionId,
      SOURCE,
      { pauseDurationMs },
      this.options,
    );
  }

  // ── Prompt Events ──────────────────────────────────────────────────────

  promptTyped(
    text: string,
    revisionDepth = 0,
  ): DomainEvent<CognisEventMap['prompt.typed']> {
    const words = text.split(/\s+/).filter(Boolean);
    return createDomainEvent(
      PromptEvents.TYPED,
      this.sessionId,
      SOURCE,
      {
        textLength: text.length,
        wordCount: words.length,
        currentTextHash: cyrb53(text).toString(),
        revisionDepth,
      },
      this.options,
    );
  }

  promptSent(
    text: string,
    wasEnriched = false,
  ): DomainEvent<CognisEventMap['prompt.sent']> {
    const words = text.split(/\s+/).filter(Boolean);
    return createDomainEvent(
      PromptEvents.SENT,
      this.sessionId,
      SOURCE,
      {
        promptHash: cyrb53(text).toString(),
        textLength: text.length,
        wordCount: words.length,
        wasEnriched,
      },
      this.options,
    );
  }

  promptCancelled(
    text: string,
  ): DomainEvent<CognisEventMap['prompt.cancelled']> {
    return createDomainEvent(
      PromptEvents.CANCELLED,
      this.sessionId,
      SOURCE,
      {
        textLength: text.length,
        textHash: cyrb53(text).toString(),
      },
      this.options,
    );
  }

  // ── Cognitive Events ───────────────────────────────────────────────────

  pauseDetected(
    durationMs: number,
    textLength: number,
  ): DomainEvent<CognisEventMap['pause.detected']> {
    return createDomainEvent(
      CognitiveEvents.PAUSE_DETECTED,
      this.sessionId,
      SOURCE,
      { durationMs, textLength },
      this.options,
    );
  }

  stateChanged(
    previousState: StateLabel,
    currentState: StateLabel,
    confidence: number,
  ): DomainEvent<CognisEventMap['state.changed']> {
    return createDomainEvent(
      CognitiveEvents.STATE_CHANGED,
      this.sessionId,
      SOURCE,
      { previousState, currentState, confidence },
      this.options,
    );
  }

  gapDetected(
    gapType: GapType,
    confidence: number,
  ): DomainEvent<CognisEventMap['gap.detected']> {
    return createDomainEvent(
      CognitiveEvents.GAP_DETECTED,
      this.sessionId,
      SOURCE,
      { gapType, confidence },
      this.options,
    );
  }

  // ── Response Events ────────────────────────────────────────────────────

  responseStarted(
    promptHash: string,
  ): DomainEvent<CognisEventMap['response.started']> {
    return createDomainEvent(
      ResponseEvents.STARTED,
      this.sessionId,
      SOURCE,
      { promptHash },
      this.options,
    );
  }

  responseChunk(
    chunkText: string,
    totalLength: number,
  ): DomainEvent<CognisEventMap['response.chunk']> {
    return createDomainEvent(
      ResponseEvents.CHUNK,
      this.sessionId,
      SOURCE,
      { chunkText, chunkLength: chunkText.length, totalLength },
      this.options,
    );
  }

  responseCompleted(
    responseLength: number,
    durationMs: number,
  ): DomainEvent<CognisEventMap['response.completed']> {
    return createDomainEvent(
      ResponseEvents.COMPLETED,
      this.sessionId,
      SOURCE,
      { responseLength, durationMs },
      this.options,
    );
  }

  responseAbandoned(
    partialLength: number,
    durationMs: number,
  ): DomainEvent<CognisEventMap['response.abandoned']> {
    return createDomainEvent(
      ResponseEvents.ABANDONED,
      this.sessionId,
      SOURCE,
      { partialLength, durationMs },
      this.options,
    );
  }

  // ── Insight Events ───────────────────────────────────────────────────────

  insightGenerated(
    domain: import('../../core/types/insight.types').TaxonomyDomain,
    title: string,
    summary: string,
    confidence: number = 0.95,
    evidenceCount: number = 20,
  ): DomainEvent<CognisEventMap['insight.generated']> {
    return createDomainEvent(
      InsightEvents.GENERATED,
      this.sessionId,
      SOURCE,
      { 
        insightId: crypto.randomUUID(), 
        domain, 
        title, 
        summary, 
        confidence, 
        evidenceCount 
      },
      this.options,
    );
  }

  // ── Hardware Events ────────────────────────────────────────────────────

  hardwareConnected(
    deviceId: string,
    deviceType: string,
    firmwareVersion: string,
  ): DomainEvent<CognisEventMap['hardware.connected']> {
    return createDomainEvent(
      HardwareEvents.CONNECTED,
      this.sessionId,
      SOURCE,
      { deviceId, deviceType, firmwareVersion },
      this.options,
    );
  }

  hardwareDisconnected(
    deviceId: string,
    reason: 'explicit' | 'timeout' | 'error' = 'explicit',
  ): DomainEvent<CognisEventMap['hardware.disconnected']> {
    return createDomainEvent(
      HardwareEvents.DISCONNECTED,
      this.sessionId,
      SOURCE,
      { deviceId, reason },
      this.options,
    );
  }

  hardwareSignalReceived(
    deviceId: string,
    signalType: string,
    value: number,
    confidence: number,
  ): DomainEvent<CognisEventMap['hardware.signal.received']> {
    return createDomainEvent(
      HardwareEvents.SIGNAL_RECEIVED,
      this.sessionId,
      SOURCE,
      { deviceId, signalType, value, confidence },
      this.options,
    );
  }
}
