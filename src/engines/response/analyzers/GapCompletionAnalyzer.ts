import { AnalysisResult, ResponseAnalyzer } from "../interfaces";
import {UNCERTAINTY_MARKERS,LIMITATION_MARKERS,RESPONSE_ANALYSIS_THRESHOLDS,} from "../constants";

export class GapCompletionAnalyzer implements ResponseAnalyzer {
  public readonly version = "1.0.0";

  public readonly analyzerName = "GapCompletionAnalyzer";

  public readonly latencyBudgetMs = 15;

  public analyze(
    responseText: string,
    promptHash: string
  ): AnalysisResult {
    // Reserved for future prompt-aware analysis
    void promptHash;

    const text = responseText.toLowerCase();

    let uncertaintyCount = 0;
    let limitationCount = 0;

    const flags: string[] = [];

    // Count uncertainty markers
    for (const marker of UNCERTAINTY_MARKERS) {
      uncertaintyCount += (
        text.match(new RegExp(`\\b${marker}\\b`, "g")) || []
      ).length;
    }

    // Count limitation markers
    for (const marker of LIMITATION_MARKERS) {
      limitationCount += (
        text.match(new RegExp(marker, "g")) || []
      ).length;
    }

    const totalGapIndicators =
      uncertaintyCount + limitationCount;

    if (
      totalGapIndicators >=
      RESPONSE_ANALYSIS_THRESHOLDS.GAP_THRESHOLD
    ) {
      flags.push("incomplete_response");
    }

    if (limitationCount > 0) {
      flags.push("admits_limitation");
    }

    if (uncertaintyCount > 0) {
      flags.push("contains_uncertainty");
    }

    // Higher uncertainty ⇒ lower completion score
    const score = Math.max(
      0,
      1 -
        totalGapIndicators /
          RESPONSE_ANALYSIS_THRESHOLDS.GAP_THRESHOLD
    );

    return {
      score,
      flags,
      metadata: {
        uncertaintyCount,
        limitationCount,
        totalGapIndicators,
      },
    };
  }
}