/**
 * SurfaceAPipeline — end-to-end, in-memory harness for the Surface A co-pilot
 *
 * What & why: the gap engine and the ghost-text engine each have their own unit
 * tests, but the *product* is the two of them working together over the
 * EventBus — exactly as the content script wires them. This harness composes the
 * REAL `GapDetectionEngine` + REAL `GhostTextEngine` (both reading their real
 * config) on one bus and lets you drive a whole co-pilot moment in memory:
 *
 *     you type a vague prompt  ->  gaps are detected
 *     you pause to think       ->  a ghost-text stem is offered for a gap
 *
 * It's the "does the whole thing actually work" proof and a no-browser demo
 * script for the Friday review. Nothing here is a production component — the
 * live wiring is `content/index.ts` (ChatGPTAdapter -> engines). This mirrors
 * that wiring so the flow can be exercised deterministically.
 *
 * Privacy: raw text is handed to `gapEngine.analyze()` in-memory only; the bus
 * carries just the `{ gapType, confidence }` / `{ gapType, stem }` conclusions
 * (Local-First; ADR-019). The harness bus has no store subscriber.
 */

import { EventBus } from "../../../core/event-bus/EventBus";
import {
  EventBusContract,
  ErrorReporter,
  createDomainEvent,
} from "../../../core/event-bus";
import {
  GapDetectedPayload,
  GhostTextGeneratedPayload,
} from "../../../core/event-bus/contracts";
import { StateLabel } from "../../../core/types/state.types";
import { SessionId, toSessionId } from "../../../core/types/session.types";
import { GapDetectionEngine } from "../../gap/GapDetectionEngine";
import { GhostTextEngine } from "../GhostTextEngine";

/** Result of a full co-pilot moment: type a prompt, then pause. */
export interface SurfaceARun {
  readonly prompt: string;
  readonly gaps: readonly GapDetectedPayload[];
  readonly stems: readonly GhostTextGeneratedPayload[];
}

export interface SurfaceAPipelineOptions {
  readonly eventBus?: EventBusContract;
  readonly errorReporter?: ErrorReporter;
  readonly sessionId?: SessionId;
}

const SILENT_REPORTER: ErrorReporter = { report: () => {} };
const PERCEPTION_SOURCE = "perception";

export class SurfaceAPipeline {
  private readonly eventBus: EventBusContract;
  private readonly gapEngine: GapDetectionEngine;
  private readonly ghostEngine: GhostTextEngine;
  private readonly sessionId: SessionId;

  private readonly gapBuffer: GapDetectedPayload[] = [];
  private readonly stemBuffer: GhostTextGeneratedPayload[] = [];
  private currentState: StateLabel = "stretch";
  private readonly unsubscribes: Array<() => void> = [];
  private started = false;

  constructor(options: SurfaceAPipelineOptions = {}) {
    this.eventBus =
      options.eventBus ?? new EventBus(options.errorReporter ?? SILENT_REPORTER);
    this.gapEngine = new GapDetectionEngine(this.eventBus);
    this.ghostEngine = new GhostTextEngine(this.eventBus);
    this.sessionId = options.sessionId ?? toSessionId("surface-a-session");
  }

  /** Starts both engines and the capture subscriptions, and seeds a session. */
  public start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    this.gapEngine.start();
    this.ghostEngine.start();

    this.unsubscribes.push(
      this.eventBus.subscribe("gap.detected", (e) => this.gapBuffer.push(e.payload)),
    );
    this.unsubscribes.push(
      this.eventBus.subscribe("ghosttext.generated", (e) =>
        this.stemBuffer.push(e.payload),
      ),
    );

    // Seed the engines with a session id + baseline cognitive state.
    this.emitStateChanged(this.currentState, this.currentState);
  }

  /** Sets the cognitive state the perception layer would infer. */
  public setState(state: StateLabel): void {
    if (!this.started) this.start();
    if (state !== this.currentState) {
      this.emitStateChanged(this.currentState, state);
      this.currentState = state;
    }
  }

  /**
   * Simulates the DOM adapter seeing the user type `text`: reports typing
   * metadata and hands the transient text to the gap engine. Returns the gaps
   * detected for this text.
   */
  public type(text: string, revisionDepth = 0): readonly GapDetectedPayload[] {
    if (!this.started) this.start();

    this.eventBus.publish(
      "prompt.typed",
      createDomainEvent("prompt.typed", this.sessionId, PERCEPTION_SOURCE, {
        textLength: text.length,
        wordCount: countWords(text),
        currentTextHash: `len:${text.length}`,
        revisionDepth,
      }),
    );

    this.gapBuffer.length = 0;
    this.gapEngine.analyze(text);
    return [...this.gapBuffer];
  }

  /**
   * Simulates a thinking pause of `durationMs`. Returns any ghost-text stems the
   * ghost-text engine offered in response.
   */
  public pause(durationMs: number): readonly GhostTextGeneratedPayload[] {
    if (!this.started) this.start();

    this.stemBuffer.length = 0;
    this.eventBus.publish(
      "pause.detected",
      createDomainEvent("pause.detected", this.sessionId, PERCEPTION_SOURCE, {
        durationMs,
        textLength: 0,
      }),
    );
    return [...this.stemBuffer];
  }

  /**
   * Convenience for a whole co-pilot moment: (optionally set state), type the
   * prompt, then pause. Returns the gaps found and stems offered.
   */
  public run(
    prompt: string,
    opts: { state?: StateLabel; pauseMs?: number; revisionDepth?: number } = {},
  ): SurfaceARun {
    if (!this.started) this.start();
    if (opts.state) this.setState(opts.state);
    const gaps = this.type(prompt, opts.revisionDepth ?? 0);
    const stems = this.pause(opts.pauseMs ?? 1500);
    return { prompt, gaps, stems };
  }

  /** Tears down subscriptions and both engines. */
  public dispose(): void {
    while (this.unsubscribes.length > 0) {
      this.unsubscribes.pop()?.();
    }
    this.gapEngine.dispose();
    this.ghostEngine.dispose();
    this.started = false;
  }

  private emitStateChanged(previous: StateLabel, current: StateLabel): void {
    this.eventBus.publish(
      "state.changed",
      createDomainEvent("state.changed", this.sessionId, PERCEPTION_SOURCE, {
        previousState: previous,
        currentState: current,
        confidence: 1,
      }),
    );
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}
