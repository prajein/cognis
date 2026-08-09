import { EventBusContract } from '../../../core/event-bus/types';
import { ResponseEvents } from '../../../core/event-bus/registry';
import { ResponseAnalysisCompletedPayload } from '../../../core/event-bus/contracts';
import { ResponseAnalyzer } from '../interfaces';
import { StructureAnalyzer } from '../analyzers/StructureAnalyzer';
import { ReasoningAnalyzer } from '../analyzers/ReasoningAnalyzer';
import { CompletenessAnalyzer } from '../analyzers/CompletenessAnalyzer';
import { QualityAnalyzer } from '../analyzers/QualityAnalyzer';
import { AssumptionAnalyzer } from "../analyzers/AssumptionAnalyzer";
import { GapCompletionAnalyzer } from "../analyzers/GapCompletionAnalyzer";

import { EventId, SessionId, Timestamp } from '../../../core/types/session.types';

export class AnalysisPipeline {
  private readonly analyzers: ResponseAnalyzer[];
  private readonly qualityAnalyzer: QualityAnalyzer;

  constructor(private readonly eventBus: EventBusContract) {
    // Initialize deterministic analyzers
    const structure = new StructureAnalyzer();
    const reasoning = new ReasoningAnalyzer();
    const completeness = new CompletenessAnalyzer();
    const assumption = new AssumptionAnalyzer();
    const gapCompletion = new GapCompletionAnalyzer();
    
    this.qualityAnalyzer = new QualityAnalyzer(structure, reasoning, completeness, assumption, gapCompletion);
    
    // We only need the quality analyzer because it internally calls the others and aggregates.
    // However, if we wanted to run them in parallel, we could loop through them.
    // For this design, the QualityAnalyzer acts as the aggregator.
    this.analyzers = [this.qualityAnalyzer];
  }

  public execute(sessionId: string, promptHash: string, fullText: string): void {
    // The pipeline executes synchronously to ensure it stays within the lifecycle bounds.
    // In a real system, we'd ensure `fullText` never leaves this scope.
    
    // Run the master quality analyzer (which runs the sub-analyzers)
    const result = this.qualityAnalyzer.analyze(fullText, promptHash);

    // Emit the resulting metrics to the EventBus
    const payload: ResponseAnalysisCompletedPayload = {
      promptHash,
      structuralScore: Number(result.metadata.structureScore) || 0,
      reasoningScore: Number(result.metadata.reasoningScore) || 0,
      completenessScore: Number(result.metadata.completenessScore) || 0, 
      assumptionScore: Number(result.metadata.assumptionScore) || 0,
      gapCompletionScore: Number(result.metadata.gapCompletionScore) || 0,
      qualityScore: result.score,
      flags: result.flags
    };

    this.eventBus.publish(ResponseEvents.ANALYSIS_COMPLETED, {
      id: crypto.randomUUID() as EventId,
      type: ResponseEvents.ANALYSIS_COMPLETED,
      timestamp: Date.now() as Timestamp,
      sessionId: sessionId as SessionId,
      source: 'ResponseIntelligenceEngine',
      payload
    });
  }
}
