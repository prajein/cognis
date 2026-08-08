/**
 * Intelligence Benchmark Harness — Workstream 1 (v2, matches schema v2.0.0)
 *
 * Loads the labeled response-analyzer dataset, runs the real (frozen, read-only)
 * analyzers against it, and computes MAE + observedIssues-detection precision/
 * recall/F1 per analyzer. Also breaks results down by promptCategory, platform,
 * and containsCode -- this is what actually surfaces systematic bias for the
 * baseline report, not just a single overall MAE number.
 *
 * IMPORTANT: this file only READS the analyzers. It never modifies them.
 */

import { StructureAnalyzer } from "../../engines/response/analyzers/StructureAnalyzer";
import { ReasoningAnalyzer } from "../../engines/response/analyzers/ReasoningAnalyzer";
import { CompletenessAnalyzer } from "../../engines/response/analyzers/CompletenessAnalyzer";
import { QualityAnalyzer } from "../../engines/response/analyzers/QualityAnalyzer";

import * as fs from "fs";
import * as path from "path";

// ---- Types matching dataset schema v2.0.0 ----

type Platform = "chatgpt" | "claude" | "gemini";
type PromptCategory =
  | "factual"
  | "reasoning"
  | "coding"
  | "long_form"
  | "ambiguous"
  | "adversarial_verbose"
  | "other";
type Verdict = "excellent" | "good" | "average" | "poor" | "failing";
type Split = "evaluation" | "holdout";

interface ResponseMetadata {
  wordCount: number;
  containsCode: boolean;
  containsMarkdown: boolean;
  language: string;
}

interface Labels {
  structure: number;
  reasoning: number;
  completeness: number;
  quality: number;
}

interface DatasetEntry {
  id: string;
  platform: Platform;
  promptCategory: PromptCategory;
  promptHash: string;
  responseText: string;
  responseMetadata: ResponseMetadata;
  labels: Labels;
  observedIssues: string[];
  overallVerdict: Verdict;
  split: Split;
  labeledBy: string;
  labelNotes?: string;
}

interface DatasetFile {
  _schemaVersion: string;
  entries: DatasetEntry[];
}

interface AnalysisResultShape {
  score: number; // 0.0 to 1.0
  flags: ReadonlyArray<string>;
  metadata: Record<string, number | string>;
}

interface AnalyzerUnderTest {
  name: string;
  analyze: (responseText: string, promptHash: string) => AnalysisResultShape;
  labelKey: keyof Labels;
}

function computeMAE(predicted: number[], expected: number[]): number {
  if (predicted.length !== expected.length || predicted.length === 0) {
    throw new Error("computeMAE: predicted/expected length mismatch or empty");
  }
  const totalError = predicted.reduce((sum, p, i) => sum + Math.abs(p - expected[i]), 0);
  return totalError / predicted.length;
}

