/**
 * Gap Pipeline — self-test / regression runner
 *
 * What & why: runs the whole scenario corpus through `GapPipeline` against the
 * REAL `gap_rules.json` and asserts each prompt produces exactly the expected
 * set of gaps. This is the regression net for the rules — change a marker or a
 * threshold and this immediately tells you which prompts moved.
 *
 * Run (after a throwaway compile, since the repo has no bundler yet):
 *   tsc --module commonjs --moduleResolution node10 --ignoreDeprecations 6.0 \
 *       --rootDir src --outDir .selftest --noEmit false --resolveJsonModule
 *   node .selftest/engines/gap/pipeline/GapPipeline.selftest.js
 *
 * Exports `runGapPipelineSelfTest()` returning a pass/fail report, and a
 * `describeCorpus()` helper that prints what each scenario currently produces
 * (handy when tuning the rules).
 */

import { GapPipeline } from "./GapPipeline";
import { GAP_SCENARIOS } from "./scenarios";
import { GapType } from "../../../core/types/gap.types";
import { StateLabel } from "../../../core/types/state.types";
import { GapDetectedPayload } from "../../../core/event-bus/contracts";

interface SelfTestReport {
  readonly passed: number;
  readonly failed: number;
  readonly failures: readonly string[];
}

function sortedTypes(types: readonly GapType[]): string {
  return [...types].sort().join(",");
}

/** Runs a single prompt through a fresh pipeline and returns the detected gaps. */
function detect(
  text: string,
  state: StateLabel,
  revisionDepth: number,
): readonly GapDetectedPayload[] {
  const pipeline = new GapPipeline();
  try {
    return pipeline.feed({ text, state, revisionDepth });
  } finally {
    pipeline.dispose();
  }
}

export function runGapPipelineSelfTest(): SelfTestReport {
  const failures: string[] = [];
  let passed = 0;

  for (const scenario of GAP_SCENARIOS) {
    const detected = detect(
      scenario.text,
      scenario.state ?? "stretch",
      scenario.revisionDepth ?? 0,
    );
    const actual = sortedTypes(detected.map((p) => p.gapType));
    const expected = sortedTypes(scenario.expect);
    if (actual === expected) {
      passed++;
    } else {
      failures.push(`${scenario.name}: expected [${expected}] got [${actual}]`);
    }
  }

  // Confidence sanity: every emitted confidence is a valid estimate in [0,1].
  const probe = new GapPipeline();
  try {
    const probed = probe.feed({ text: "Write a function", state: "overload" });
    const allValid = probed.every((p) => p.confidence >= 0 && p.confidence <= 1);
    if (allValid) passed++;
    else failures.push("confidence range: some confidence outside [0,1]");
  } finally {
    probe.dispose();
  }

  return { passed, failed: failures.length, failures };
}

/** Prints the current detected gaps for every scenario (rule-tuning aid). */
export function describeCorpus(): void {
  for (const scenario of GAP_SCENARIOS) {
    const detected = detect(
      scenario.text,
      scenario.state ?? "stretch",
      scenario.revisionDepth ?? 0,
    );
    // eslint-disable-next-line no-console
    console.log(
      `${scenario.name.padEnd(42)} -> [${detected.map((p) => `${p.gapType}:${p.confidence.toFixed(2)}`).join(", ")}]`,
    );
  }
}

// Auto-run when executed directly (compiled to CommonJS for the throwaway run).
declare const require: undefined | { main?: unknown };
declare const module: unknown;
if (typeof require !== "undefined" && (require as { main?: unknown }).main === module) {
  const argv = (globalThis as { process?: { argv?: string[] } }).process?.argv ?? [];
  if (argv.includes("--describe")) {
    describeCorpus();
  }
  const report = runGapPipelineSelfTest();
  // eslint-disable-next-line no-console
  console.log(`[gap-pipeline self-test] passed=${report.passed} failed=${report.failed}`);
  if (report.failed > 0) {
    // eslint-disable-next-line no-console
    console.error("Failures:\n - " + report.failures.join("\n - "));
    (globalThis as { process?: { exit(code: number): void } }).process?.exit(1);
  }
}
