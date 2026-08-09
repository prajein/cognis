import { ResponseAnalyzer, AnalysisResult } from '../interfaces';
import { StructureAnalyzer } from './StructureAnalyzer';
import { ReasoningAnalyzer } from './ReasoningAnalyzer';
import { CompletenessAnalyzer } from './CompletenessAnalyzer';
import { AssumptionAnalyzer } from "./AssumptionAnalyzer";
import { GapCompletionAnalyzer } from "./GapCompletionAnalyzer";

export class QualityAnalyzer implements ResponseAnalyzer {
  public readonly version = '1.0.0';
  public readonly analyzerName = 'QualityAnalyzer';
  public readonly latencyBudgetMs = 30; // Composite budget

  constructor(
    private readonly structureAnalyzer: StructureAnalyzer,
    private readonly reasoningAnalyzer: ReasoningAnalyzer,
    private readonly completenessAnalyzer: CompletenessAnalyzer,
    private readonly assumptionAnalyzer: AssumptionAnalyzer,
    private readonly gapCompletionAnalyzer: GapCompletionAnalyzer
  ) {}



  public analyze(responseText: string, promptHash: string): AnalysisResult {
    // A real quality analyzer would likely compose the results of the other analyzers.
    // For efficiency, the orchestrator/pipeline usually runs them all. 
    // Here we can assume the pipeline already ran them and we just aggregate, 
    // OR we can run them ourselves if this is standalone. 
    // To keep it pure and deterministic per contract, we'll run them.
    
    const structureResult = this.structureAnalyzer.analyze(responseText, promptHash);
    const reasoningResult = this.reasoningAnalyzer.analyze(responseText, promptHash);
    const completenessResult = this.completenessAnalyzer.analyze(responseText, promptHash);
    const assumptionResult =this.assumptionAnalyzer.analyze(responseText,promptHash);
    const gapResult= this.gapCompletionAnalyzer.analyze(responseText, promptHash);


    // 1. Calculate composite score
    // Weighting: Completeness (20%), Reasoning (25%), Structure (25%), Assumption(15%), Gap(15%)
    let score =(structureResult.score * 0.20) +
               (reasoningResult.score * 0.25) +
               (completenessResult.score * 0.25) +
              (assumptionResult.score * 0.15) +
              (gapResult.score * 0.15);

    score = Math.max(0, Math.min(1, score));

    // 2. Aggregate flags
    const flags: string[] = [
      ...structureResult.flags,
      ...reasoningResult.flags,
      ...completenessResult.flags,
      ...assumptionResult.flags,
      ...gapResult.flags,
    ];

    return {
      score,
      flags,
      metadata: {
        structureScore: structureResult.score,
        reasoningScore: reasoningResult.score,
        completenessScore: completenessResult.score,
        assumptionScore: assumptionResult.score,
        gapCompletionScore: gapResult.score,
      }
    };
  }
}
