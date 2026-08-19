/**
 * InsightStrategies — self-test (FormulationGapTrendStrategy, CognitiveStateProxyStrategy)
 *
 * What & why: framework-free, fixture-driven coverage for the two new v0.2
 * insight strategies, following the same pattern as the other `*.selftest.ts`
 * files in the repo. Builds `ReasoningContext` fixtures by hand rather than
 * going through `ReasoningContextBuilder`/storage, so behaviour is verified
 * deterministically and independent of IndexedDB.
 *
 * Run (after a throwaway compile, since the repo has no bundler yet):
 *   tsc --module commonjs --moduleResolution node --outDir .selftest --noEmit false
 *   node .selftest/engines/insights/strategies/InsightStrategies.selftest.js
 *
 * Exports `runInsightStrategiesSelfTest()` returning a pass/fail report for any harness.
 */

import { ReasoningContext } from '../interfaces';
import { GapType } from '../../../core/types/gap.types';
import { SessionReadModel } from '../../../storage/projections/builders/SessionProjectionBuilder';
import { GapProfileReadModel } from '../../../storage/projections/builders/GapProfileProjectionBuilder';
import { AutomaticityReadModel } from '../../../storage/projections/builders/AutomaticityProjectionBuilder';
import { IdentityReadModel } from '../../../storage/projections/builders/IdentityProjectionBuilder';
import { ResponseMetricsReadModel } from '../../../storage/projections/builders/ResponseMetricsProjectionBuilder';
import { FormulationGapTrendStrategy } from './FormulationGapTrendStrategy';
import { CognitiveStateProxyStrategy } from './CognitiveStateProxyStrategy';

// ---------------------------------------------------------------------------
// Tiny test harness (mirrors the repo's other *.selftest.ts files)
// ---------------------------------------------------------------------------

interface SelfTestReport {
  readonly passed: number;
  readonly failed: number;
  readonly failures: readonly string[];
}

class Checker {
  passed = 0;
  failed = 0;
  readonly failures: string[] = [];

  ok(condition: boolean, label: string): void {
    if (condition) {
      this.passed++;
    } else {
      this.failed++;
      this.failures.push(label);
    }
  }