interface FlagMetrics {
  precision: number;
  recall: number;
  f1: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

function computeFlagMetrics(
  predictedFlagSets: string[][],
  expectedIssueSets: string[][]
): FlagMetrics {
  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (let i = 0; i < predictedFlagSets.length; i++) {
    const predicted = new Set(predictedFlagSets[i]);
    const expected = new Set(expectedIssueSets[i]);

    for (const flag of predicted) {
      if (expected.has(flag)) tp++;
      else fp++;
    }
    for (const issue of expected) {
      if (!predicted.has(issue)) fn++;
    }
  }

  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return { precision, recall, f1, truePositives: tp, falsePositives: fp, falseNegatives: fn };
}

interface DataQualityWarning {
  id: string;
  reason: string;
}

const VERDICT_EXPECTED_RANGE: Record<Verdict, [number, number]> = {
  excellent: [0.9, 1.0],
  good: [0.7, 0.9],
  average: [0.5, 0.7],
  poor: [0.3, 0.5],
  failing: [0.0, 0.3],
};

function checkDataQuality(entries: DatasetEntry[]): DataQualityWarning[] {
  const warnings: DataQualityWarning[] = [];

  for (const entry of entries) {
    const [low, high] = VERDICT_EXPECTED_RANGE[entry.overallVerdict];
    if (entry.labels.quality < low - 0.05 || entry.labels.quality > high + 0.05) {
      warnings.push({
        id: entry.id,
        reason: `overallVerdict="${entry.overallVerdict}" but labels.quality=${entry.labels.quality} falls outside expected [${low}, ${high}]`,
      });
    }
  }

  return warnings;
}

// ---- Harness core ----

function loadDataset(datasetPath: string): DatasetFile {
  const raw = fs.readFileSync(datasetPath, "utf-8");
  const parsed = JSON.parse(raw) as DatasetFile;
  if (!parsed.entries || parsed.entries.length === 0) {
    throw new Error(`Dataset at ${datasetPath} has no entries`);
  }
  return parsed;
}

interface AnalyzerBenchmarkResult {
  analyzerName: string;
  breakdown: string; // e.g. "overall", "platform=chatgpt", "promptCategory=coding", "containsCode=true"
  sampleCount: number;
  mae: number;
  flagMetrics: FlagMetrics;
}

function runAnalyzerAgainstEntries(
  analyzer: AnalyzerUnderTest,
  entries: DatasetEntry[],
  breakdownLabel: string
): AnalyzerBenchmarkResult {
  const predictedScores: number[] = [];
  const expectedScores: number[] = [];
  const predictedFlagSets: string[][] = [];
  const expectedIssueSets: string[][] = [];

  for (const entry of entries) {
    const result = analyzer.analyze(entry.responseText, entry.promptHash);
    predictedScores.push(result.score);
    expectedScores.push(entry.labels[analyzer.labelKey]);
    predictedFlagSets.push([...result.flags]); // copy out of readonly array
    expectedIssueSets.push(entry.observedIssues);
  }

  return {
    analyzerName: analyzer.name,
    breakdown: breakdownLabel,
    sampleCount: entries.length,
    mae: computeMAE(predictedScores, expectedScores),
    flagMetrics: computeFlagMetrics(predictedFlagSets, expectedIssueSets),
  };
}

// Generic grouping helper -- reused for every stratification below
function groupBy<T, K extends string>(items: T[], keyFn: (item: T) => K): Record<K, T[]> {
  const groups = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

function benchmarkWithStratification(
  analyzer: AnalyzerUnderTest,
  allEntries: DatasetEntry[],
  split: Split
): AnalyzerBenchmarkResult[] {
  const splitEntries = allEntries.filter((e) => e.split === split);
  const results: AnalyzerBenchmarkResult[] = [];

  // Overall for this split
  results.push(runAnalyzerAgainstEntries(analyzer, splitEntries, `${split}:overall`));

  // By platform
  const byPlatform = groupBy(splitEntries, (e) => e.platform);
  for (const [platform, group] of Object.entries(byPlatform)) {
    results.push(
      runAnalyzerAgainstEntries(analyzer, group as DatasetEntry[], `${split}:platform=${platform}`)
    );
  }

  // By promptCategory -- this is the key one for spotting systematic bias
  const byCategory = groupBy(splitEntries, (e) => e.promptCategory);
  for (const [category, group] of Object.entries(byCategory)) {
    results.push(
      runAnalyzerAgainstEntries(
        analyzer,
        group as DatasetEntry[],
        `${split}:promptCategory=${category}`
      )
    );
  }

  // By containsCode -- directly useful for CompletenessAnalyzer bias
  const byCode = groupBy(splitEntries, (e) => String(e.responseMetadata.containsCode) as "true" | "false");
  for (const [flag, group] of Object.entries(byCode)) {
    results.push(
      runAnalyzerAgainstEntries(analyzer, group as DatasetEntry[], `${split}:containsCode=${flag}`)
    );
  }

  // By word count bucket -- directly useful for StructureAnalyzer's prose_heavy threshold question
  const bucketOf = (wc: number) => (wc < 100 ? "short(<100)" : wc < 500 ? "medium(100-500)" : "long(500+)");
  const byLength = groupBy(splitEntries, (e) => bucketOf(e.responseMetadata.wordCount) as any);
  for (const [bucket, group] of Object.entries(byLength)) {
    results.push(
      runAnalyzerAgainstEntries(analyzer, group as DatasetEntry[], `${split}:wordCount=${bucket}`)
    );
  }

  return results;
}

function printSummaryTable(results: AnalyzerBenchmarkResult[]): void {
  console.log("\n=== Intelligence Benchmark Summary ===\n");
  console.log(
    "Analyzer".padEnd(20) +
      "Breakdown".padEnd(32) +
      "N".padEnd(6) +
      "MAE".padEnd(8) +
      "Prec".padEnd(8) +
      "Recall".padEnd(8) +
      "F1"
  );
  console.log("-".repeat(94));

  for (const r of results) {
    console.log(
      r.analyzerName.padEnd(20) +
        r.breakdown.padEnd(32) +
        String(r.sampleCount).padEnd(6) +
        r.mae.toFixed(3).padEnd(8) +
        r.flagMetrics.precision.toFixed(3).padEnd(8) +
        r.flagMetrics.recall.toFixed(3).padEnd(8) +
        r.flagMetrics.f1.toFixed(3)
    );
  }
  console.log("");
}

function printDataQualityWarnings(warnings: DataQualityWarning[]): void {
  if (warnings.length === 0) {
    console.log("Data quality check: no warnings.\n");
    return;
  }
  console.log(`\n=== Data Quality Warnings (${warnings.length}) ===`);
  for (const w of warnings) {
    console.log(`  [${w.id}] ${w.reason}`);
  }
  console.log("");
}

function main(): void {
  const datasetPath = path.join(
    __dirname,
    "../evaluation/datasets/response-analyzer-dataset.json"
  );

  const dataset = (() => {
    try {
      return loadDataset(datasetPath);
    } catch (err) {
      console.error("Failed to load dataset:", err);
      process.exit(1);
    }
  })();

  const warnings = checkDataQuality(dataset.entries);
  printDataQualityWarnings(warnings);

  const analyzers: AnalyzerUnderTest[] = [
    { name: "StructureAnalyzer", analyze: (t, h) => new StructureAnalyzer().analyze(t, h), labelKey: "structure" },
    { name: "ReasoningAnalyzer", analyze: (t, h) => new ReasoningAnalyzer().analyze(t, h), labelKey: "reasoning" },
    { name: "CompletenessAnalyzer", analyze: (t, h) => new CompletenessAnalyzer().analyze(t, h), labelKey: "completeness" },
    {
      name: "QualityAnalyzer",
      // QualityAnalyzer is a composite -- it needs the other three injected in.
      // CONFIRM the real parameter order in QualityAnalyzer.ts before trusting this line;
      // this assumes (structureAnalyzer, reasoningAnalyzer, completenessAnalyzer).
      analyze: (t, h) =>
        new QualityAnalyzer(
          new StructureAnalyzer(),
          new ReasoningAnalyzer(),
          new CompletenessAnalyzer()
        ).analyze(t, h),
      labelKey: "quality",
    },
  ];

  if (analyzers.length === 0) {
    console.error("No analyzers wired in yet -- uncomment and fix the imports/instantiations above.");
    process.exit(1);
  }

  const allResults: AnalyzerBenchmarkResult[] = [];

  try {
    for (const analyzer of analyzers) {
      allResults.push(...benchmarkWithStratification(analyzer, dataset.entries, "evaluation"));
      allResults.push(...benchmarkWithStratification(analyzer, dataset.entries, "holdout"));
    }
  } catch (err) {
    console.error("Analyzer threw during benchmark run:", err);
    process.exit(1);
  }

  printSummaryTable(allResults);

  const outputPath = path.join(__dirname, "../../../docs/benchmarks/latest-run.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`Full results written to ${outputPath}`);

  process.exit(0);
}

main();