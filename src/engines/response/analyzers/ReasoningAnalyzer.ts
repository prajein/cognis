import { ResponseAnalyzer, AnalysisResult } from '../interfaces';

export class ReasoningAnalyzer implements ResponseAnalyzer {
  public readonly version = '1.0.0';
  public readonly analyzerName = 'ReasoningAnalyzer';
  public readonly latencyBudgetMs = 15;

  private readonly reasoningMarkers = [
    'because', 'therefore', 'however', 'thus', 'firstly', 'secondly', 'finally',
    'consequently', 'furthermore', 'in contrast', 'moreover', 'as a result',
    'this means', 'for instance', 'for example'
  ];

  private readonly branchingMarkers = [
    'if', 'alternatively', 'otherwise', 'unless', 'whether', 'on the other hand'
  ];

  public analyze(responseText: string, promptHash: string): AnalysisResult {
    const textLower = responseText.toLowerCase();
    
    // 1. Calculate chain length
    let chainLength = 0;
    for (const marker of this.reasoningMarkers) {
      chainLength += (textLower.match(new RegExp(`\\b${marker}\\b`, 'g')) || []).length;
    }

    // 2. Calculate branching logic
    let branching = 0;
    for (const marker of this.branchingMarkers) {
      branching += (textLower.match(new RegExp(`\\b${marker}\\b`, 'g')) || []).length;
    }

    // 3. Derive flags
    const flags: string[] = [];
    if (chainLength > 3) flags.push('step_by_step');
    if (branching > 2) flags.push('considers_alternatives');
    if (chainLength === 0 && branching === 0) flags.push('shallow_directive');

    // 4. Calculate score
    // Higher scores for responses that explain 'why' (chain) and 'what if' (branching)
    const baseScore = Math.min((chainLength * 0.1) + (branching * 0.15), 0.8);
    let finalScore = baseScore + 0.2; // Baseline
    
    if (flags.includes('shallow_directive')) {
      finalScore = 0.3; // Low reasoning depth
    }

    finalScore = Math.max(0, Math.min(1, finalScore));

    return {
      score: finalScore,
      flags,
      metadata: {
        chainLength,
        branching
      }
    };
  }
}
