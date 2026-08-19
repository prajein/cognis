/**
 * ConfidenceCalculator — self-test
 *
 * What & why: verifies the v0.2 continuous half-life decay calibration —
 * that it reproduces the old step function's two reference points (30d/90d),
 * removes the old cliff discontinuities, and preserves the "evidence never
 * fully expires" floor — plus the pre-existing volume/contradiction logic,
 * unchanged by this calibration pass. Framework-free, matching the repo's
 * other `*.selftest.ts` files.
 *
 * Run (after a throwaway compile, since the repo has no bundler yet):
 *   tsc --module commonjs --moduleResolution node --outDir .selftest --noEmit false
 *   node .selftest/engines/insights/ConfidenceCalculator.selftest.js
 *
 * Exports `runConfidenceCalculatorSelfTest()` returning a pass/fail report for any harness.
 */

import { ConfidenceCalculator } from "./ConfidenceCalculator";

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

  close(actual: number, expected: number, tolerance: number, label: string): void {
    this.ok(
      Math.abs(actual - expected) <= tolerance,
      `${label} (expected ~${expected} +/-${tolerance}, got ${actual})`,
    );
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function runConfidenceCalculatorSelfTest(): SelfTestReport {
  const c = new Checker();
  const calc = new ConfidenceCalculator();
  const now = 1_000_000_000_000;

  // 1. No evidence -> zero confidence, regardless of baseline.
  c.ok(calc.calculate([], 5, 1.0, false, 0, now) === 0, "no evidence: confidence is 0");

  // 2. Fresh evidence (age 0) at exactly the required count -> full baseline.
  const fresh5 = [now, now, now, now, now];
  c.close(calc.calculate(fresh5, 5, 0.8, false, 0, now), 0.8, 0.001, "fresh evidence at required count: full baseline score");

  // 3. Single 30-day-old evidence reproduces the old step function's midpoint
  //    (0.5 weight) within a small tolerance.
  const thirtyDayOld = [now - 30 * DAY_MS];
  const w30 = calc.calculate(thirtyDayOld, 1, 1.0, false, 0, now);
  c.close(w30, 0.5, 0.01, "30-day-old evidence: ~50% weight (matches old step midpoint)");

  // 4. Single 90-day-old evidence lands near the old step function's 10%
  //    tier, without an exact cliff (continuous decay puts it at ~12.5%).
  const ninetyDayOld = [now - 90 * DAY_MS];
  const w90 = calc.calculate(ninetyDayOld, 1, 1.0, false, 0, now);
  c.close(w90, 0.125, 0.01, "90-day-old evidence: ~12.5% weight (close to old 10% reference)");

  // 5. No cliff: evidence just before/after the old 30-day boundary differs
  //    only slightly, not by 2x as the old step function would.
  const justUnder30 = calc.calculate([now - 29 * DAY_MS], 1, 1.0, false, 0, now);
  const justOver30 = calc.calculate([now - 31 * DAY_MS], 1, 1.0, false, 0, now);
  c.ok(
    Math.abs(justUnder30 - justOver30) < 0.05,
    `no 30-day cliff: day-29 and day-31 weights are close (got ${justUnder30} vs ${justOver30})`,
  );

  // 6. Evidence floor: very old evidence (e.g. 2 years) never decays below
  //    the permanent 10% floor, preserving the v0.1 "never fully expires"
  //    property that pure exponential decay would otherwise lose.
  const veryOld = [now - 2 * 365 * DAY_MS];
  const wVeryOld = calc.calculate(veryOld, 1, 1.0, false, 0, now);
  c.close(wVeryOld, 0.1, 0.001, "2-year-old evidence: floors at the permanent 10% weight");

  // 7. Volume multiplier still caps at 1.0 when weighted evidence exceeds
  //    the required count (pre-existing behavior, unaffected by calibration).
  const tenFresh = new Array(10).fill(now);
  c.close(calc.calculate(tenFresh, 5, 0.9, false, 0, now), 0.9, 0.001, "excess evidence: volume multiplier caps at 1.0");

  // 8. Contradiction penalty still applies when new evidence doesn't clear
  //    2x the existing evidence (pre-existing behavior, unaffected).
  const contradicting = calc.calculate(fresh5, 5, 1.0, true, 10, now); // 5 < 10*2
  c.close(contradicting, 0.6, 0.001, "contradiction penalty: slashed by 40% when evidence doesn't clear 2x");

  const contradictingCleared = calc.calculate(new Array(25).fill(now), 5, 1.0, true, 10, now); // 25 >= 10*2
  c.close(contradictingCleared, 1.0, 0.001, "contradiction penalty: not applied once new evidence clears 2x old");

  return { passed: c.passed, failed: c.failed, failures: c.failures };
}

// Auto-run when executed directly (compiled to CommonJS for the throwaway run).
declare const require: undefined | { main?: unknown };
declare const module: unknown;
if (typeof require !== "undefined" && (require as { main?: unknown }).main === module) {
  const report = runConfidenceCalculatorSelfTest();
  // eslint-disable-next-line no-console
  console.log(`[confidence-calculator self-test] passed=${report.passed} failed=${report.failed}`);
  if (report.failed > 0) {
    // eslint-disable-next-line no-console
    console.error("Failures:\n - " + report.failures.join("\n - "));
    (globalThis as { process?: { exit(code: number): void } }).process?.exit(1);
  }
}
