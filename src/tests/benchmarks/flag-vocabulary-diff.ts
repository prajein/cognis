/**
 * flag-vocabulary-diff.ts — DIAGNOSTIC ONLY, not a deliverable.
 *
 * Runs each real analyzer against every dataset entry and prints:
 *   1. Every UNIQUE flag string each analyzer actually emitted
 *   2. Every UNIQUE observedIssues tag (per domain) you've typed in the dataset
 * so you can see the exact vocabulary mismatch side by side, instead of guessing.
 *
 * Usage: node dist-benchmark/src/tests/benchmarks/flag-vocabulary-diff.js
 * (compile the same way you compiled intelligence-benchmark.ts)
 */

import * as fs from "fs";
import * as path from "path";
import { StructureAnalyzer } from "../../engines/response/analyzers/StructureAnalyzer";
import { ReasoningAnalyzer } from "../../engines/response/analyzers/ReasoningAnalyzer";
import { CompletenessAnalyzer } from "../../engines/response/analyzers/CompletenessAnalyzer";
import { QualityAnalyzer } from "../../engines/response/analyzers/QualityAnalyzer";

// Anchored to project root, not __dirname -- see intelligence-benchmark.ts for why.
// Run this script from the repo root.
const datasetPath = path.join(
  process.cwd(),
  "src/tests/evaluation/datasets/response-analyzer-dataset.json"
);
const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));

const structure = new StructureAnalyzer();
const reasoning = new ReasoningAnalyzer();
const completeness = new CompletenessAnalyzer();
const quality = new QualityAnalyzer(structure, reasoning, completeness);

const predictedFlagsSeen: Record<string, Set<string>> = {
  StructureAnalyzer: new Set(),
  ReasoningAnalyzer: new Set(),
  CompletenessAnalyzer: new Set(),
  QualityAnalyzer: new Set(),
};

const expectedIssuesSeen: Record<string, Set<string>> = {
  "structure:": new Set(),
  "reasoning:": new Set(),
  "completeness:": new Set(),
  unprefixed: new Set(),
};

for (const entry of dataset.entries) {
  for (const f of structure.analyze(entry.responseText, entry.promptHash).flags) {
    predictedFlagsSeen.StructureAnalyzer.add(f);
  }
  for (const f of reasoning.analyze(entry.responseText, entry.promptHash).flags) {
    predictedFlagsSeen.ReasoningAnalyzer.add(f);
  }
  for (const f of completeness.analyze(entry.responseText, entry.promptHash).flags) {
    predictedFlagsSeen.CompletenessAnalyzer.add(f);
  }
  for (const f of quality.analyze(entry.responseText, entry.promptHash).flags) {
    predictedFlagsSeen.QualityAnalyzer.add(f);
  }

  for (const issue of entry.observedIssues as string[]) {
    const prefix = ["structure:", "reasoning:", "completeness:"].find((p) => issue.startsWith(p));
    if (prefix) expectedIssuesSeen[prefix].add(issue.slice(prefix.length));
    else expectedIssuesSeen.unprefixed.add(issue);
  }
}

console.log("\n=== FLAGS ACTUALLY EMITTED BY REAL ANALYZERS ===");
for (const [name, set] of Object.entries(predictedFlagsSeen)) {
  console.log(`\n${name}:`);
  if (set.size === 0) console.log("  (none raised across whole dataset -- worth investigating separately)");
  for (const flag of set) console.log(`  - "${flag}"`);
}

console.log("\n=== TAGS YOU TYPED INTO observedIssues (by domain) ===");
for (const [domain, set] of Object.entries(expectedIssuesSeen)) {
  console.log(`\n${domain}`);
  for (const tag of set) console.log(`  - "${tag}"`);
}

console.log("\n=== DIRECT OVERLAP CHECK ===");
const domainMap: Record<string, string> = {
  StructureAnalyzer: "structure:",
  ReasoningAnalyzer: "reasoning:",
  CompletenessAnalyzer: "completeness:",
};
for (const [analyzerName, domainPrefix] of Object.entries(domainMap)) {
  const predicted = predictedFlagsSeen[analyzerName];
  const expected = expectedIssuesSeen[domainPrefix];
  const overlap = [...predicted].filter((f) => expected.has(f));
  console.log(
    `${analyzerName}: ${overlap.length} exact string matches out of ${predicted.size} distinct predicted flags`
  );
  if (overlap.length === 0 && predicted.size > 0 && expected.size > 0) {
    console.log(`  -> ZERO overlap despite both sides being non-empty. Vocabulary mismatch confirmed.`);
    console.log(`  -> Predicted (real code): ${[...predicted].join(", ")}`);
    console.log(`  -> Expected (your labels): ${[...expected].join(", ")}`);
  }
}