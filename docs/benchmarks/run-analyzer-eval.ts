/**
 * Response Analyzer Eval Harness
 *
 * What & why: runs the real StructureAnalyzer / ReasoningAnalyzer /
 * CompletenessAnalyzer / QualityAnalyzer (composite) against a small,
 * hand-picked fixture set and reports whether each score lands inside its
 * expected band. See `response-analyzer-fixtures.json` for the honesty note
 * on what these bands are (regression bands reviewed for face plausibility,
 * NOT independently human-annotated ground truth) — there is no labeled
 * corpus or human-rating pipeline in this repo to draw real ground truth
 * from, so overclaiming that would be dishonest. This still catches real
 * regressions: if a future change to any analyzer's formula silently shifts
 * how it scores a clearly-good vs. clearly-shallow vs. clearly-cut-off
 * response, a band here will fail.
 *
 * Follows the repo's existing no-framework convention (see the *.selftest.ts
 * files) rather than introducing Jest/Vitest.
 *
 * Run: npx tsx docs/benchmarks/run-analyzer-eval.ts
 */

import { StructureAnalyzer } from '../../src/engines/response/analyzers/StructureAnalyzer';
import { ReasoningAnalyzer } from '../../src/engines/response/analyzers/ReasoningAnalyzer';
import { CompletenessAnalyzer } from '../../src/engines/response/analyzers/CompletenessAnalyzer';
import { AssumptionAnalyzer } from '../../src/engines/response/analyzers/AssumptionAnalyzer';
import { GapCompletionAnalyzer } from '../../src/engines/response/analyzers/GapCompletionAnalyzer';
import { QualityAnalyzer } from '../../src/engines/response/analyzers/QualityAnalyzer';
import fixturesJson from './response-analyzer-fixtures.json';

interface Fixture {
  readonly id: string;
  readonly description: string;
  readonly responseText: string;
  readonly expected: Partial<Record<
    'structure' | 'reasoning' | 'completeness' | 'quality' | 'gapCompletion' | 'assumption',
    [number, number]
  >>;
}

const fixtures = (fixturesJson as { fixtures: Fixture[] }).fixtures;

const structureAnalyzer = new StructureAnalyzer();
const reasoningAnalyzer = new ReasoningAnalyzer();
const completenessAnalyzer = new CompletenessAnalyzer();
const assumptionAnalyzer = new AssumptionAnalyzer();
const gapCompletionAnalyzer = new GapCompletionAnalyzer();
const qualityAnalyzer = new QualityAnalyzer(
  structureAnalyzer,
  reasoningAnalyzer,
  completenessAnalyzer,
  assumptionAnalyzer,
  gapCompletionAnalyzer,
);

interface EvalRow {
  readonly fixtureId: string;
  readonly metric: string;
  readonly actual: number;
  readonly expectedBand: [number, number];
  readonly pass: boolean;
}

function inBand(actual: number, band: [number, number]): boolean {
  return actual >= band[0] && actual <= band[1];
}

function evaluateFixture(fixture: Fixture): EvalRow[] {
  const rows: EvalRow[] = [];
  const scores: Record<string, number> = {
    structure: structureAnalyzer.analyze(fixture.responseText, 'hash').score,
    reasoning: reasoningAnalyzer.analyze(fixture.responseText, 'hash').score,
    completeness: completenessAnalyzer.analyze(fixture.responseText, 'hash').score,
    assumption: assumptionAnalyzer.analyze(fixture.responseText, 'hash').score,
    gapCompletion: gapCompletionAnalyzer.analyze(fixture.responseText, 'hash').score,
    quality: qualityAnalyzer.analyze(fixture.responseText, 'hash').score,
  };

  for (const [metric, band] of Object.entries(fixture.expected)) {
    const actual = scores[metric];
    rows.push({
      fixtureId: fixture.id,
      metric,
      actual,
      expectedBand: band as [number, number],
      pass: inBand(actual, band as [number, number]),
    });
  }

  return rows;
}

function main(): void {
  const allRows = fixtures.flatMap(evaluateFixture);
  const failures = allRows.filter((row) => !row.pass);

  console.log('[response-analyzer-eval] Results:\n');
  for (const fixture of fixtures) {
    console.log(`  ${fixture.id} — ${fixture.description}`);
    const rows = allRows.filter((r) => r.fixtureId === fixture.id);
    for (const row of rows) {
      const status = row.pass ? 'PASS' : 'FAIL';
      console.log(
        `    [${status}] ${row.metric}: ${row.actual.toFixed(3)} (expected [${row.expectedBand[0]}, ${row.expectedBand[1]}])`,
      );
    }
  }

  console.log(
    `\n[response-analyzer-eval] ${allRows.length - failures.length}/${allRows.length} checks in-band.`,
  );

  if (failures.length > 0) {
    console.error(`[response-analyzer-eval] ${failures.length} check(s) out of band:`);
    for (const f of failures) {
      console.error(`  - ${f.fixtureId}/${f.metric}: got ${f.actual.toFixed(3)}, expected [${f.expectedBand[0]}, ${f.expectedBand[1]}]`);
    }
    process.exit(1);
  }
}

main();
