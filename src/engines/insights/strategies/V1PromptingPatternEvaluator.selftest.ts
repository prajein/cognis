/**
 * V1PromptingPatternEvaluator.selftest.ts
 * Framework-free self-test. Deterministic fixed `now` anchor.
 * Exits 0 on all pass, 1 on any failure -- CI-ready.
 */
import { V1PromptingPatternEvaluator } from './V1PromptingPatternEvaluator';
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
const NOW = 1_700_000_000_000;

function offsetsToTimestamps(offsetDays: number[]): number[] {
  return offsetDays.map((d) => NOW + d * MS_PER_DAY);
}

function makeContext(history: Record<string, number[]>): ReasoningContext {
  const gaps = {} as Record<string, any>;
  const ALL_GAP_TYPES = ['intentionality', 'audience', 'constraint', 'stakes', 'assumption', 'mechanism', 'temporal', 'second_order'];
  const cutoff = NOW - 30 * MS_PER_DAY;

  for (const gapType of ALL_GAP_TYPES) {
    const timestamps = history[`gap.detected:${gapType}`] ?? [];
    let historicalCount = 0;
    let historicalEarliest = 0;
    const recentTimestamps: number[] = [];

    for (const t of timestamps) {
      if (t < cutoff) {
        historicalCount++;
        if (historicalEarliest === 0 || t < historicalEarliest) {
          historicalEarliest = t;
        }
      } else {
        recentTimestamps.push(t);
      }
    }

    gaps[gapType] = {
      detection: { historicalCount, historicalEarliest, recentTimestamps },
      resolution: { historicalCount: 0, historicalEarliest: 0, recentTimestamps: [] }
    };
  }

  return {
    sessionId: 'selftest-session',
    now: NOW,
    globalAnalyticalProfile: {
      projectionId: 'global',
      responseAnalysis: { historicalCount: 0, historicalEarliest: 0, recentTimestamps: [] },
      gaps,
      lastUpdated: NOW
    }
  } as any;
}

// --- Test 1: improving -- gap frequency has clearly declined ---
{
  console.log('Test 1: improving prompt quality');
  const earlier = Array.from({ length: 20 }, (_, i) => -(35 + i)); // dense: 20 gaps over 20 days, earlier
  const recent = Array.from({ length: 5 }, (_, i) => -(i * 5)); // sparse: 5 gaps over 20 days, recent
  const context = makeContext({
    'gap.detected:audience': offsetsToTimestamps(earlier),
    'gap.detected:constraint': offsetsToTimestamps(recent),
  });
  const candidates = new V1PromptingPatternEvaluator().execute(context);
  assert(candidates.length === 1, 'produces exactly one candidate for a clear frequency decline');
  assert(candidates[0]?.domain === 'Prompting', 'domain is Prompting');
  assert(candidates[0]?.title === 'Prompt specificity is improving', 'framed as improving');
  assert(
    (candidates[0]?.summary.includes('%') ?? false) && !(candidates[0]?.summary.includes('sessions') ?? true),
    'summary reports a percentage over a day-based window, not an unverifiable session count',
  );
}

// --- Test 2: declining -- gap frequency has clearly increased ---
{
  console.log('Test 2: declining prompt quality');
  const earlier = Array.from({ length: 5 }, (_, i) => -(35 + i * 4));
  const recent = Array.from({ length: 20 }, (_, i) => -(i * 1.2));
  const context = makeContext({
    'gap.detected:mechanism': offsetsToTimestamps([...earlier, ...recent]),
  });
  const candidates = new V1PromptingPatternEvaluator().execute(context);
  assert(candidates.length === 1, 'produces exactly one candidate for a clear frequency increase');
  assert(candidates[0]?.title === 'Prompt specificity is declining', 'framed as declining');
}

// --- Test 3: aggregates across multiple gap types correctly ---
{
  console.log('Test 3: aggregation across gap types');
  const earlierA = Array.from({ length: 10 }, (_, i) => -(31 + i)); // 10 events, days -31..-40
  const earlierB = Array.from({ length: 10 }, (_, i) => -(31 + i)); // 10 more, same window, different type
  const recentA = [-1, -2, -3];
  const recentB = [-4, -5];
  const context = makeContext({
    'gap.detected:audience': offsetsToTimestamps([...earlierA, ...recentA]),
    'gap.detected:stakes': offsetsToTimestamps([...earlierB, ...recentB]),
  });
  const candidates = new V1PromptingPatternEvaluator().execute(context);
  assert(candidates.length === 1, 'produces a single holistic candidate, not one per gap type');
  assert(candidates[0]?.evidenceCount === 5, 'evidenceCount reflects the combined recent total across gap types (3+2)');
}

// --- Test 4: flat/small change produces no candidate ---
{
  console.log('Test 4: flat trend');
  const earlier = Array.from({ length: 10 }, (_, i) => -(35 + i * 3));
  const recent = Array.from({ length: 10 }, (_, i) => -(i * 3));
  const context = makeContext({ 'gap.detected:temporal': offsetsToTimestamps([...earlier, ...recent]) });
  const candidates = new V1PromptingPatternEvaluator().execute(context);
  assert(candidates.length === 0, 'no trend claimed when the relative change is below threshold');
}

// --- Test 5: insufficient evidence ---
{
  console.log('Test 5: insufficient evidence');
  const context = makeContext({ 'gap.detected:audience': offsetsToTimestamps([-1, -2]) });
  const candidates = new V1PromptingPatternEvaluator().execute(context);
  assert(candidates.length === 0, 'no candidate below minimum evidence count');
}

// --- Test 6: no gap history at all ---
{
  console.log('Test 6: no gap history');
  const candidates = new V1PromptingPatternEvaluator().execute(makeContext({}));
  assert(candidates.length === 0, 'zero candidates for a user with no gap history at all');
}

// --- Test 7: structural validity ---
{
  console.log('Test 7: structural validity');
  const earlier = Array.from({ length: 20 }, (_, i) => -(35 + i));
  const recent = Array.from({ length: 5 }, (_, i) => -(i * 5));
  const context = makeContext({ 'gap.detected:audience': offsetsToTimestamps([...earlier, ...recent]) });
  const candidates = new V1PromptingPatternEvaluator().execute(context);
  for (const c of candidates) {
    assert(!!c.id, 'has id');
    assert(c.domain === 'Prompting', 'domain is Prompting');
    assert(!!c.title, 'has title');
    assert(!!c.summary, 'has summary');
    assert(c.confidence >= 0 && c.confidence <= 1, 'confidence in range');
    assert(c.evidenceCount > 0, 'evidenceCount is positive');
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
