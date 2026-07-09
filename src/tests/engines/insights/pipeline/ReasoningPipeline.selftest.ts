import { ReasoningPipeline } from '../../../../engines/insights/pipeline/ReasoningPipeline';
import { EventBus } from '../../../../core/event-bus/EventBus';
import { ConsoleErrorReporter } from '../../../../core/error/ConsoleErrorReporter';
import { InsightStrategy, ReasoningContext } from '../../../../engines/insights/interfaces';
import { InsightCandidate } from '../../../../core/types/insight.types';
import { ReasoningContextBuilder } from '../../../../engines/insights/pipeline/ReasoningContextBuilder';
import { ReadModelRepository } from '../../../../storage/repositories/ReadModelRepository';
import { CognisDatabase } from '../../../../storage/indexeddb/CognisDatabase';

class MockStrategy implements InsightStrategy {
  version = '1.0.0';
  strategyName = 'MockStrategy';
  taxonomyDomains = ['Learning'] as const;

  execute(context: ReasoningContext): InsightCandidate[] {
    return [
      {
        id: crypto.randomUUID(),
        domain: 'Learning',
        title: 'Test Insight',
        summary: 'Generated from MockStrategy',
        confidence: 0.9,
        evidenceCount: 1,
        metadata: {}
      }
    ];
  }
}

export async function runReasoningPipelineTests(): Promise<void> {
  console.log('[SelfTest] Running ReasoningPipeline tests...');

  const eventBus = new EventBus(new ConsoleErrorReporter());
  const repo = new ReadModelRepository(new CognisDatabase([]));
  repo.get = async () => undefined;
  
  const builder = new ReasoningContextBuilder(repo);
  const pipeline = new ReasoningPipeline(eventBus, builder, [new MockStrategy()]);

  let publishedCount = 0;
  eventBus.subscribe('insight.generated', () => {
    publishedCount++;
  });

  await pipeline.execute('test-session');

  if (publishedCount !== 1) {
    throw new Error(`Expected 1 insight published, got ${publishedCount}`);
  }

  console.log('[SelfTest] ReasoningPipeline synchronous strategies execution validated.');
}
