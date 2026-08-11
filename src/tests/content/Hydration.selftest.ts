import { GapType } from '../../core/types/gap.types';
import { SessionId } from '../../core/types/session.types';

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

  eq(actual: unknown, expected: unknown, label: string): void {
    this.ok(actual === expected, `${label} (expected ${expected}, got ${actual})`);
  }
}

async function runHydrationTests() {
  const c = new Checker();

  console.log('[Hydration.selftest] Starting tests...');

  // Mocking the closure logic from content/index.ts
  const createHydrationContext = () => {
    let localSessionId: SessionId | null = null;
    let hydratedSuppressedGaps: GapType[] | null = null;
    let hydrationEmitted = false;
    let emittedGaps: GapType[] = [];
    let emittedSession: SessionId | null = null;

    const tryHydrate = () => {
      if (hydrationEmitted || !localSessionId || !hydratedSuppressedGaps) {
        return;
      }
      hydrationEmitted = true;
      emittedGaps = hydratedSuppressedGaps;
      emittedSession = localSessionId;
    };

    return {
      triggerSessionStart: (id: SessionId) => {
        localSessionId = id;
        tryHydrate();
      },
      triggerQueryResponse: (gaps: GapType[]) => {
        hydratedSuppressedGaps = gaps;
        tryHydrate();
      },
      getEmitted: () => ({ emittedGaps, emittedSession, hydrationEmitted })
    };
  };

  // Case A: query -> session.started -> response
  let ctx = createHydrationContext();
  ctx.triggerSessionStart('s1' as SessionId);
  ctx.triggerQueryResponse(['audience']);
  c.eq(ctx.getEmitted().hydrationEmitted, true, 'Case A: Should emit');
  c.eq(ctx.getEmitted().emittedSession, 's1', 'Case A: Uses local session ID');
  c.eq(ctx.getEmitted().emittedGaps[0], 'audience', 'Case A: Emits correct gap');

  // Case B: query -> response -> session.started
  ctx = createHydrationContext();
  ctx.triggerQueryResponse(['intentionality']);
  ctx.triggerSessionStart('s2' as SessionId);
  c.eq(ctx.getEmitted().hydrationEmitted, true, 'Case B: Should emit');
  c.eq(ctx.getEmitted().emittedSession, 's2', 'Case B: Uses local session ID');
  c.eq(ctx.getEmitted().emittedGaps[0], 'intentionality', 'Case B: Emits correct gap');

  // Case D: Duplicate session.started
  ctx = createHydrationContext();
  ctx.triggerQueryResponse(['intentionality']);
  ctx.triggerSessionStart('s2' as SessionId);
  ctx.triggerSessionStart('s3' as SessionId); // Duplicate
  c.eq(ctx.getEmitted().emittedSession, 's2', 'Case D: Should not emit twice');

  // Case F: Query failure (simulated by returning [])
  ctx = createHydrationContext();
  ctx.triggerSessionStart('s4' as SessionId);
  ctx.triggerQueryResponse([]);
  c.eq(ctx.getEmitted().hydrationEmitted, true, 'Case F: Should emit on failure fallback');
  c.eq(ctx.getEmitted().emittedGaps.length, 0, 'Case F: Should emit empty array');

  if (c.failed > 0) {
    console.error(`[Hydration.selftest] FAILED: ${c.failed} failures`);
    for (const f of c.failures) console.error(`  - ${f}`);
    process.exit(1);
  } else {
    console.log(`[Hydration.selftest] PASSED: ${c.passed} checks`);
    process.exit(0);
  }
}

runHydrationTests().catch(err => {
  console.error(err);
  process.exit(1);
});
