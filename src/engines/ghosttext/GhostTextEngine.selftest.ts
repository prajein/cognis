/**
 * Ghost Text — self-test
 *
 * What & why: the Definition of Done requires every module to ship a tiny
 * self-test. Framework-free (no jest/vitest) and fixture-injected so behaviour
 * is verified deterministically, independent of `ghosttext_stems.json`.
 *
 * Run (after a throwaway compile, since the repo has no bundler yet):
 *   tsc --module commonjs --moduleResolution node10 --ignoreDeprecations 6.0 \
 *       --rootDir src --outDir .selftest --noEmit false --resolveJsonModule
 *   node .selftest/engines/ghosttext/GhostTextEngine.selftest.js
 */

import { EventBus } from "../../core/event-bus/EventBus";
import { ErrorReporter } from "../../core/event-bus/types";
import { DomainEvent } from "../../core/event-bus/contracts";
import { GhostTextStemsConfig } from "../../core/config/ghosttext-stems-loader";
import {
  toSessionId,
  toEventId,
  toTimestamp,
  SessionId,
  Timestamp,
} from "../../core/types/session.types";
import { GapType } from "../../core/types/gap.types";
import { GhostTextEngine } from "./GhostTextEngine";

// ---------------------------------------------------------------------------
// Tiny test harness
// ---------------------------------------------------------------------------

interface SelfTestReport {
  readonly passed: number;
  readonly failed: number;
  readonly failures: readonly string[];
}