  eq(actual: unknown, expected: unknown, label: string): void {
    this.ok(actual === expected, `${label} (expected ${String(expected)}, got ${String(actual)})`);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION_ID = 'sess-strategy-test';
const NOW = 1_000_000_000;

const emptyGapStat = { detectedCount: 0, displayedCount: 0, acceptedCount: 0, dismissedCount: 0, rejectionCount: 0, lastDetectedAt: 0 };

function baseGapProfile(): GapProfileReadModel {
  const gaps = {} as GapProfileReadModel['gaps'];
  (['intentionality', 'audience', 'constraint', 'stakes', 'assumption', 'mechanism', 'temporal', 'second_order'] as GapType[]).forEach(
    (gapType) => (gaps[gapType] = { ...emptyGapStat }),
  );
  return { projectionId: `gap-profile-v1_${SESSION_ID}`, sessionId: SESSION_ID, gaps, lastUpdated: NOW };
}

function baseSession(overrides: Partial<SessionReadModel> = {}): SessionReadModel {
  return {
    projectionId: `session-v1_${SESSION_ID}`,
    sessionId: SESSION_ID,
    platform: 'claude',
    startTime: NOW - 10 * 60 * 1000, // 10 minutes ago
    status: 'active',
    totalPauseDurationMs: 0,
    lastUpdated: NOW,
    ...overrides,
  };
}

function baseAutomaticity(): AutomaticityReadModel {
  return { projectionId: `automaticity-v1_${SESSION_ID}`, sessionId: SESSION_ID, skills: {}, lastUpdated: NOW };
}
function baseIdentity(): IdentityReadModel {
  return { projectionId: `identity-v1_${SESSION_ID}`, sessionId: SESSION_ID, insights: [], lastUpdated: NOW };
}
function baseResponseMetrics(): ResponseMetricsReadModel {
  return {
    projectionId: `response-metrics-v1_${SESSION_ID}`,
    sessionId: SESSION_ID,
    totalResponses: 0,
    sumQualityScore: 0,
    sumReasoningScore: 0,
    sumStructuralScore: 0,
    flagsFrequency: {},
    lastUpdated: NOW,
  };
}

function buildContext(overrides: {
  gapProfile?: GapProfileReadModel;
  sessionMetrics?: SessionReadModel;
}): ReasoningContext {
  return {
    sessionId: SESSION_ID,
    now: NOW,
    sessionMetrics: overrides.sessionMetrics ?? baseSession(),
    automaticityProfile: baseAutomaticity(),
    gapProfile: overrides.gapProfile ?? baseGapProfile(),
    identityProfile: baseIdentity(),
    responseMetrics: baseResponseMetrics(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export function runInsightStrategiesSelfTest(): SelfTestReport {
  const c = new Checker();

  // --- FormulationGapTrendStrategy ---
  const gapStrategy = new FormulationGapTrendStrategy();

  // 1. Below the evidence floor -> no candidates, even with a bad ratio.
  {
    const gapProfile = baseGapProfile();
    gapProfile.gaps.audience = { detectedCount: 3, displayedCount: 3, acceptedCount: 0, dismissedCount: 3, rejectionCount: 3, lastDetectedAt: NOW };
    const result = gapStrategy.execute(buildContext({ gapProfile }));
    c.eq(result.length, 0, "gap trend: below MIN_DETECTED_COUNT emits nothing");
  }

  // 2. High rejection ratio with enough evidence -> a 'recurring blind spot' candidate.
  {
    const gapProfile = baseGapProfile();
    gapProfile.gaps.audience = { detectedCount: 6, displayedCount: 6, acceptedCount: 0, dismissedCount: 6, rejectionCount: 6, lastDetectedAt: NOW };
    const result = gapStrategy.execute(buildContext({ gapProfile }));
    c.eq(result.length, 1, "gap trend: high-rejection pattern emits one candidate");
    c.eq(result[0]?.domain, "Gap", "gap trend: recurring blind spot is domain Gap");
    c.eq(result[0]?.evidenceCount, 6, "gap trend: evidenceCount matches detectedCount");
    c.ok((result[0]?.confidence ?? 0) > 0.9, `gap trend: full-rejection confidence is high (got ${result[0]?.confidence})`);
  }

  // 3. Low rejection ratio with acceptances -> a 'forming habit' candidate.
  {
    const gapProfile = baseGapProfile();
    gapProfile.gaps.mechanism = { detectedCount: 8, displayedCount: 8, acceptedCount: 7, dismissedCount: 1, rejectionCount: 0, lastDetectedAt: NOW };
    const result = gapStrategy.execute(buildContext({ gapProfile }));
    c.eq(result.length, 1, "gap trend: low-rejection pattern emits one candidate");
    c.eq(result[0]?.domain, "Prompting", "gap trend: forming habit is domain Prompting");
  }

  // 4. Middling ratio (neither clearly landing nor failing) -> nothing, the
  //    honest "not enough of a pattern" stance.
  {
    const gapProfile = baseGapProfile();
    gapProfile.gaps.constraint = { detectedCount: 10, displayedCount: 10, acceptedCount: 4, dismissedCount: 4, rejectionCount: 4, lastDetectedAt: NOW };
    const result = gapStrategy.execute(buildContext({ gapProfile }));
    c.eq(result.length, 0, "gap trend: middling ratio emits nothing");
  }

  // --- CognitiveStateProxyStrategy ---
  const stateStrategy = new CognitiveStateProxyStrategy();

  // 5. Session too short -> nothing, regardless of pause ratio.
  {
    const sessionMetrics = baseSession({ startTime: NOW - 60 * 1000, totalPauseDurationMs: 50 * 1000 }); // 1 min session
    const result = stateStrategy.execute(buildContext({ sessionMetrics }));
    c.eq(result.length, 0, "state proxy: sub-minimum session duration emits nothing");
  }

  // 6. Long session, heavy pausing -> 'heavy deliberation' candidate.
  {
    const sessionMetrics = baseSession({
      startTime: NOW - 20 * 60 * 1000, // 20 min session
      totalPauseDurationMs: 10 * 60 * 1000, // 10 min paused (50%)
    });
    const result = stateStrategy.execute(buildContext({ sessionMetrics }));
    c.eq(result.length, 1, "state proxy: high pause ratio emits one candidate");
    c.eq(result[0]?.title, "Heavy deliberation this session", "state proxy: high pause ratio title");
  }

  // 7. Long session, minimal pausing -> 'sustained flow' candidate.
  {
    const sessionMetrics = baseSession({
      startTime: NOW - 20 * 60 * 1000,
      totalPauseDurationMs: 10 * 1000, // ~0.8%
    });
    const result = stateStrategy.execute(buildContext({ sessionMetrics }));
    c.eq(result.length, 1, "state proxy: low pause ratio emits one candidate");
    c.eq(result[0]?.title, "Sustained flow this session", "state proxy: low pause ratio title");
  }

  // 8. Long session, middling pause ratio -> nothing.
  {
    const sessionMetrics = baseSession({
      startTime: NOW - 20 * 60 * 1000,
      totalPauseDurationMs: 4 * 60 * 1000, // 20%
    });
    const result = stateStrategy.execute(buildContext({ sessionMetrics }));
    c.eq(result.length, 0, "state proxy: middling pause ratio emits nothing");
  }

  return { passed: c.passed, failed: c.failed, failures: c.failures };
}

// Auto-run when executed directly (compiled to CommonJS for the throwaway run).
declare const require: undefined | { main?: unknown };
declare const module: unknown;
if (typeof require !== "undefined" && (require as { main?: unknown }).main === module) {
  const report = runInsightStrategiesSelfTest();
  // eslint-disable-next-line no-console
  console.log(`[insight-strategies self-test] passed=${report.passed} failed=${report.failed}`);
  if (report.failed > 0) {
    // eslint-disable-next-line no-console
    console.error("Failures:\n - " + report.failures.join("\n - "));
    (globalThis as { process?: { exit(code: number): void } }).process?.exit(1);
  }
}
