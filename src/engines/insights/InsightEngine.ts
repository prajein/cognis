import { EventBusContract } from '../../core/event-bus/types';
import { IInsightEngine } from './interfaces';
import { ReasoningPipeline } from './pipeline/ReasoningPipeline';
import { InsightScheduler } from './InsightScheduler';
import { V1AutomaticityEvaluator } from './strategies/V1AutomaticityEvaluator';

import { ReadModelRepository } from '../../storage/repositories/ReadModelRepository';
import { ReasoningContextBuilder } from './pipeline/ReasoningContextBuilder';

export class InsightEngine implements IInsightEngine {
  private eventBus: EventBusContract | null = null;
  private scheduler: InsightScheduler | null = null;

  public start(eventBus: EventBusContract, readModelRepo: ReadModelRepository): void {
    if (this.eventBus) return; // Already started
    
    this.eventBus = eventBus;

    // Initialize Strategies
    const strategies = [
      new V1AutomaticityEvaluator()
    ];

    // Initialize Context Builder
    const contextBuilder = new ReasoningContextBuilder(readModelRepo);

    // Initialize Pipeline
    const pipeline = new ReasoningPipeline(eventBus, contextBuilder, strategies);

    // Initialize and Start Scheduler
    this.scheduler = new InsightScheduler(eventBus, pipeline);
    this.scheduler.start();
    
    console.log('[InsightEngine] Started.');
  }

  public stop(): void {
    if (this.scheduler) {
      this.scheduler.stop();
      this.scheduler = null;
    }
    this.eventBus = null;
    
    console.log('[InsightEngine] Stopped.');
  }
}
