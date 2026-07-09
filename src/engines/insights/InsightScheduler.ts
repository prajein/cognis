import { EventBusContract } from '../../core/event-bus/types';
import { SessionEvents, PromptEvents } from '../../core/event-bus/registry';
import { DomainEvent } from '../../core/event-bus/contracts';
import { ReasoningPipeline } from './pipeline/ReasoningPipeline';

export class InsightScheduler {
  private unsubscribeHandlers: Array<() => void> = [];
  private promptsSinceLastEval = 0;
  private readonly PROMPT_VOLUME_THRESHOLD = 100;

  constructor(
    private readonly eventBus: EventBusContract,
    private readonly pipeline: ReasoningPipeline
  ) {}

  public start(): void {
    // Strategy 1: Session Ended
    this.unsubscribeHandlers.push(
      this.eventBus.subscribe(SessionEvents.ENDED, this.handleSessionEnded.bind(this))
    );

    // Strategy 2: Volume Threshold (e.g. 100 prompts)
    this.unsubscribeHandlers.push(
      this.eventBus.subscribe(PromptEvents.SENT, this.handlePromptSent.bind(this))
    );
  }

  public stop(): void {
    for (const unsubscribe of this.unsubscribeHandlers) {
      unsubscribe();
    }
    this.unsubscribeHandlers = [];
  }

  private async handleSessionEnded(event: DomainEvent<any>): Promise<void> {
    const { sessionId } = event;
    console.log(`[InsightScheduler] Triggering pipeline for session.ended (${sessionId})`);
    
    try {
      await this.pipeline.execute(sessionId);
    } catch (error) {
      console.error(`[InsightScheduler] Pipeline execution failed for session ${sessionId}:`, error);
    }
    
    this.promptsSinceLastEval = 0; // Reset counter after evaluation
  }

  private async handlePromptSent(event: DomainEvent<any>): Promise<void> {
    this.promptsSinceLastEval++;
    
    if (this.promptsSinceLastEval >= this.PROMPT_VOLUME_THRESHOLD) {
      const { sessionId } = event;
      console.log(`[InsightScheduler] Triggering pipeline for volume threshold (${sessionId})`);
      
      try {
        await this.pipeline.execute(sessionId);
      } catch (error) {
        console.error(`[InsightScheduler] Pipeline execution failed for session ${sessionId}:`, error);
      }
      
      this.promptsSinceLastEval = 0;
    }
  }
}
