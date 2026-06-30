import { EventBusContract } from '../../core/event-bus/types';

export interface ResponseIntelligenceEngine {
  /** Subscribes to the EventBus to begin observing response streams. */
  start(eventBus: EventBusContract): void;
  
  /** Unsubscribes and cleans up active memory buffers. */
  stop(): void;
}

export interface AnalysisResult {
  readonly score: number; // 0.0 to 1.0
  readonly flags: ReadonlyArray<string>;
  readonly metadata: Record<string, number | string>;
}

export interface ResponseAnalyzer {
  readonly version: string;
  readonly analyzerName: string;
  readonly latencyBudgetMs: number;
  
  /**
   * Pure, deterministic function evaluating a response string.
   */
  analyze(responseText: string, promptHash: string): AnalysisResult;
}
