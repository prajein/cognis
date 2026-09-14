import { EnrichmentEngine } from './EnrichmentEngine';
import { GapType } from '../../core/types/gap.types';
import { StateLabel } from '../../core/types/state.types';
import { EnrichmentInput } from '../../core/contracts';

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
    const act = Array.isArray(actual) ? actual.sort().join(',') : String(actual);
    const exp = Array.isArray(expected) ? expected.sort().join(',') : String(expected);
    this.ok(act === exp, `${label} (expected ${exp}, got ${act})`);
  }
}

function createInput(gaps: GapType[] = [], state: string = 'unknown'): EnrichmentInput {
  const gapsObj: Record<string, any> = {};
  for (const gap of gaps) {
    gapsObj[gap] = { detectedCount: 1 };
  }

  return {
    prompt: 'test prompt',
    currentState: state as StateLabel,
    ghostTextCompletions: [],
    identityProfile: null,
    gapProfile: {
      projectionId: 'gap-1',
      sessionId: 'session-1',
      lastUpdated: 0,
      gaps: gapsObj as any
    }
  };
}

export async function runEnrichmentEngineTests(): Promise<{ passed: number; failed: number; failures: string[] }> {
  const c = new Checker();
  const engine = new EnrichmentEngine();

  const universalLayers = ['identity', 'taskFrame', 'outputStructure', 'constraints'];

  // Test 1: No gap detected -> Only universal layers
  let result = engine.enrich(createInput([]));
  c.eq(result.appliedLayers, universalLayers, 'No gap detected -> Only universal layers');

  // Test 2: mechanism gap -> Universal + gapResolution
  result = engine.enrich(createInput(['mechanism']));
  c.eq(result.appliedLayers, [...universalLayers, 'gapResolution'], 'mechanism gap -> Universal + gapResolution');

  // Test 3: Multiple gaps -> Union without duplicates
  result = engine.enrich(createInput(['mechanism', 'second_order']));
  c.eq(result.appliedLayers, [...universalLayers, 'gapResolution'], 'Multiple gaps -> Union without duplicates');

  // Test 4: state.changed (stretch) -> Appends stretch suffix
  result = engine.enrich(createInput([], 'stretch'));
  c.ok(result.enrichedPrompt.includes('[PRODUCT DECISION PENDING: stretch suffix]'), 'state.changed (stretch) appends stretch suffix');

  // Test 5: Identity profile injection
  const inputWithIdentity = createInput([]);
  inputWithIdentity.identityProfile = {
    projectionId: 'id-1',
    sessionId: 'session-1',
    lastUpdated: 0,
    insights: [
      { type: 'goal', summary: 'test goal', timestamp: 0 }
    ]
  };
  result = engine.enrich(inputWithIdentity);
  c.ok(result.enrichedPrompt.includes('- goal: test goal'), 'Identity profile is injected');

  console.log(`[SelfTest EnrichmentEngine] passed=${c.passed} failed=${c.failed}`);
  if (c.failed > 0) {
    console.error('Failures:\n - ' + c.failures.join('\n - '));
  }

  return { passed: c.passed, failed: c.failed, failures: c.failures };
}

if (typeof require !== 'undefined' && require.main === module) {
  runEnrichmentEngineTests().catch(console.error);
}