class Checker {
  passed = 0;
  failed = 0;
  readonly failures: string[] = [];
  ok(condition: boolean, label: string): void {
    if (condition) this.passed++;
    else {
      this.failed++;
      this.failures.push(label);
    }
  }
  eq(actual: unknown, expected: unknown, label: string): void {
    this.ok(actual === expected, `${label} (expected ${String(expected)}, got ${String(actual)})`);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE: GhostTextStemsConfig = {
  version: "0.0.0",
  settings: { pauseThresholdMs: 1200, gapRecencyMs: 8000, maxStemLength: 120 },
  stems: {
    intentionality: ["My goal is ", "What I want is "],
    audience: ["This is for "],
    constraint: ["It needs to "],
    stakes: ["This matters because "],
    assumption: ["For context, "],
    mechanism: ["The approach is "],
    temporal: ["The timeline is "],
    second_order: ["A knock-on effect is "],
  },
};

const silentReporter: ErrorReporter = { report: () => {} };
const SESSION: SessionId = toSessionId("sess-gt");

function deterministicIds(): () => ReturnType<typeof toEventId> {
  let n = 0;
  return () => toEventId(`gt-${++n}`);
}

function newEngine(bus: EventBus, config: GhostTextStemsConfig = FIXTURE): GhostTextEngine {
  return new GhostTextEngine(bus, {
    config,
    idFactory: deterministicIds(),
    clock: () => toTimestamp(999),
  });
}

function emitGap(
  bus: EventBus,
  gapType: GapType,
  at: number,
  session: SessionId = SESSION,
  confidence = 0.7,
): void {
  bus.publish("gap.detected", {
    id: toEventId(`gap-${gapType}-${at}`),
    type: "gap.detected",
    timestamp: toTimestamp(at) as Timestamp,
    sessionId: session,
    source: "test",
    payload: { gapType, confidence },
  });
}

function emitPause(bus: EventBus, durationMs: number, at: number, session: SessionId = SESSION): void {
  bus.publish("pause.detected", {
    id: toEventId(`pause-${at}`),
    type: "pause.detected",
    timestamp: toTimestamp(at) as Timestamp,
    sessionId: session,
    source: "test",
    payload: { durationMs, textLength: 20 },
  });
}

function capture(bus: EventBus): DomainEvent<{ gapType: string; stem: string; interventionId?: string }>[] {
  const out: DomainEvent<{ gapType: string; stem: string; interventionId?: string }>[] = [];
  bus.subscribe("ghosttext.generated", (e) => out.push(e));
  return out;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export function runGhostTextSelfTest(): SelfTestReport {
  const c = new Checker();

  // 1. Long pause after a recent gap → a stem is offered.
  {
    const bus = new EventBus(silentReporter);
    const got = capture(bus);
    newEngine(bus).start();
    emitGap(bus, "intentionality", 1000);
    emitPause(bus, 1500, 1200);
    c.eq(got.length, 1, "long pause after recent gap emits ghost text");
    c.eq(got[0]?.payload.gapType, "intentionality", "stem targets the detected gap");
    c.eq(got[0]?.payload.stem, "My goal is ", "first stem in the list is used");
    c.eq(got[0]?.source, "ghost-text-engine", "event source is the engine name");
    c.eq(got[0]?.timestamp as unknown as number, 999, "event uses the injected clock");
  }

  // 2. Rotation: a second cycle yields the next stem.
  {
    const bus = new EventBus(silentReporter);
    const got = capture(bus);
    newEngine(bus).start();
    emitGap(bus, "intentionality", 1000);
    emitPause(bus, 1500, 1100);
    emitGap(bus, "intentionality", 2000);
    emitPause(bus, 1500, 2100);
    c.eq(got.length, 2, "two cycles emit two stems");
    c.eq(got[0]?.payload.stem, "My goal is ", "first cycle uses stem[0]");
    c.eq(got[1]?.payload.stem, "What I want is ", "second cycle rotates to stem[1]");
  }

  // 3. Pause too short → nothing.
  {
    const bus = new EventBus(silentReporter);
    const got = capture(bus);
    newEngine(bus).start();
    emitGap(bus, "audience", 1000);
    emitPause(bus, 500, 1100);
    c.eq(got.length, 0, "sub-threshold pause emits nothing");
  }

  // 4. Stale gap (outside the recency window) → nothing.
  {
    const bus = new EventBus(silentReporter);
    const got = capture(bus);
    newEngine(bus).start();
    emitGap(bus, "constraint", 1000);
    emitPause(bus, 1500, 1000 + 8001);
    c.eq(got.length, 0, "gap older than the recency window emits nothing");
  }

  // 5. Pause with no prior gap → nothing.
  {
    const bus = new EventBus(silentReporter);
    const got = capture(bus);
    newEngine(bus).start();
    emitPause(bus, 1500, 1200);
    c.eq(got.length, 0, "pause with no detected gap emits nothing");
  }

  // 6. Gap and pause in different sessions → nothing.
  {
    const bus = new EventBus(silentReporter);
    const got = capture(bus);
    newEngine(bus).start();
    emitGap(bus, "mechanism", 1000, toSessionId("sess-A"));
    emitPause(bus, 1500, 1200, toSessionId("sess-B"));
    c.eq(got.length, 0, "cross-session gap/pause emits nothing");
  }

  // 7. A stem longer than maxStemLength is suppressed.
  {
    const tightConfig: GhostTextStemsConfig = {
      ...FIXTURE,
      settings: { ...FIXTURE.settings, maxStemLength: 5 },
      stems: { ...FIXTURE.stems, intentionality: ["this stem is far too long"] },
    };
    const bus = new EventBus(silentReporter);
    const got = capture(bus);
    newEngine(bus, tightConfig).start();
    emitGap(bus, "intentionality", 1000);
    emitPause(bus, 1500, 1200);
    c.eq(got.length, 0, "over-length stem is suppressed");
  }

  // 8. Strongest-gap: when a pass emits several gaps (strongest first), the stem
  //    addresses the strongest, not whichever arrived last.
  {
    const bus = new EventBus(silentReporter);
    const got = capture(bus);
    newEngine(bus).start();
    emitGap(bus, "intentionality", 1000, SESSION, 0.6);
    emitGap(bus, "audience", 1000, SESSION, 0.55);
    emitGap(bus, "constraint", 1000, SESSION, 0.55);
    emitPause(bus, 1500, 1100);
    c.eq(got.length, 1, "strongest-gap: exactly one stem");
    c.eq(got[0]?.payload.gapType, "intentionality", "strongest-gap: stem addresses the strongest gap");
  }

  // 9. Intervention ID is deterministic if idFactory is provided.
  {
    const bus = new EventBus(silentReporter);
    const got = capture(bus);
    const engine = new GhostTextEngine(bus, {
      config: FIXTURE,
      idFactory: () => toEventId("injected-id"),
      clock: () => toTimestamp(999),
    });
    engine.start();
    emitGap(bus, "intentionality", 1000);
    emitPause(bus, 1500, 1200);
    c.eq(got.length, 1, "deterministic id: stem is emitted");
    c.eq(got[0]?.payload.interventionId, "injected-id", "deterministic id: uses injected factory");
  }

  return { passed: c.passed, failed: c.failed, failures: c.failures };
}

// Auto-run when executed directly (compiled to CommonJS for the throwaway run).
declare const require: undefined | { main?: unknown };
declare const module: unknown;
if (typeof require !== "undefined" && (require as { main?: unknown }).main === module) {
  const report = runGhostTextSelfTest();
  // eslint-disable-next-line no-console
  console.log(`[ghost-text self-test] passed=${report.passed} failed=${report.failed}`);
  if (report.failed > 0) {
    // eslint-disable-next-line no-console
    console.error("Failures:\n - " + report.failures.join("\n - "));
    (globalThis as { process?: { exit(code: number): void } }).process?.exit(1);
  }
}
