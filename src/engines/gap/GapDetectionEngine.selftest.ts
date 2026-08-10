/**
 * Gap Detection — self-test
 *
 * What & why: the sprint's Definition of Done requires every module to ship a
 * tiny self-test. This is framework-free (no jest/vitest dependency) so it runs
 * anywhere the team later wires a runner, and it injects a fixture rule set so
 * the logic is verified deterministically, independent of `gap_rules.json`.
 *
 * Run (after a throwaway compile, since the repo has no bundler yet):
 *   tsc --module commonjs --moduleResolution node --outDir .selftest --noEmit false
 *   node .selftest/engines/gap/GapDetectionEngine.selftest.js
 *
 * Exports `runGapSelfTest()` returning a pass/fail report for any harness.
 */

import { EventBus } from "../../core/event-bus/EventBus";
import { ErrorReporter } from "../../core/event-bus/types";
import { DomainEvent } from "../../core/event-bus/contracts";
import { GapRulesConfig } from "../../core/config/gap-rules-loader";
import {
  toSessionId,
  toEventId,
  toTimestamp,
  SessionId,
} from "../../core/types/session.types";
import { GapHeuristics } from "./GapHeuristics";
import { GapDetectionEngine } from "./GapDetectionEngine";

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
    if (condition) {
      this.passed++;
    } else {
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

const FIXTURE_CONFIG: GapRulesConfig = {
  version: "0.0.0",
  // maxSignals deliberately high so logic tests are not clipped by the cap;
  // the cap itself is exercised separately below.
  settings: { minTextLength: 12, emitThreshold: 0.5, maxSignals: 8, cognitivePauseMs: 1200 },
  stateModifiers: { stretch: 0, coasting: -0.1, overload: 0.1, unknown: 0 },
  revisionModifier: { perRevision: 0.02, max: 0.1 },
  rules: [
    { gapType: "intentionality", baseConfidence: 0.6, satisfiedWhenAnyPresent: ["so that", "the goal"] },
    { gapType: "audience", baseConfidence: 0.55, satisfiedWhenAnyPresent: ["audience", "for a "] },
    { gapType: "constraint", baseConfidence: 0.55, satisfiedWhenAnyPresent: ["must", "limit"] },
    { gapType: "assumption", baseConfidence: 0.45, satisfiedWhenAnyPresent: ["assuming"] },
  ],
};

const silentReporter: ErrorReporter = { report: () => {} };

function deterministicIds(): () => ReturnType<typeof toEventId> {
  let n = 0;
  return () => toEventId(`evt-${++n}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export function runGapSelfTest(): SelfTestReport {
  const c = new Checker();

  const heuristics = new GapHeuristics(FIXTURE_CONFIG);

  // 1. A bare imperative prompt is missing intent/audience/constraint markers.
  const bare = heuristics.detect({ text: "Write a function", state: "stretch", revisionDepth: 0 });
  c.eq(bare.signals.length, 3, "bare prompt emits 3 gap signals");
  c.eq(bare.signals[0]?.gapType, "intentionality", "strongest signal is intentionality");
  c.eq(bare.signals[0]?.confidence, 0.6, "intentionality confidence is base 0.6");

  // 2. A well-specified prompt addresses every marker → no signals.
  const full = heuristics.detect({
    text: "Write a function so that it sorts, for a beginner audience, and it must stay under a limit",
    state: "stretch",
    revisionDepth: 0,
  });
  c.eq(full.signals.length, 0, "well-specified prompt emits no signals");

  // 3. State modifier: 'assumption' (base 0.45) only clears 0.5 under overload (+0.1).
  const underStretch = heuristics.detect({ text: "Write a function", state: "stretch", revisionDepth: 0 });
  c.ok(!underStretch.signals.some((s) => s.gapType === "assumption"), "assumption suppressed in stretch");
  const underOverload = heuristics.detect({ text: "Write a function", state: "overload", revisionDepth: 0 });
  c.ok(underOverload.signals.some((s) => s.gapType === "assumption"), "assumption emitted in overload");

  // 4. Below minimum length → no text analysis.
  const tiny = heuristics.detect({ text: "hi", state: "overload", revisionDepth: 9 });
  c.eq(tiny.signals.length, 0, "sub-min-length prompt emits no signals");

  // 4b. maxSignals caps output to the strongest N signals.
  const capped = new GapHeuristics({
    ...FIXTURE_CONFIG,
    settings: { ...FIXTURE_CONFIG.settings, maxSignals: 2 },
  });
  const cappedResult = capped.detect({ text: "Write a function", state: "overload", revisionDepth: 0 });
  c.eq(cappedResult.signals.length, 2, "maxSignals caps the number of emitted signals");
  c.eq(cappedResult.signals[0]?.gapType, "intentionality", "cap keeps the strongest signal first");

  // 5. Engine wiring: events set context, analyze() publishes gap.detected.
  const bus = new EventBus(silentReporter);
  const captured: DomainEvent<{ gapType: string; confidence: number }>[] = [];
  bus.subscribe("gap.detected", (e) => captured.push(e));

  const session: SessionId = toSessionId("sess-selftest");
  const engine = new GapDetectionEngine(bus, {
    heuristics,
    idFactory: deterministicIds(),
    clock: () => toTimestamp(123),
  });
  engine.start();

  bus.publish("state.changed", {
    id: toEventId("ctx-state"),
    type: "state.changed",
    timestamp: toTimestamp(1),
    sessionId: session,
    source: "test",
    payload: { previousState: "stretch", currentState: "overload", confidence: 0.9 },
  });
  bus.publish("prompt.typed", {
    id: toEventId("ctx-typed"),
    type: "prompt.typed",
    timestamp: toTimestamp(2),
    sessionId: session,
    source: "test",
    payload: { textLength: 16, wordCount: 3, currentTextHash: "abc", revisionDepth: 0 },
  });

  engine.analyze("Write a function");
  c.eq(captured.length, 4, "engine publishes one event per signal (intent+audience+constraint+assumption in overload)");
  c.eq(captured[0]?.type, "gap.detected", "published event type is gap.detected");
  c.eq(captured[0]?.sessionId as unknown as string, "sess-selftest", "event carries the tracked session id");
  c.eq(captured[0]?.source, "gap-detection-engine", "event source is the engine name");
  c.eq(captured[0]?.timestamp as unknown as number, 123, "event uses the injected clock");

  // 6. No session context yet → analyze() is a safe no-op.
  const freshBus = new EventBus(silentReporter);
  let freshCount = 0;
  freshBus.subscribe("gap.detected", () => (freshCount += 1));
  const freshEngine = new GapDetectionEngine(freshBus, { heuristics });
  freshEngine.start();
  freshEngine.analyze("Write a function");
  c.eq(freshCount, 0, "analyze() is a no-op before any session id is known");

  engine.dispose();
  return { passed: c.passed, failed: c.failed, failures: c.failures };
}

// Auto-run when executed directly (compiled to CommonJS for the throwaway run).
declare const require: undefined | { main?: unknown };
declare const module: unknown;
if (typeof require !== "undefined" && (require as { main?: unknown }).main === module) {
  const report = runGapSelfTest();
  // eslint-disable-next-line no-console
  console.log(`[gap self-test] passed=${report.passed} failed=${report.failed}`);
  if (report.failed > 0) {
    // eslint-disable-next-line no-console
    console.error("Failures:\n - " + report.failures.join("\n - "));
    (globalThis as { process?: { exit(code: number): void } }).process?.exit(1);
  }
}
