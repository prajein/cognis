import { GapHeuristics } from './GapHeuristics';
import { labeledPrompts } from './labeledPrompts';

const heuristics = new GapHeuristics();

interface Row {
  id: string;
  gapType: string;
  humanJudgment: string;
  matchMechanism: string;
  wasFlagged: boolean;
  correct: boolean;
  note: string;
}

const rows: Row[] = [];

for (const p of labeledPrompts) {
  const result = heuristics.detect({ text: p.text, state: 'stretch', revisionDepth: 0 });
  const wasFlagged = result.signals.some((s) => s.gapType === p.gapType);

  // Correct if: human says "addressed" and it was NOT flagged (true negative),
  // or human says "gap_present" and it WAS flagged (true positive).
  const correct =
    (p.humanJudgment === 'addressed' && !wasFlagged) ||
    (p.humanJudgment === 'gap_present' && wasFlagged) ||
    (p.humanJudgment === 'below_length_floor' && !wasFlagged);

  rows.push({
    id: p.id,
    gapType: p.gapType,
    humanJudgment: p.humanJudgment,
    matchMechanism: p.matchMechanism,
    wasFlagged,
    correct,
    note: p.note,
  });
}

console.log('id        gapType          judgment       match   flagged  correct  note');
console.log('-'.repeat(120));
for (const r of rows) {
  console.log(
    r.id.padEnd(10) +
      r.gapType.padEnd(17) +
      r.humanJudgment.padEnd(15) +
      r.matchMechanism.padEnd(8) +
      String(r.wasFlagged).padEnd(9) +
      (r.correct ? 'YES' : 'NO ').padEnd(9) +
      r.note,
  );
}

const total = rows.length;
const correctCount = rows.filter((r) => r.correct).length;
console.log(`\nOverall: ${correctCount}/${total} correct (${((correctCount / total) * 100).toFixed(1)}%)`);

// Breakdown by match mechanism -- this is the key new-in-v0.2 comparison
console.log('\n=== Accuracy by match mechanism ===');
for (const mech of ['exact', 'stem', 'fuzzy', 'none']) {
  const subset = rows.filter((r) => r.matchMechanism === mech);
  if (subset.length === 0) continue;
  const subsetCorrect = subset.filter((r) => r.correct).length;
  console.log(`${mech.padEnd(8)} ${subsetCorrect}/${subset.length} correct`);
}

// Breakdown by gap type
console.log('\n=== Accuracy by gap type ===');
const gapTypes = [...new Set(rows.map((r) => r.gapType))];
for (const gt of gapTypes) {
  const subset = rows.filter((r) => r.gapType === gt);
  const subsetCorrect = subset.filter((r) => r.correct).length;
  console.log(`${gt.padEnd(15)} ${subsetCorrect}/${subset.length} correct`);
}

// Explicit false positive / false negative listing
console.log('\n=== Errors (false positives and false negatives) ===');
for (const r of rows.filter((r) => !r.correct)) {
  const errorType = r.humanJudgment === 'addressed' ? 'FALSE POSITIVE (flagged despite being addressed)' : 'FALSE NEGATIVE (missed a real gap)';
  console.log(`${r.id}: ${errorType} -- ${r.note}`);
}