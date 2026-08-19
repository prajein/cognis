/**
 * GapHeuristics — self-test
 *
 * What & why: verifies the v0.2 weighted-evidence matcher — exact matches,
 * stem/fuzzy discounted matches, weighted markers, the partial-evidence
 * confidence penalty, and backward compatibility with plain-string marker
 * configs (predating `addressedThreshold`/weighted markers). Also asserts
 * the matcher stays comfortably inside the Ghost Text (<200ms) / enrichment
 * (<100ms) latency budgets on a long prompt, since v0.2 adds real work
 * (stemming, bounded fuzzy matching) beyond v0.1's plain substring scan.
 *
 * Run (after a throwaway compile, since the repo has no bundler yet):
 *   tsc --module commonjs --moduleResolution node --outDir .selftest --noEmit false
 *   node .selftest/engines/gap/GapHeuristics.selftest.js
 *
 * Exports `runGapHeuristicsSelfTest()` returning a pass/fail report for any harness.
 */

import { GapRulesConfig } from "../../core/config/gap-rules-loader";
import { GapHeuristics } from "./GapHeuristics";

// ---------------------------------------------------------------------------
// Tiny test harness (mirrors GapDetectionEngine.selftest.ts)
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

/** Plain-string markers only — the v0.1 shape, still legal under v0.2 types. */
const LEGACY_STRING_CONFIG: GapRulesConfig = {
  version: "0.0.0",
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

/** Weighted-marker config, single-word markers so stem/fuzzy can engage. */
const WEIGHTED_CONFIG: GapRulesConfig = {
  version: "0.2.0",
  settings: { minTextLength: 12, emitThreshold: 0.3, maxSignals: 8, cognitivePauseMs: 1200, addressedThreshold: 0.5 },
  stateModifiers: { stretch: 0, coasting: 0, overload: 0, unknown: 0 },
  revisionModifier: { perRevision: 0, max: 0 },
  rules: [
    {
      gapType: "assumption",
      baseConfidence: 0.6,
      satisfiedWhenAnyPresent: [{ marker: "assume", weight: 1 }],
    },
    {
      gapType: "mechanism",
      baseConfidence: 0.6,
      satisfiedWhenAnyPresent: [{ marker: "algorithm", weight: 1 }],
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export function runGapHeuristicsSelfTest(): SelfTestReport {
  const c = new Checker();

  // 1. Backward compatibility: legacy plain-string config behaves exactly as
  //    the v0.1 binary matcher did (this mirrors GapDetectionEngine.selftest.ts's
  //    fixtures so a regression here would also break that test).
  const legacy = new GapHeuristics(LEGACY_STRING_CONFIG);
  const bare = legacy.detect({ text: "Write a function", state: "stretch", revisionDepth: 0 });
  c.eq(bare.signals.length, 3, "legacy config: bare prompt emits 3 gap signals");
  c.eq(bare.signals[0]?.gapType, "intentionality", "legacy config: strongest signal is intentionality");
  c.eq(bare.signals[0]?.confidence, 0.6, "legacy config: intentionality confidence is unchanged base 0.6");

  const full = legacy.detect({
    text: "Write a function so that it sorts, for a beginner audience, and it must stay under a limit",
    state: "stretch",
    revisionDepth: 0,
  });
  c.eq(full.signals.length, 0, "legacy config: well-specified prompt emits no signals");

  // 2. Exact match still fully addresses a gap under the weighted matcher.
  const weighted = new GapHeuristics(WEIGHTED_CONFIG);
  const exact = weighted.detect({ text: "I will assume the API is stable", state: "stretch", revisionDepth: 0 });
  c.ok(!exact.signals.some((s) => s.gapType === "assumption"), "exact marker match fully addresses the gap");

  // 3. Stem match (marker "assume" vs prompt word "assuming") partially
  //    addresses the gap and is graded, not binary: it should still emit a
  //    signal (stem discount 0.75 < 0.5? no — 0.75 clears threshold, so it's
  //    treated as addressed). Use a case below the addressed threshold instead.
  const stemAddressed = weighted.detect({ text: "Assuming the API is stable", state: "stretch", revisionDepth: 0 });
  c.ok(
    !stemAddressed.signals.some((s) => s.gapType === "assumption"),
    "stem match (0.75 evidence) clears the 0.5 addressed threshold",
  );

  // 4. Fuzzy match (single edit: "algoritm" vs marker "algorithm") only earns
  //    the 0.5 discount, which sits right at the addressed threshold — still
  //    addressed — so assert against a case with NO match at all instead, to
  //    confirm the partial-evidence penalty applies when genuinely below
  //    threshold.
  const noEvidence = weighted.detect({ text: "Please write some code for me", state: "stretch", revisionDepth: 0 });
  const mechanismSignal = noEvidence.signals.find((s) => s.gapType === "mechanism");
  c.ok(mechanismSignal !== undefined, "zero evidence still emits the mechanism gap");
  c.eq(mechanismSignal?.confidence, 0.6, "zero evidence: confidence is unpenalized base 0.6");

  // 5. Fuzzy match on a near-miss word ("algoritm", one edit from "algorithm")
  //    earns partial evidence (0.5) below the 0.5 threshold... exactly at the
  //    boundary counts as addressed (>=), so use a weight < 1 marker to land
  //    strictly below threshold and prove the confidence penalty engages.
  const nearMissConfig: GapRulesConfig = {
    ...WEIGHTED_CONFIG,
    rules: [
      {
        gapType: "mechanism",
        baseConfidence: 0.6,
        satisfiedWhenAnyPresent: [{ marker: "algorithm", weight: 0.6 }],
      },
    ],
  };
  const nearMiss = new GapHeuristics(nearMissConfig).detect({
    text: "Please write some code using an algoritm for me",
    state: "stretch",
    revisionDepth: 0,
  });
  const nearMissSignal = nearMiss.signals.find((s) => s.gapType === "mechanism");
  c.ok(nearMissSignal !== undefined, "near-miss fuzzy evidence still emits a signal");
  c.ok(
    (nearMissSignal?.confidence ?? 0) < 0.6 && (nearMissSignal?.confidence ?? 0) > 0.5,
    `near-miss evidence lowers confidence below base but above a total miss (got ${nearMissSignal?.confidence})`,
  );

  // 6. Multi-word markers never fuzzy/stem match — only exact substring.
  const multiWordConfig: GapRulesConfig = {
    ...WEIGHTED_CONFIG,
    rules: [
      { gapType: "intentionality", baseConfidence: 0.6, satisfiedWhenAnyPresent: ["so that"] },
    ],
  };
  const multiWordNearMiss = new GapHeuristics(multiWordConfig).detect({
    text: "I did this so at it works", // close to "so that" but not a substring
    state: "stretch",
    revisionDepth: 0,
  });
  c.ok(
    multiWordNearMiss.signals.some((s) => s.gapType === "intentionality"),
    "multi-word marker near-miss is not fuzzy-matched (still emits, unpenalized)",
  );
  c.eq(
    multiWordNearMiss.signals[0]?.confidence,
    0.6,
    "multi-word marker: no fuzzy discount applied, confidence is full base",
  );

  // 7. Latency budget: matcher stays fast on a long prompt against the real
  //    default rule set (imported via getGapRulesConfig() default in the ctor
  //    would hit the runtime bundler path, so instead build a representative
  //    worst case directly from the weighted+legacy rule shapes combined).
  const longText = "I need help with a complex system design problem. ".repeat(60); // ~2900 chars
  const start = Date.now();
  for (let i = 0; i < 20; i++) {
    legacy.detect({ text: longText, state: "stretch", revisionDepth: 0 });
    weighted.detect({ text: longText, state: "stretch", revisionDepth: 0 });
  }
  const elapsedMs = Date.now() - start;
  c.ok(
    elapsedMs < 200,
    `40 detect() passes over a ~2900-char prompt complete well under budget (got ${elapsedMs}ms for 40 passes)`,
  );

  return { passed: c.passed, failed: c.failed, failures: c.failures };
}

// Auto-run when executed directly (compiled to CommonJS for the throwaway run).
declare const require: undefined | { main?: unknown };
declare const module: unknown;
if (typeof require !== "undefined" && (require as { main?: unknown }).main === module) {
  const report = runGapHeuristicsSelfTest();
  // eslint-disable-next-line no-console
  console.log(`[gap-heuristics self-test] passed=${report.passed} failed=${report.failed}`);
  if (report.failed > 0) {
    // eslint-disable-next-line no-console
    console.error("Failures:\n - " + report.failures.join("\n - "));
    (globalThis as { process?: { exit(code: number): void } }).process?.exit(1);
  }
}
