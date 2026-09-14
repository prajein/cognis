/**
 * V1ReasoningDepthEvaluator.selftest.ts
 * Framework-free self-test. Deterministic fixed `now` anchor, no real-time
 * dependency. Exits 0 on all pass, 1 on any failure -- CI-ready.
 */
import { V1ReasoningDepthEvaluator } from './V1ReasoningDepthEvaluator';
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
const MARKER = 'response.analysis.completed';

function offsetsToTimestamps(offsetDays: number[]): number[] {
  return offsetDays.map((d) => NOW + d * MS_PER_DAY);
}

function makeContext(history: Record<string, number[]>): ReasoningContext {
  const timestamps = history[MARKER] ?? [];
  const cutoff = NOW - 30 * MS_PER_DAY;
  
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

  return {
    sessionId: 'selftest-session',
    now: NOW,
    globalAnalyticalProfile: {
      projectionId: 'global',
      responseAnalysis: {
        historicalCount,
        historicalEarliest,
        recentTimestamps
      },
      gaps: {} as any,
      lastUpdated: NOW
    }
  } as any;
}

// --- Test 1: clearly increasing engagement ---
{
  console.log('Test 1: increasing engagement');
  const earlier = Array.from({ length: 6 }, (_, i) => -(35 + i * 5)); // sparse, older: 6 events over 25 days
  const recent = Array.from({ length: 18 }, (_, i) => -(i * 1.5)); // dense, recent: 18 events over ~25 days
  const context = makeContext({ [MARKER]: offsetsToTimestamps([...earlier, ...recent]) });
  const candidates = new V1ReasoningDepthEvaluator().execute(context);
  assert(candidates.length === 1, 'produces exactly one candidate for a clear increasing trend');
  assert(candidates[0]?.title.startsWith('Increasing') ?? false, 'labeled as increasing');
  assert(candidates[0]?.metadata.signalType === 'engagement_frequency', 'metadata honestly labels signal as frequency, not depth');
}

// --- Test 2: clearly decreasing engagement ---
{
  console.log('Test 2: decreasing engagement');
  const earlier = Array.from({ length: 18 }, (_, i) => -(35 + i * 1.5));
  const recent = Array.from({ length: 6 }, (_, i) => -(i * 5));
  const context = makeContext({ [MARKER]: offsetsToTimestamps([...earlier, ...recent]) });
  const candidates = new V1ReasoningDepthEvaluator().execute(context);
  assert(candidates.length === 1, 'produces exactly one candidate for a clear decreasing trend');
  assert(candidates[0]?.title.startsWith('Decreasing') ?? false, 'labeled as decreasing');
}

// --- Test 3: flat/similar density on both sides -> no candidate ---
{
  console.log('Test 3: flat trend, below threshold');
  const earlier = Array.from({ length: 10 }, (_, i) => -(35 + i * 3));
  const recent = Array.from({ length: 10 }, (_, i) => -(i * 3));
  const context = makeContext({ [MARKER]: offsetsToTimestamps([...earlier, ...recent]) });
  const candidates = new V1ReasoningDepthEvaluator().execute(context);
  assert(candidates.length === 0, 'no trend reported when relative change is below threshold');
}

// --- Test 4: insufficient total evidence ---
{
  console.log('Test 4: insufficient evidence');
  const context = makeContext({ [MARKER]: offsetsToTimestamps([-1, -2]) });
  const candidates = new V1ReasoningDepthEvaluator().execute(context);
  assert(candidates.length === 0, 'no candidate below minimum evidence count');
}

// --- Test 5: no historical baseline (all evidence recent) -> no candidate ---
{
  console.log('Test 5: no historical baseline');
  const recent = Array.from({ length: 10 }, (_, i) => -(i * 2));
  const context = makeContext({ [MARKER]: offsetsToTimestamps(recent) });
  const candidates = new V1ReasoningDepthEvaluator().execute(context);
  assert(candidates.length === 0, 'cannot claim a trend without historical evidence to compare against');
}

// --- Test 6: no recent evidence at all (all historical) -> no candidate ---
{
  console.log('Test 6: no recent evidence');
  const earlier = Array.from({ length: 10 }, (_, i) => -(35 + i * 2));
  const context = makeContext({ [MARKER]: offsetsToTimestamps(earlier) });
  const candidates = new V1ReasoningDepthEvaluator().execute(context);
  assert(candidates.length === 0, 'cannot claim a trend without recent evidence');
}

// --- Test 7: structural validity ---
{
  console.log('Test 7: structural validity');
  const earlier = Array.from({ length: 6 }, (_, i) => -(35 + i * 5));
  const recent = Array.from({ length: 18 }, (_, i) => -(i * 1.5));
  const context = makeContext({ [MARKER]: offsetsToTimestamps([...earlier, ...recent]) });
  const candidates = new V1ReasoningDepthEvaluator().execute(context);
  for (const c of candidates) {
    assert(!!c.id, 'has id');
    assert(!!c.domain, 'has domain');
    assert(c.domain === 'Reasoning', 'domain is Reasoning');
    assert(!!c.title, 'has title');
    assert(!!c.summary, 'has summary');
    assert(c.confidence >= 0 && c.confidence <= 1, 'confidence in range');
    assert(c.evidenceCount > 0, 'evidenceCount is positive');
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
