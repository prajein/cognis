import { QualityAnalyzer } from './QualityAnalyzer';
import { AnalysisResult, ResponseAnalyzer } from '../interfaces';

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
    this.ok(actual === expected, `${label} (expected ${expected}, got ${actual})`);
  }
}

class MockAnalyzer implements ResponseAnalyzer {
  public readonly version = '1.0.0';
  public readonly analyzerName = 'MockAnalyzer';
  public readonly latencyBudgetMs = 10;
  constructor(public fixedScore: number) {}
  
  public analyze(): AnalysisResult {
    return {
      score: this.fixedScore,
      flags: [],
      metadata: {}
    };
  }
}

async function runQualityAnalyzerTests() {
  const c = new Checker();

  // Create fixed analyzers for everything EXCEPT assumption
  const structureMock = new MockAnalyzer(0.8) as any;
  const reasoningMock = new MockAnalyzer(0.9) as any;
  const completenessMock = new MockAnalyzer(1.0) as any;
  const gapCompletionMock = new MockAnalyzer(0.7) as any;
  
  // We will mutate the assumption mock's score
  const assumptionMock = new MockAnalyzer(0.0) as any;

  const qualityAnalyzer = new QualityAnalyzer(
    structureMock,
    reasoningMock,
    completenessMock,
    assumptionMock,
    gapCompletionMock
  );

  // Calculate the constant baseline from other analyzers
  // Weighting: Completeness (20%), Reasoning (25%), Structure (25%), Gap (15%)
  // Base = (0.8 * 0.20) + (0.9 * 0.25) + (1.0 * 0.25) + (0.7 * 0.15)
  // Base = 0.16 + 0.225 + 0.25 + 0.105 = 0.74

  console.log('[QualityAnalyzer.selftest] Starting tests...');

  // Test 1: Zero assumptions -> Maximum assumption contribution
  assumptionMock.fixedScore = 0.0;
  let result = qualityAnalyzer.analyze('test', 'hash');
  c.eq(Math.abs(result.score - (0.74 + 0.15)) < 0.0001, true, 'Zero assumptions should yield highest quality score');

  // Test 2: Maximum assumptions -> Zero assumption contribution
  assumptionMock.fixedScore = 1.0;
  result = qualityAnalyzer.analyze('test', 'hash');
  c.eq(Math.abs(result.score - 0.74) < 0.0001, true, 'Max assumptions should yield baseline quality score without bonus');

  // Test 3: Monotonic invariant
  // Holding structure, reasoning, completeness, and gap-completion scores constant, 
  // increasing assumption density must never increase composite quality.
  let previousQualityScore = 1.0; // Max possible
  let monotonicViolation = false;

  for (let assumptionScore = 0.0; assumptionScore <= 1.0; assumptionScore += 0.1) {
    assumptionMock.fixedScore = assumptionScore;
    const currentQualityScore = qualityAnalyzer.analyze('test', 'hash').score;
    
    if (currentQualityScore > previousQualityScore && assumptionScore > 0) {
      monotonicViolation = true;
      break;
    }
    previousQualityScore = currentQualityScore;
  }
  
  c.ok(!monotonicViolation, 'Increasing assumption density must monotonically decrease (or equal) composite quality');

  if (c.failed > 0) {
    console.error(`[QualityAnalyzer.selftest] FAILED: ${c.failed} failures`);
    for (const f of c.failures) console.error(`  - ${f}`);
    process.exit(1);
  } else {
    console.log(`[QualityAnalyzer.selftest] PASSED: ${c.passed} checks`);
    process.exit(0);
  }
}

runQualityAnalyzerTests().catch(err => {
  console.error(err);
  process.exit(1);
});
