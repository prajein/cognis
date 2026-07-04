/**
 * Surface A co-pilot flow — end-to-end self-test + demo
 *
 * Proves the whole Surface A moment works with the REAL engines and REAL config:
 * type a prompt -> gaps detected -> pause -> a ghost-text stem is offered.
 *
 * Run:
 *   tsc --module commonjs --moduleResolution node10 --ignoreDeprecations 6.0 \
 *       --rootDir src --outDir .selftest --noEmit false --resolveJsonModule
 *   node .selftest/engines/ghosttext/pipeline/SurfaceAPipeline.selftest.js         # assertions
 *   node .selftest/engines/ghosttext/pipeline/SurfaceAPipeline.selftest.js --demo  # readable trace
 */

import { SurfaceAPipeline } from "./SurfaceAPipeline";
import { StateLabel } from "../../../core/types/state.types";

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
}

function runOnce(prompt: string, state: StateLabel = "stretch") {
  const sa = new SurfaceAPipeline();
  try {
    return sa.run(prompt, { state, pauseMs: 1500 });
  } finally {
    sa.dispose();
  }
}

const DEMO_PROMPTS: ReadonlyArray<{ prompt: string; state?: StateLabel }> = [
  { prompt: "write a function" },
  { prompt: "help me draft an email to my manager about the deadline slipping" },
  { prompt: "My goal is to write a sorting function for a beginner audience; it must run fast, using merge sort, and this matters because it is graded." },
];

export function describeDemo(): void {
  // eslint-disable-next-line no-console
  console.log("=== Cognis Surface A — co-pilot dry run ===\n");
  for (const { prompt, state } of DEMO_PROMPTS) {
    const run = runOnce(prompt, state ?? "stretch");
    const gaps = run.gaps.map((g) => `${g.gapType}:${g.confidence.toFixed(2)}`).join(", ") || "(none)";
    // eslint-disable-next-line no-console
    console.log(`You type:   "${run.prompt}"`);
    // eslint-disable-next-line no-console
    console.log(`Gaps found: ${gaps}`);
    if (run.stems.length > 0) {
      for (const s of run.stems) {
        // eslint-disable-next-line no-console
        console.log(`You pause…  ghost text: "${s.stem}"   (addresses: ${s.gapType})`);
      }
    } else {
      // eslint-disable-next-line no-console
      console.log("You pause…  (no ghost text — prompt is well specified)");
    }
    // eslint-disable-next-line no-console
    console.log("");
  }
}

export function runSurfaceASelfTest(): SelfTestReport {
  const c = new Checker();

  // 1. A vague prompt yields gaps AND a ghost-text stem on pause.
  const vague = runOnce("write a function");
  c.ok(vague.gaps.length > 0, "vague prompt produces gaps");
  c.ok(vague.stems.length === 1, "a pause after a vague prompt offers exactly one stem");
  c.ok(
    vague.stems[0] !== undefined && vague.stems[0].stem.length > 0,
    "the offered stem is non-empty text",
  );
  c.ok(
    vague.stems[0] !== undefined &&
      vague.gaps[0] !== undefined &&
      vague.stems[0].gapType === vague.gaps[0].gapType,
    "the stem addresses the strongest detected gap (gaps are emitted strongest-first)",
  );

  // 2. A well-specified prompt yields no gaps and no ghost text.
  const clear = runOnce(
    "My goal is to write a sorting function for a beginner audience; it must run fast, using merge sort, and this matters because it is graded.",
  );
  c.ok(clear.gaps.length === 0, "well-specified prompt produces no gaps");
  c.ok(clear.stems.length === 0, "no pause suggestion when there is nothing to add");

  // 3. No stem without a preceding gap: a pause on an empty session is silent.
  const sa = new SurfaceAPipeline();
  try {
    sa.start();
    const stems = sa.pause(1500);
    c.ok(stems.length === 0, "a pause with no detected gap offers nothing");
  } finally {
    sa.dispose();
  }

  // 4. A too-short pause offers nothing even when a gap exists.
  const sa2 = new SurfaceAPipeline();
  try {
    sa2.start();
    sa2.type("write a function");
    const stems = sa2.pause(300);
    c.ok(stems.length === 0, "a sub-threshold pause offers no stem");
  } finally {
    sa2.dispose();
  }

  return { passed: c.passed, failed: c.failed, failures: c.failures };
}

// Auto-run when executed directly.
declare const require: undefined | { main?: unknown };
declare const module: unknown;
if (typeof require !== "undefined" && (require as { main?: unknown }).main === module) {
  const argv = (globalThis as { process?: { argv?: string[] } }).process?.argv ?? [];
  if (argv.includes("--demo")) {
    describeDemo();
  }
  const report = runSurfaceASelfTest();
  // eslint-disable-next-line no-console
  console.log(`[surface-a self-test] passed=${report.passed} failed=${report.failed}`);
  if (report.failed > 0) {
    // eslint-disable-next-line no-console
    console.error("Failures:\n - " + report.failures.join("\n - "));
    (globalThis as { process?: { exit(code: number): void } }).process?.exit(1);
  }
}
