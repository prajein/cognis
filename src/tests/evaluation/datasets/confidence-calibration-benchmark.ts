import * as fs from 'fs';
import * as path from 'path';
import { ConfidenceCalculator } from '../../../engines/insights/ConfidenceCalculator';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const NOW = 1_700_000_000_000;

const datasetPath = path.join(__dirname, 'confidence-calibration-dataset.json');
const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

const calculator = new ConfidenceCalculator();

interface ResultRow {
  id: string;
  description: string;
  purpose: string;
  actual: number;
  expectedRange: [number, number];
  withinRange: boolean;
}

const results: ResultRow[] = [];

for (const entry of dataset.entries) {
  const timestamps: number[] = entry.evidenceOffsetsDays.map((d: number) => NOW + d * MS_PER_DAY);

  const actual = calculator.calculate(
    timestamps,
    entry.requiredEvidenceCount,
    entry.baselineStrategyScore,
    entry.contradictsExistingIdentity,
    entry.existingEvidenceCount,
    NOW,
  );

  const [lo, hi] = entry.expectedConfidenceRange;
  const withinRange = actual >= lo && actual <= hi;

  results.push({
    id: entry.id,
    description: entry.description,
    purpose: entry.purpose,
    actual,
    expectedRange: [lo, hi],
    withinRange,
  });
}

console.log('id       actual   expected        in-range  description');
console.log('-'.repeat(110));
for (const r of results) {
  console.log(
    r.id.padEnd(9) +
      r.actual.toFixed(3).padEnd(9) +
      `[${r.expectedRange[0]}, ${r.expectedRange[1]}]`.padEnd(16) +
      (r.withinRange ? 'YES' : 'NO ').padEnd(10) +
      r.description,
  );
}

const outOfRange = results.filter((r) => !r.withinRange);
console.log(`\n${results.length - outOfRange.length}/${results.length} scenarios within human-judged expected range`);
if (outOfRange.length > 0) {
  console.log(`\nOut-of-range scenarios (potential miscalibration evidence):`);
  for (const r of outOfRange) {
    console.log(`  ${r.id}: actual=${r.actual.toFixed(3)}, expected=[${r.expectedRange}] -- ${r.purpose}`);
  }
}

// Specific cliff-magnitude reporting -- the headline evidence for the report
function findResult(id: string): ResultRow {
  const r = results.find((x) => x.id === id);
  if (!r) throw new Error(`missing ${id}`);
  return r;
}

console.log('\n=== Cliff magnitude analysis ===');
const cal002 = findResult('cal-002'); // 29 days
const cal003 = findResult('cal-003'); // 31 days
const drop30 = cal002.actual === 0 ? 0 : (cal002.actual - cal003.actual) / cal002.actual;
console.log(
  `30-day cliff: confidence drops from ${cal002.actual.toFixed(3)} (29d) to ${cal003.actual.toFixed(3)} (31d) -- a ${(drop30 * 100).toFixed(1)}% relative drop for a 2-day age difference`,
);

const cal004 = findResult('cal-004'); // 89 days
const cal005 = findResult('cal-005'); // 91 days
const drop90 = cal004.actual === 0 ? 0 : (cal004.actual - cal005.actual) / cal004.actual;
console.log(
  `90-day cliff: confidence drops from ${cal004.actual.toFixed(3)} (89d) to ${cal005.actual.toFixed(3)} (91d) -- a ${(drop90 * 100).toFixed(1)}% relative drop for a 2-day age difference`,
);

const cal010 = findResult('cal-010'); // 1.9x
const cal011 = findResult('cal-011'); // 2.0x
const dropContradiction = cal011.actual === 0 ? 0 : (cal011.actual - cal010.actual) / cal011.actual;
console.log(
  `Contradiction cliff: confidence jumps from ${cal010.actual.toFixed(3)} (1.9x evidence) to ${cal011.actual.toFixed(3)} (2.0x evidence) -- a ${(dropContradiction * 100).toFixed(1)}% relative jump crossing the 2x line`,
);

process.exit(outOfRange.length > 0 ? 1 : 0);
