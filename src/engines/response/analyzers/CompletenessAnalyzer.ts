import { ResponseAnalyzer, AnalysisResult } from '../interfaces';

export class CompletenessAnalyzer implements ResponseAnalyzer {
  public readonly version = '1.0.0';
  public readonly analyzerName = 'CompletenessAnalyzer';
  public readonly latencyBudgetMs = 5;

  private readonly conclusionMarkers = [
    'in summary', 'to conclude', 'let me know', 'hope this helps',
    'if you have any questions', 'feel free to ask', 'finally,'
  ];

  public analyze(responseText: string, promptHash: string): AnalysisResult {
    const textTrimmed = responseText.trim();
    if (textTrimmed.length === 0) {
      return { score: 0, flags: ['empty'], metadata: {} };
    }

    // 1. Check for unclosed markdown (common in cutoff responses)
    let hasUnclosedMarkdown = false;
    const backtickCount = (textTrimmed.match(/```/g) || []).length;
    if (backtickCount % 2 !== 0) {
      hasUnclosedMarkdown = true;
    }

    // 2. Check for conclusion markers in the last 200 characters
    const tail = textTrimmed.slice(-200).toLowerCase();
    let hasConclusion = false;
    for (const marker of this.conclusionMarkers) {
      if (tail.includes(marker)) {
        hasConclusion = true;
        break;
      }
    }

    // 3. Derive flags
    const flags: string[] = [];
    if (hasUnclosedMarkdown) flags.push('unclosed_markdown');
    if (hasConclusion) flags.push('has_conclusion');

    // 4. Calculate score
    let score = 0.8; // Assume complete by default unless proven otherwise
    if (hasUnclosedMarkdown) score -= 0.5;
    if (hasConclusion) score += 0.2;

    score = Math.max(0, Math.min(1, score));

    return {
      score,
      flags,
      metadata: {
        terminationState: hasUnclosedMarkdown ? 'abrupt' : 'clean',
        conclusionMarkers: hasConclusion ? 1 : 0
      }
    };
  }
}
