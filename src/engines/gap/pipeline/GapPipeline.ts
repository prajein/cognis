/**
 * GapPipeline — a testable, in-memory driver for the gap-detection rules
 *
 * What & why (Week 2: "wire the gap rules into a testable pipeline"):
 *   In production the ChatGPTAdapter observes the prompt textarea and calls
 *   `gapEngine.analyze(text)` on every input, and the engine reads its
 *   behavioural context (cognitive state, revision depth) from domain events.
 *   That path needs a live browser + DOM, which makes the rules hard to exercise
 *   and impossible to regression-test.
 *
 *   GapPipeline reproduces exactly that wiring — a real `GapDetectionEngine`
 *   reading the real `gap_rules.json`, driven through the same `analyze()`
 *   sensory-input edge — but in-memory and scriptable. You `feed()` it a prompt
 *   plus optional context (state, revision depth) and it returns the
 *   `gap.detected` payloads the engine produced. No DOM, no persistence, fully
 *   deterministic.
 *
 * This is the harness the team runs against a scenario corpus (see
 * `scenarios.ts`) to tune `gap_rules.json` without breaking existing behaviour,
 * and to demo the Surface-A gap flow off a live site (sprint: "build against the
 * local mock harness through Week 4").
 *
 * It owns an isolated EventBus, so nothing it emits is persisted and no raw text
 * ever touches the bus (only the engine's `{ gapType, confidence }` conclusions),
 * consistent with the Transient Transport Data Policy (ADR-019).
 */

import { EventBus } from "../../../core/event-bus/EventBus";
import {
  EventBusContract,
  ErrorReporter,
  createDomainEvent,
} from "../../../core/event-bus";
import { GapDetectedPayload } from "../../../core/event-bus/contracts";
import { StateLabel } from "../../../core/types/state.types";
import { SessionId, toSessionId } from "../../../core/types/session.types";
import { GapHeuristics } from "../GapHeuristics";
import { GapDetectionEngine } from "../GapDetectionEngine";

/** A single prompt scenario fed through the pipeline. */
export interface GapPromptInput {
  /** The live prompt text (transient; never persisted or evented). */
  readonly text: string;
  /** Cognitive state to establish before analysis (default: 'stretch'). */
  readonly state?: StateLabel;
  /** Revision depth to report via `prompt.typed` (default: 0). */
  readonly revisionDepth?: number;
}

/** Options for constructing a pipeline. */
export interface GapPipelineOptions {
  /** Inject a bus to share with other modules; defaults to an isolated one. */
  readonly eventBus?: EventBusContract;
  /** Inject an engine; defaults to a fresh `GapDetectionEngine`. */
  readonly engine?: GapDetectionEngine;
  /** Inject heuristics (e.g. a fixture rule set); defaults to the real config. */
  readonly heuristics?: GapHeuristics;
  /** Error reporter for the internal bus (defaults to a silent one). */
  readonly errorReporter?: ErrorReporter;
  /** Session id stamped on the context events (defaults to a stable test id). */
  readonly sessionId?: SessionId;
}

const SILENT_REPORTER: ErrorReporter = { report: () => {} };
const PIPELINE_SOURCE = "gap-pipeline";

export class GapPipeline {
  private readonly eventBus: EventBusContract;
  private readonly engine: GapDetectionEngine;
  private readonly sessionId: SessionId;

  /** Buffer of gap.detected payloads captured since the last `feed()`. */
  private readonly captured: GapDetectedPayload[] = [];
  private currentState: StateLabel = "stretch";
  private unsubscribe: (() => void) | null = null;
  private started = false;

  constructor(options: GapPipelineOptions = {}) {
    this.eventBus =
      options.eventBus ?? new EventBus(options.errorReporter ?? SILENT_REPORTER);
    this.engine =
      options.engine ??
      new GapDetectionEngine(this.eventBus, { heuristics: options.heuristics });
    this.sessionId = options.sessionId ?? toSessionId("gap-pipeline-session");
  }

  /**
   * Wires the engine and capture subscription, then seeds a session so
   * `analyze()` is live (the engine learns the session id from context events).
   * Idempotent.
   */
  public start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    this.engine.start();
    this.unsubscribe = this.eventBus.subscribe("gap.detected", (event) => {
      this.captured.push(event.payload);
    });

    // Seed the engine with a session id + baseline state.
    this.emitStateChanged(this.currentState, this.currentState);
  }

  /**
   * Feeds one prompt (plus optional context) through the real engine and
   * returns the gap.detected payloads it produced for this prompt.
   */
  public feed(input: GapPromptInput): readonly GapDetectedPayload[] {
    if (!this.started) {
      this.start();
    }

    const nextState = input.state ?? "stretch";
    if (nextState !== this.currentState) {
      this.emitStateChanged(this.currentState, nextState);
      this.currentState = nextState;
    }

    // Report revision depth via prompt.typed (metadata only — no raw text).
    this.eventBus.publish(
      "prompt.typed",
      createDomainEvent("prompt.typed", this.sessionId, PIPELINE_SOURCE, {
        textLength: input.text.length,
        wordCount: countWords(input.text),
        currentTextHash: `len:${input.text.length}`,
        revisionDepth: input.revisionDepth ?? 0,
      }),
    );

    // Drive the same sensory-input edge the DOM adapter uses.
    this.captured.length = 0;
    this.engine.analyze(input.text);
    return [...this.captured];
  }

  /** Tears down subscriptions and the engine. Safe to call repeatedly. */
  public dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.engine.dispose();
    this.started = false;
  }

  private emitStateChanged(previous: StateLabel, current: StateLabel): void {
    this.eventBus.publish(
      "state.changed",
      createDomainEvent("state.changed", this.sessionId, PIPELINE_SOURCE, {
        previousState: previous,
        currentState: current,
        confidence: 1,
      }),
    );
  }
}

/** Counts whitespace-delimited words (matches the perception layer's intent). */
function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}
