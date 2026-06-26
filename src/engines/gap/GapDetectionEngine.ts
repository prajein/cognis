/**
 * GapDetectionEngine — Surface A cognitive-gap detection
 *
 * What & why: detects under-specified ("gappy") prompts so the Ghost Text and
 * Enrichment engines can help the user say what they mean. It owns no DOM and no
 * storage; it consumes domain events for behavioural context and publishes
 * `gap.detected` onto the EventBus (Module Boundaries: "Gap Engine consumes
 * prompt + state, produces gap.detected").
 *
 * Architecture note — the sensory-input edge:
 *   Raw prompt text is TRANSIENT SENSORY INPUT, not a domain event. The event
 *   contracts deliberately carry only a `currentTextHash`, never the text, so
 *   that nothing persists raw prompts (Local-First law). Detection still needs
 *   the words, so the perception layer hands live text to `analyze(text)`
 *   in-memory — the same shape future Arc hardware will use to hand raw signal
 *   frames to a state provider. Only the engine's OUTPUT (`gap.detected`,
 *   carrying `{ gapType, confidence }` — no text) flows through the bus and is
 *   persisted. This keeps the domain-event flow on the bus while never letting
 *   raw text touch the log.
 *
 * Latency: detection is synchronous lexical scanning (microseconds) — well
 * inside budget; nothing here blocks the user or the dispatch loop.
 */

import { EventBusContract } from "../../core/event-bus";
import { StateLabel } from "../../core/types/state.types";
import { SessionId } from "../../core/types/session.types";
import {
  Clock,
  EventIdFactory,
  createDomainEvent,
} from "../../shared/events/createDomainEvent";
import { GapHeuristics } from "./GapHeuristics";

/** Construction options; all optional, with runtime-standard defaults. */
export interface GapDetectionEngineOptions {
  /** Heuristics implementation. Injectable so a future model can drop in. */
  readonly heuristics?: GapHeuristics;
  /** `source` stamped on emitted events. */
  readonly source?: string;
  /** Clock override (tests / hardware). */
  readonly clock?: Clock;
  /** Event-id override (tests / hardware). */
  readonly idFactory?: EventIdFactory;
  /** Default cognitive state before the first `state.changed`. */
  readonly initialState?: StateLabel;
}

const DEFAULT_SOURCE = "gap-detection-engine";

export class GapDetectionEngine {
  private readonly eventBus: EventBusContract;
  private readonly heuristics: GapHeuristics;
  private readonly source: string;
  private readonly clock: Clock | undefined;
  private readonly idFactory: EventIdFactory | undefined;

  /** Behavioural context tracked from inbound events. */
  private currentState: StateLabel;
  private revisionDepth = 0;
  private currentSessionId: SessionId | null = null;

  /** Subscriptions to tear down on dispose(). */
  private readonly unsubscribes: Array<() => void> = [];
  private started = false;

  constructor(eventBus: EventBusContract, options: GapDetectionEngineOptions = {}) {
    this.eventBus = eventBus;
    this.heuristics = options.heuristics ?? new GapHeuristics();
    this.source = options.source ?? DEFAULT_SOURCE;
    this.clock = options.clock;
    this.idFactory = options.idFactory;
    this.currentState = options.initialState ?? "stretch";
  }

  /**
   * Subscribes to the events that supply behavioural context. Idempotent.
   * Returns a dispose function that removes all subscriptions.
   */
  public start(): () => void {
    if (this.started) {
      return () => this.dispose();
    }
    this.started = true;

    this.unsubscribes.push(
      this.eventBus.subscribe("state.changed", (event) => {
        this.currentState = event.payload.currentState;
        this.currentSessionId = event.sessionId;
      }),
    );

    this.unsubscribes.push(
      this.eventBus.subscribe("prompt.typed", (event) => {
        this.revisionDepth = event.payload.revisionDepth;
        this.currentSessionId = event.sessionId;
      }),
    );

    return () => this.dispose();
  }

  /**
   * The sensory-input edge. The perception layer calls this in-memory with the
   * user's live prompt text (typically on a cognitive pause). Runs the
   * heuristics and publishes a `gap.detected` event per signal above threshold.
   *
   * No-op until a session is known (a session id arrives with the first event).
   * The `text` argument is never stored, hashed into an event, or echoed back.
   */
  public analyze(text: string): void {
    const sessionId = this.currentSessionId;
    if (sessionId === null) {
      return;
    }

    const { signals } = this.heuristics.detect({
      text,
      state: this.currentState,
      revisionDepth: this.revisionDepth,
    });

    for (const signal of signals) {
      const event = createDomainEvent(
        "gap.detected",
        sessionId,
        this.source,
        { gapType: signal.gapType, confidence: signal.confidence },
        { clock: this.clock, idFactory: this.idFactory },
      );
      this.eventBus.publish("gap.detected", event);
    }
  }

  /** Removes all subscriptions. Safe to call multiple times. */
  public dispose(): void {
    while (this.unsubscribes.length > 0) {
      const unsub = this.unsubscribes.pop();
      unsub?.();
    }
    this.started = false;
  }
}
