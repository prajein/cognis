/**
 * V1GapResolutionEvaluator.selftest.ts
 * Framework-free self-test, following the GapDetectionEngine.selftest.ts pattern.
 * Deterministic: uses a fixed `now` anchor and relative day-offsets, never
 * real Date.now() timing, so results never depend on when the test runs.
 * Exits 0 on all pass, 1 on any failure -- CI-ready.
 */
import { V1GapResolutionEvaluator } from './V1GapResolutionEvaluator';
import { ReasoningContext } from '../interfaces';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const NOW = 1_700_000_000_000; // fixed anchor, deterministic across runs

/** Converts day-offsets (negative = past) into absolute timestamps relative to NOW. */
function offsetsToTimestamps(offsetDays: number[]): number[] {
  return offsetDays.map((d) => NOW + d * MS_PER_DAY);
}

function makeContext(history: Record<string, number[]>): ReasoningContext {
  return {
    sessionId: 'selftest-session',
    now: NOW,
    getEventHistory: (marker: string) => history[marker] ?? [],
  };
}

// --- Test 1: chronic, unresolved gap type ---
{
  console.log('Test 1: chronic unresolved gap type');
  const context = makeContext({
    'gap.detected:audience': offsetsToTimestamps([-1, -3, -5, -7, -9, -11, -13, -15]), // 8 occurrences in 15 days
  });
  const candidates = new V1GapResolutionEvaluator().execute(context);
  const c = candidates.find((x) => x.metadata.gapType === 'audience');
  assert(c !== undefined, 'produces a candidate for a dense, unresolved gap type');
  assert(c?.title === 'Chronic gap: audience', 'title reflects chronic framing');
  assert(c?.domain === 'Gap', 'domain is Gap');
  assert((c?.evidenceCount ?? 0) === 8, 'evidenceCount matches recent occurrence count');
}

// --- Test 2: high-frequency but mostly resolved gap type is NOT chronic ---
{
  console.log('Test 2: mostly-resolved gap type should not be flagged chronic');
  const gapOffsets = [-1, -4, -7, -10, -13, -16, -19, -22];
  const resolutionOffsets = [-1, -4, -7, -10, -13, -16]; // 6 of 8 resolved
  const context = makeContext({
    'gap.detected:constraint': offsetsToTimestamps(gapOffsets),
    'ghosttext.accepted:constraint': offsetsToTimestamps(resolutionOffsets),
  });
  const candidates = new V1GapResolutionEvaluator().execute(context);
  const c = candidates.find((x) => x.metadata.gapType === 'constraint');
  assert(c === undefined, 'does not flag a mostly-resolved gap type');
}

// --- Test 3: insufficient total evidence produces no candidate ---
{
  console.log('Test 3: insufficient evidence');
  const context = makeContext({
    'gap.detected:stakes': offsetsToTimestamps([-1, -3]), // only 2, below MIN_EVIDENCE_COUNT
  });
  const candidates = new V1GapResolutionEvaluator().execute(context);
  assert(
    candidates.find((c) => c.metadata.gapType === 'stakes') === undefined,
    'no candidate below minimum evidence threshold',
  );
}

// --- Test 4: gap-free user produces zero candidates ---
{
  console.log('Test 4: gap-free user');
  const candidates = new V1GapResolutionEvaluator().execute(makeContext({}));
  assert(candidates.length === 0, 'zero candidates for a user with no gap history');
}

// --- Test 5: heavy historical pattern, now clearly reduced -> improving ---
{
  console.log('Test 5: improving gap type');
  const oldOffsets = Array.from({ length: 20 }, (_, i) => -(40 + i * 2)); // dense, well before lookback window
  const recentOffsets = [-5, -20]; // just 2 recent occurrences, well below chronic density
  const context = makeContext({
    'gap.detected:mechanism': offsetsToTimestamps([...oldOffsets, ...recentOffsets]),
  });
  const candidates = new V1GapResolutionEvaluator().execute(context);
  const c = candidates.find((x) => x.metadata.gapType === 'mechanism');
  assert(c !== undefined, 'produces a candidate for a clearly improving gap type');
  assert(c?.title === 'Improving gap: mechanism', 'title reflects improving framing, not chronic');
}

// --- Test 6: sparse-but-consistent evidence, neither chronic nor improving -> no candidate ---
{
  console.log('Test 6: no notable pattern');
  const context = makeContext({
    // 5 occurrences total, spread thin, no real historical baseline to compare against
    'gap.detected:temporal': offsetsToTimestamps([-2, -35, -70, -105, -140]),
  });
  const candidates = new V1GapResolutionEvaluator().execute(context);
  const c = candidates.find((x) => x.metadata.gapType === 'temporal');
  assert(c === undefined, 'does not force a pattern out of thin, inconsistent evidence');
}

// --- Test 7: multiple gap types can each independently produce candidates in one run ---
{
  console.log('Test 7: multiple concurrent gap types');
  const context = makeContext({
    'gap.detected:audience': offsetsToTimestamps([-1, -3, -5, -7, -9, -11]),
    'gap.detected:assumption': offsetsToTimestamps([-2, -4, -6, -8, -10, -12]),
  });
  const candidates = new V1GapResolutionEvaluator().execute(context);
  assert(candidates.length === 2, 'evaluates every gap type independently in a single execute() call');
}

// --- Test 8: structural validity of every candidate produced ---
{
  console.log('Test 8: structural validity');
  const context = makeContext({
    'gap.detected:second_order': offsetsToTimestamps([-1, -3, -5, -7, -9, -11]),
  });
  const candidates = new V1GapResolutionEvaluator().execute(context);
  for (const c of candidates) {
    assert(!!c.id, 'candidate has an id');
    assert(!!c.domain, 'candidate has a domain');
    assert(!!c.title, 'candidate has a title');
    assert(!!c.summary, 'candidate has a summary');
    assert(typeof c.confidence === 'number' && c.confidence >= 0 && c.confidence <= 1, 'confidence is in [0,1]');
    assert(c.evidenceCount > 0, 'evidenceCount is positive');
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
