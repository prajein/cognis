import { ResponseAnalyzer, AnalysisResult } from '../interfaces';

export class StructureAnalyzer implements ResponseAnalyzer {
  public readonly version = '1.0.0';
  public readonly analyzerName = 'StructureAnalyzer';
  public readonly latencyBudgetMs = 10; // Fast regex analysis

  public analyze(responseText: string, promptHash: string): AnalysisResult {
    // 1. Calculate length metrics
    const totalChars = responseText.length;
    if (totalChars === 0) {
      return { score: 0, flags: ['empty'], metadata: {} };
    }

    // 2. Count structural elements
    const codeBlocks = (responseText.match(/```/g) || []).length / 2; // Pairs of backticks
    const headers = (responseText.match(/^#{1,6}\s/gm) || []).length;
    const lists = (responseText.match(/^[\s]*[-*+]\s/gm) || []).length;
    const numberedLists = (responseText.match(/^[\s]*\d+\.\s/gm) || []).length;

    // 3. Calculate metrics
    const totalStructuralMarkers = headers + lists + numberedLists;
    const structureDensity = totalChars > 0 ? (totalStructuralMarkers * 20) / totalChars : 0; // Heuristic weighting

    // 4. Derive flags
    const flags: string[] = [];
    if (codeBlocks > 3) flags.push('heavy_code');
    if (codeBlocks === 0) flags.push('no_code');
    if (structureDensity > 0.05) flags.push('highly_structured');
    if (totalStructuralMarkers === 0 && codeBlocks === 0) flags.push('prose_heavy');

    // 5. Calculate final score
    // A structurally complete response typically has a mix of prose and structure.
    let score = 0.5; // Baseline
    if (flags.includes('highly_structured') || codeBlocks > 0) score += 0.2;
    if (flags.includes('prose_heavy') && totalChars > 500) score -= 0.1; // Long walls of text are penalized
    score = Math.max(0, Math.min(1, score));

    return {
      score,
      flags,
      metadata: {
        codeBlockCount: codeBlocks,
        headerCount: headers,
        listCount: lists + numberedLists,
        structureDensity
      }
    };
  }
}
