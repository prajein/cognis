import { ResponseIntelligenceEngine } from './ResponseIntelligenceEngine';
import { EventBus } from '../../core/event-bus/EventBus';
import { ConsoleErrorReporter } from '../../core/error/ConsoleErrorReporter';
import { ResponseEvents, PromptEvents } from '../../core/event-bus/registry';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { toSessionId, toTimestamp, toEventId } from '../../core/types/session.types';
import { DomainEvent, ResponseAnalysisCompletedPayload } from '../../core/event-bus/contracts';

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

export async function runResponseIntelligenceEngineTests(): Promise<{ passed: number; failed: number; failures: string[] }> {
  const c = new Checker();
  
  let virtualTime = 10000;
  const clock = () => toTimestamp(virtualTime);
  let idCount = 0;
  const idFactory = () => toEventId(`evt-${String(idCount++).padStart(4, '0')}`);

  const eventBus = new EventBus(new ConsoleErrorReporter());
  const engine = new ResponseIntelligenceEngine();
  engine.start(eventBus);

  const sessionId = toSessionId('session-c6');

  // Track analysis completed payloads
  const completedPayloads: ResponseAnalysisCompletedPayload[] = [];
  eventBus.subscribe(ResponseEvents.ANALYSIS_COMPLETED, (evt: DomainEvent<ResponseAnalysisCompletedPayload>) => {
    completedPayloads.push(evt.payload);
  });

  const sendResponseSequence = (promptHash: string, promptEventId?: string, wasEnriched?: boolean) => {
    // 1. Emit response.started
    eventBus.publish(ResponseEvents.STARTED, createDomainEvent(
      ResponseEvents.STARTED,
      sessionId,
      'test',
      { promptHash, promptEventId, wasEnriched },
      { clock, idFactory }
    ));

    // 2. Emit response.chunk
    eventBus.publish(ResponseEvents.CHUNK, createDomainEvent(
      ResponseEvents.CHUNK,
      sessionId,
      'test',
      { chunkText: 'Hello world. ', chunkLength: 13, totalLength: 13 },
      { clock, idFactory }
    ));

    // 3. Emit response.completed
    eventBus.publish(ResponseEvents.COMPLETED, createDomainEvent(
      ResponseEvents.COMPLETED,
      sessionId,
      'test',
      { responseLength: 13, durationMs: 100 },
      { clock, idFactory }
    ));
  };

  // Test 1: Unique prompts -> Unique promptEventIds
  completedPayloads.length = 0;
  sendResponseSequence('hashA', 'P-0001', true);
  c.eq(completedPayloads.length, 1, 'Test 1: Analysis emitted');
  c.eq(completedPayloads[0]?.promptEventId, 'P-0001', 'Test 1: promptEventId matches');
  c.eq(completedPayloads[0]?.wasEnriched, true, 'Test 1: wasEnriched matches');

  // Test 2: Identical prompt text submitted twice -> distinct promptEventIds
  completedPayloads.length = 0;
  sendResponseSequence('hashA', 'P-0002', false);
  sendResponseSequence('hashA', 'P-0003', true);
  c.eq(completedPayloads.length, 2, 'Test 2: Two analyses emitted');
  c.eq(completedPayloads[0]?.promptEventId, 'P-0002', 'Test 2 (first): promptEventId maps to P-0002');
  c.eq(completedPayloads[0]?.wasEnriched, false, 'Test 2 (first): wasEnriched maps to false');
  c.eq(completedPayloads[1]?.promptEventId, 'P-0003', 'Test 2 (second): promptEventId maps to P-0003');
  c.eq(completedPayloads[1]?.wasEnriched, true, 'Test 2 (second): wasEnriched maps to true');

  // Test 3: Regeneration -> same promptEventId, separate response attempt
  // (In regeneration, two separate response sequences are fired without a new prompt.sent event)
  completedPayloads.length = 0;
  // First attempt
  sendResponseSequence('hashB', 'P-0004', true);
  // Second attempt (regeneration)
  sendResponseSequence('hashB', 'P-0004', true);
  c.eq(completedPayloads.length, 2, 'Test 3: Two attempts resolved');
  c.eq(completedPayloads[0]?.promptEventId, 'P-0004', 'Test 3 (first): maps to P-0004');
  c.eq(completedPayloads[1]?.promptEventId, 'P-0004', 'Test 3 (second): maps to P-0004');

  // Test 4: Unattributed/legacy safety -> safe legacy behavior (undefined promptEventId/wasEnriched)
  completedPayloads.length = 0;
  sendResponseSequence('legacyHash'); // No promptEventId or wasEnriched passed
  c.eq(completedPayloads.length, 1, 'Test 4: Legacy resolved');
  c.eq(completedPayloads[0]?.promptEventId, undefined, 'Test 4: promptEventId is undefined');
  c.eq(completedPayloads[0]?.wasEnriched, undefined, 'Test 4: wasEnriched is undefined');

  engine.stop();
  console.log(`[SelfTest ResponseIntelligenceEngine] passed=${c.passed} failed=${c.failed}`);
  if (c.failed > 0) {
    console.error('Failures:\n - ' + c.failures.join('\n - '));
  }

  return { passed: c.passed, failed: c.failed, failures: c.failures };
}

// Auto-run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runResponseIntelligenceEngineTests().catch(console.error);
}
