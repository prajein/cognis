import { EventBus } from '../../../core/event-bus/EventBus';
import { ConsoleErrorReporter } from '../../../core/error/ConsoleErrorReporter';
import { ReadModelRepository } from '../../../storage/repositories/ReadModelRepository';
import { ProjectionManager } from '../../../storage/projections/ProjectionManager';
import { GlobalAnalyticalProfileProjectionBuilder } from '../../../storage/projections/builders/GlobalAnalyticalProfileProjectionBuilder';
import { InsightEngine } from '../../../engines/insights/InsightEngine';
import { SyntheticEventGenerator } from '../../../mock/harness/SyntheticEventGenerator';
import { toSessionId, toTimestamp, toEventId } from '../../../core/types/session.types';

// Mock DB Repositories for E2E
class MockCognisDatabase {
  private memory = new Map<string, any>();
  transaction(storeName: string, mode: string, callback: (tx: any) => Promise<any>) {
    const tx = {
      objectStore: (name: string) => ({
        get: (id: string) => {
          const req: any = { result: this.memory.get(id) };
          queueMicrotask(() => req.onsuccess?.());
          return req;
        },
        put: (model: any) => {
          this.memory.set(model.projectionId, model);
          const req: any = {};
          queueMicrotask(() => req.onsuccess?.());
          return req;
        }
      })
    };
    return callback(tx);
  }
}

class InMemoryEventRepo {
  async saveEvent() {}
  async loadEventStream() { return []; }
}

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

async function runE2EValidation(): Promise<void> {
  console.log('Running InsightEngine V1 E2E Validation...');

  const bus = new EventBus(new ConsoleErrorReporter());
  const db = new MockCognisDatabase();
  const readModelRepo = new ReadModelRepository(db as any);
  
  // 1. Hook up the ReadModel Projection (CQRS write side)
  const builder = new GlobalAnalyticalProfileProjectionBuilder(readModelRepo);
  const projectionManager = new ProjectionManager([builder], bus, new InMemoryEventRepo() as any, new ConsoleErrorReporter());
  projectionManager.startLiveSubscriptions();

  // 2. Start Insight Engine (CQRS read side)
  const engine = new InsightEngine();
  engine.start(bus, readModelRepo);

  // 3. Spy on generated insights
  const generatedInsights: any[] = [];
  bus.subscribe('insight.generated', (event) => {
    generatedInsights.push(event.payload);
  });

  // 4. Generate Adversarial Data
  // We want to prove V1ReasoningDepthEvaluator detects a spike.
  // It requires at least 5 baseline events and 5 recent events, and a density increase > 0.25.
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const NOW = Date.now();
  
  let clockTick = 0;
  const clock = () => toTimestamp(clockTick++);
  let idCounter = 0;
  const idFactory = () => toEventId(`evt-${String(idCounter++).padStart(4, '0')}`);
  
  const sid = toSessionId('e2e-session');
  const gen = new SyntheticEventGenerator(sid, { clock, idFactory });

  // Baseline: 40 events over 60 days (days -90 to -30) -> Density = 40/60 = 0.66
  for (let i = 0; i < 40; i++) {
    const timestamp = NOW - (90 - i * 1.5) * MS_PER_DAY;
    const evt = gen.gapDetected('intentionality', 0.9);
    (evt as any).timestamp = toTimestamp(timestamp); // Override time for historical
    bus.publish(evt.type, evt);
    await new Promise(r => setTimeout(r, 0));
  }

  // Recent: 5 events over the last 15 days -> Density = 5/15 = 0.33
  // This is a ~50% drop, which exceeds the 0.25 threshold for improvement!
  for (let i = 0; i < 5; i++) {
    const timestamp = NOW - (15 - i * 3) * MS_PER_DAY;
    const evt = gen.gapDetected('intentionality', 0.9);
    (evt as any).timestamp = toTimestamp(timestamp);
    bus.publish(evt.type, evt);
    await new Promise(r => setTimeout(r, 0));
  }

  // 5. Trigger the pipeline via session.ended
  // The InsightScheduler listens to session.ended to run the pipeline!
  const endEvt = gen.sessionEnded('explicit');
  (endEvt as any).timestamp = toTimestamp(NOW);
  bus.publish(endEvt.type, endEvt);

  // Yield to allow async pipeline to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  // 6. Assertions
  assert(generatedInsights.length > 0, 'InsightEngine published at least one insight in response to data spike');
  
  const promptingInsight = generatedInsights.find(i => i.domain === 'Prompting');
  assert(!!promptingInsight, 'PromptingPattern Evaluator successfully generated an insight');
  if (promptingInsight) {
    assert(promptingInsight.title === 'Prompt specificity is improving', 'Insight has correct title for improving trend');
    assert(promptingInsight.confidence > 0, `Confidence score is calculated: ${promptingInsight.confidence}`);
  }

  engine.stop();
  
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Auto-run
if (typeof require !== 'undefined' && require.main === module) {
  runE2EValidation().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
