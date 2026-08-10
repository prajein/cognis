import { EnrichmentEngine } from './EnrichmentEngine';
import { EventBus } from '../../core/event-bus/EventBus';
import { ConsoleErrorReporter } from '../../core/error/ConsoleErrorReporter';
import { CognitiveEvents, PromptEvents, SessionEvents } from '../../core/event-bus/registry';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { toSessionId, toTimestamp, toEventId } from '../../core/types/session.types';
import { DomainEvent, PromptEnrichedPayload } from '../../core/event-bus/contracts';
import { GapType } from '../../core/types/gap.types';

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

export async function runEnrichmentEngineTests(): Promise<{ passed: number; failed: number; failures: string[] }> {
  const c = new Checker();
  
  let virtualTime = 10000;
  const clock = () => toTimestamp(virtualTime);
  let idCount = 0;
  const idFactory = () => toEventId(`evt-${String(idCount++).padStart(4, '0')}`);

  const eventBus = new EventBus(new ConsoleErrorReporter());
  const engine = new EnrichmentEngine(eventBus, { latencyTimeoutMs: 1000 });
  engine.start();

  const sessionId = toSessionId('test-session-001');

  let lastEnrichedPayload: any = null;
  eventBus.subscribe(PromptEvents.ENRICHED, (evt: any) => {
    lastEnrichedPayload = evt.payload;
  });

  const triggerEnrichment = async () => {
    lastEnrichedPayload = null;
    await engine.enrich("test prompt", sessionId);
    return lastEnrichedPayload?.appliedLayers ?? [];
  };

  const publishGap = (gapType: string) => {
    eventBus.publish(CognitiveEvents.GAP_DETECTED, createDomainEvent(
      CognitiveEvents.GAP_DETECTED, sessionId, 'test', { gapType: gapType as GapType, confidence: 0.8 }, { clock, idFactory }
    ));
  };

  const publishTyped = () => {
    eventBus.publish(PromptEvents.TYPED, createDomainEvent(
      PromptEvents.TYPED, sessionId, 'test', { textLength: 10, wordCount: 2, currentTextHash: 'abc', revisionDepth: 0 }, { clock, idFactory }
    ));
  };

  // Base universal layers (identity, taskFrame, outputStructure, constraints)
  const universalLayers = ['identity', 'taskFrame', 'outputStructure', 'constraints'];

  // Test 1: No gap detected -> Only universal layers
  publishTyped(); // ensure clean state
  let applied = await triggerEnrichment();
  c.eq(applied, universalLayers, 'No gap detected -> Only universal layers');

  // Test 2: mechanism gap -> Universal + gapResolution
  publishTyped();
  publishGap('mechanism');
  applied = await triggerEnrichment();
  c.eq(applied, [...universalLayers, 'gapResolution'], 'mechanism gap -> Universal + gapResolution');

  // Test 3: second_order gap -> Universal + gapResolution
  publishTyped();
  publishGap('second_order');
  applied = await triggerEnrichment();
  c.eq(applied, [...universalLayers, 'gapResolution'], 'second_order gap -> Universal + gapResolution');

  // Test 4: constraint gap -> Universal layers (constraints is now universal)
  publishTyped();
  publishGap('constraint');
  applied = await triggerEnrichment();
  c.eq(applied, universalLayers, 'constraint gap -> Universal layers only');

  // Test 5: Multiple gaps -> Union of matching targeted layers, no duplicates
  publishTyped();
  publishGap('mechanism');
  publishGap('second_order');
  applied = await triggerEnrichment();
  c.eq(applied, [...universalLayers, 'gapResolution'], 'Multiple gaps -> Union without duplicates');

  // Test 6: New prompt.typed -> Clears previous gaps
  publishTyped(); // clears the gaps from Test 5
  applied = await triggerEnrichment();
  c.eq(applied, universalLayers, 'New prompt.typed -> Clears previous gaps');

  // Test 7: session.ended -> Clears previous gaps
  publishTyped();
  publishGap('mechanism');
  eventBus.publish(SessionEvents.ENDED, createDomainEvent(
    SessionEvents.ENDED, sessionId, 'test', { reason: 'timeout' }, { clock, idFactory }
  ));
  applied = await triggerEnrichment();
  c.eq(applied, universalLayers, 'session.ended -> Clears previous gaps');

  // Test 8: Invalid/unknown gap -> No accidental layer match
  publishTyped();
  publishGap('made_up_gap');
  applied = await triggerEnrichment();
  c.eq(applied, universalLayers, 'Invalid/unknown gap -> No accidental layer match');

  engine.stop();
  console.log(`[SelfTest EnrichmentEngine] passed=${c.passed} failed=${c.failed}`);
  if (c.failed > 0) {
    console.error('Failures:\n - ' + c.failures.join('\n - '));
  }

  return { passed: c.passed, failed: c.failed, failures: c.failures };
}

// Auto-run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runEnrichmentEngineTests().catch(console.error);
}

