import * as fs from 'fs';
import * as path from 'path';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const NOW = 1_700_000_000_000;

const datasetPath = path.join(__dirname, 'confidence-calibration-dataset.json');
const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

// --- Decay weight functions under test. Each takes age in DAYS, returns a weight in [0,1]. ---

function steppedDecay(ageDays: number): number {
  // Current production behavior, reproduced for direct comparison.
  if (ageDays > 90) return 0.1;
  if (ageDays > 30) return 0.5;
  return 1.0;
}

function exponentialDecay(halfLifeDays: number) {
  return (ageDays: number): number => Math.exp((-Math.LN2 * ageDays) / halfLifeDays);
}

function sigmoidDecay(midpointDays: number, steepness: number) {
  return (ageDays: number): number => 1 / (1 + Math.exp(steepness * (ageDays - midpointDays)));
}

// --- Generic confidence calculation, decay function pluggable, everything else matches the real calculator ---

function calculate(
  evidenceAgesDays: number[],
  requiredEvidenceCount: number,
  baselineStrategyScore: number,
  contradicts: boolean,
  existingEvidenceCount: number,
  decayFn: (ageDays: number) => number,
  contradictionPenaltyFn: (weightedCount: number, existingCount: number) => number,
): number {
  if (evidenceAgesDays.length === 0) return 0;
  const weightedEvidenceCount = evidenceAgesDays.reduce((sum, age) => sum + decayFn(age), 0);
  const volumeMultiplier = Math.min(weightedEvidenceCount / requiredEvidenceCount, 1.0);
  let confidence = volumeMultiplier * baselineStrategyScore;
  if (contradicts) {
    confidence *= contradictionPenaltyFn(weightedEvidenceCount, existingEvidenceCount);
  }
  return Math.max(0, Math.min(1, confidence));
}

// Current stepped contradiction penalty, reproduced for comparison
function steppedContradictionPenalty(weightedCount: number, existingCount: number): number {
  return weightedCount < existingCount * 2 ? 0.6 : 1.0;
}

// Proposed: evidence-ratio-based penalty, smooth instead of a hard 2x cliff
function ratioBasedContradictionPenalty(weightedCount: number, existingCount: number): number {
  if (existingCount === 0) return 1.0;
  const ratio = weightedCount / existingCount;
  // Smoothly scales from 0.6 (at ratio 0) to 1.0 (at ratio 2+), linear in between
  return Math.min(1.0, 0.6 + 0.2 * ratio);
}

// --- Candidate configurations ---

const candidates: Record<string, (ageDays: number) => number> = {
  'stepped (current)': steppedDecay,
  'exponential halfLife=30d': exponentialDecay(30),
  'exponential halfLife=45d': exponentialDecay(45),
  'exponential halfLife=60d': exponentialDecay(60),
  'sigmoid midpoint=60d steepness=0.05': sigmoidDecay(60, 0.05),
  'sigmoid midpoint=45d steepness=0.08': sigmoidDecay(45, 0.08),
};

// --- Part 1: run each candidate against the full dataset, report in-range rate ---

console.log('=== Part 1: in-range rate per candidate, against calibration dataset ===\n');
for (const [name, decayFn] of Object.entries(candidates)) {
  let inRange = 0;
  for (const entry of dataset.entries) {
    const ages: number[] = entry.evidenceOffsetsDays.map((d: number) => Math.abs(d));
    const confidence = calculate(
      ages,
      entry.requiredEvidenceCount,
      entry.baselineStrategyScore,
      entry.contradictsExistingIdentity,
      entry.existingEvidenceCount,
      decayFn,
      steppedContradictionPenalty,
    );
    const [lo, hi] = entry.expectedConfidenceRange;
    if (confidence >= lo && confidence <= hi) inRange++;
  }
  console.log(`${name.padEnd(38)} ${inRange}/${dataset.entries.length} in range`);
}

// --- Part 2: smoothness sweep -- max day-to-day confidence change across a 0-150 day range ---
// This is the direct, quantitative measure of "does this decay function have cliffs".

console.log('\n=== Part 2: smoothness sweep (max confidence change per 1-day age step, 0-150 days) ===\n');
for (const [name, decayFn] of Object.entries(candidates)) {
  let maxDelta = 0;
  let maxDeltaAt = 0;
  for (let day = 0; day < 150; day++) {
    const w1 = decayFn(day);
    const w2 = decayFn(day + 1);
    const delta = Math.abs(w1 - w2);
    if (delta > maxDelta) {
      maxDelta = delta;
      maxDeltaAt = day;
    }
  }
  console.log(`${name.padEnd(38)} max single-day weight change = ${maxDelta.toFixed(4)} (at day ${maxDeltaAt})`);
}

// --- Part 3: contradiction penalty comparison at the exact boundary scenarios ---

console.log('\n=== Part 3: contradiction penalty smoothness (stepped vs. ratio-based) ===\n');
const contradictionTestPoints = [1.5, 1.8, 1.9, 1.95, 2.0, 2.05, 2.1, 2.5];
console.log('ratio    stepped   ratio-based');
for (const ratio of contradictionTestPoints) {
  const weightedCount = ratio * 10; // existingCount fixed at 10 for this sweep
  const stepped = steppedContradictionPenalty(weightedCount, 10);
  const smooth = ratioBasedContradictionPenalty(weightedCount, 10);
  console.log(`${ratio.toFixed(2).padEnd(9)}${stepped.toFixed(3).padEnd(10)}${smooth.toFixed(3)}`);
}
