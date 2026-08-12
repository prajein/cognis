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

  const triggerEnrichment = async (text: string = "test prompt") => {
    lastEnrichedPayload = null;
    const finalEnriched = await engine.enrich(text, sessionId);
    return { appliedLayers: lastEnrichedPayload?.appliedLayers ?? [], finalEnriched };
  };

  const publishGap = (gapType: string) => {
    eventBus.publish(CognitiveEvents.GAP_DETECTED, createDomainEvent(
      CognitiveEvents.GAP_DETECTED, sessionId, 'test', { gapType: gapType as GapType, confidence: 0.8 }, { clock, idFactory }
    ));
  };

  const publishState = (stateLabel: string) => {
    eventBus.publish('state.changed', createDomainEvent(
      'state.changed', sessionId, 'test', { currentState: stateLabel as any, previousState: 'unknown', confidence: 1 }, { clock, idFactory }
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
  publishState('unknown');
  let result = await triggerEnrichment();
  let applied = result.appliedLayers;
  c.eq(applied, universalLayers, 'No gap detected -> Only universal layers');

  // Test 2: mechanism gap -> Universal + gapResolution
  publishTyped();
  publishGap('mechanism');
  result = await triggerEnrichment();
  applied = result.appliedLayers;
  c.eq(applied, [...universalLayers, 'gapResolution'], 'mechanism gap -> Universal + gapResolution');

  // Test 3: second_order gap -> Universal + gapResolution
  publishTyped();
  publishGap('second_order');
  result = await triggerEnrichment();
  applied = result.appliedLayers;
  c.eq(applied, [...universalLayers, 'gapResolution'], 'second_order gap -> Universal + gapResolution');

  // Test 4: constraint gap -> Universal layers (constraints is now universal)
  publishTyped();
  publishGap('constraint');
  result = await triggerEnrichment();
  applied = result.appliedLayers;
  c.eq(applied, universalLayers, 'constraint gap -> Universal layers only');

  // Test 5: Multiple gaps -> Union of matching targeted layers, no duplicates
  publishTyped();
  publishGap('mechanism');
  publishGap('second_order');
  result = await triggerEnrichment();
  applied = result.appliedLayers;
  c.eq(applied, [...universalLayers, 'gapResolution'], 'Multiple gaps -> Union without duplicates');

  // Test 6: New prompt.typed -> Clears previous gaps
  publishTyped(); // clears the gaps from Test 5
  result = await triggerEnrichment();
  applied = result.appliedLayers;
  c.eq(applied, universalLayers, 'New prompt.typed -> Clears previous gaps');

  // Test 7: session.ended -> Clears previous gaps
  publishTyped();
  publishGap('mechanism');
  eventBus.publish(SessionEvents.ENDED, createDomainEvent(
    SessionEvents.ENDED, sessionId, 'test', { reason: 'timeout' }, { clock, idFactory }
  ));
  result = await triggerEnrichment();
  applied = result.appliedLayers;
  c.eq(applied, universalLayers, 'session.ended -> Clears previous gaps');

  // Test 8: Invalid/unknown gap -> No accidental layer match
  publishTyped();
  publishGap('made_up_gap');
  result = await triggerEnrichment();
  applied = result.appliedLayers;
  c.eq(applied, universalLayers, 'Invalid/unknown gap -> No accidental layer match');

  // Test 9: state.changed (stretch) -> Appends stretch suffix
  publishTyped();
  publishState('stretch');
  result = await triggerEnrichment();
  c.ok(result.finalEnriched.includes('[PRODUCT DECISION PENDING: stretch suffix]'), 'state.changed (stretch) appends stretch suffix');

  // Test 10: state.changed (unknown) -> No suffix appended
  publishTyped();
  publishState('unknown');
  result = await triggerEnrichment();
  c.ok(!result.finalEnriched.includes('[PRODUCT DECISION PENDING:'), 'state.changed (unknown) appends no suffix');

  // Test 11: Unconfigured/future state safely falls back to no suffix without throwing
  publishTyped();
  publishState('hypothetical_future_state');
  result = await triggerEnrichment();
  c.ok(!result.finalEnriched.includes('[PRODUCT DECISION PENDING:'), 'unconfigured state safely falls back to no suffix');

  // Test 12: Exact rawText byte-for-byte check
  publishTyped();
  const rawTestString = "This is my precise raw text. \n\n Don't mutate it!";
  result = await triggerEnrichment(rawTestString);
  c.ok(result.finalEnriched.endsWith(`\n### User Prompt\n${rawTestString}`), 'Exact rawText is appended byte-for-byte at the end of the enriched output');

  engine.stop();

  // --- Week 5 Causal Consumption Tests ---

  // Test 13: Identity Causal Consumption
  const eventBusA = new EventBus(new ConsoleErrorReporter());
  const engineA = new EnrichmentEngine(eventBusA, {
    latencyTimeoutMs: 1000,
    identityProfile: { answer1: 'X', answer2: 'Y', answer3: 'Z' }
  });
  engineA.start();

  const eventBusB = new EventBus(new ConsoleErrorReporter());
  const engineB = new EnrichmentEngine(eventBusB, {
    latencyTimeoutMs: 1000,
    identityProfile: { answer1: 'A', answer2: 'B', answer3: 'C' }
  });
  engineB.start();

  const outA = await engineA.enrich('test', sessionId);
  const outB = await engineB.enrich('test', sessionId);
  c.ok(outA !== outB, 'Identity Causal Consumption: outputA !== outputB');
  c.ok(outA.includes('- Answer 1: X'), 'Profile A values are present in output A');
  c.ok(outB.includes('- Answer 1: A'), 'Profile B values are present in output B');

  engineA.stop();
  engineB.stop();

  // Test 14: Persisted Gap Causal Consumption
  const eventBusGap = new EventBus(new ConsoleErrorReporter());
  const engineGap = new EnrichmentEngine(eventBusGap, {
    latencyTimeoutMs: 1000,
    initialActiveGaps: ['mechanism']
  });
  engineGap.start();

  let gapAppliedLayers: string[] = [];
  eventBusGap.subscribe(PromptEvents.ENRICHED, (evt: any) => {
    gapAppliedLayers = evt.payload.appliedLayers;
  });

  await engineGap.enrich('test', sessionId);
  c.ok(gapAppliedLayers.includes('gapResolution'), 'Persisted mechanism gap adds gapResolution layer without live event');
  engineGap.stop();

  // Test 15: Session Isolation & Failure Isolation
  // Covered inherently by constructing new engines per context, but let's test isolation between two engines:
  const eventBusIso = new EventBus(new ConsoleErrorReporter());
  const engineSessA = new EnrichmentEngine(eventBusIso, { initialActiveGaps: ['mechanism'] });
  const engineSessB = new EnrichmentEngine(eventBusIso, { initialActiveGaps: [] }); // Simulating a different session context

  const isoOutA = await engineSessA.enrich('test', sessionId);
  const isoOutB = await engineSessB.enrich('test', sessionId);
  c.ok(isoOutA !== isoOutB, 'Session A gap state does not leak into Session B (different engine instance)');
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

