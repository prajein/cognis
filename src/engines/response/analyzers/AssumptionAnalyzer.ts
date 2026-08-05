import { AnalysisResult, ResponseAnalyzer } from "../interfaces";
import {ASSUMPTION_MARKERS,RESPONSE_ANALYSIS_THRESHOLDS, RESPONSE_FLAGS} from "../constants";

export class AssumptionAnalyzer implements ResponseAnalyzer {
  public readonly version = "1.0.0";

  public readonly analyzerName = "AssumptionAnalyzer";

  public readonly latencyBudgetMs = 15;

  public analyze(
    responseText: string,
    promptHash: string
  ): AnalysisResult {
    // Required by interface, reserved for future use
    void promptHash;

    const text = responseText.toLowerCase();

    let assumptionCount = 0;

    const flags: string[] = [];

    for (const marker of ASSUMPTION_MARKERS) {
      assumptionCount += (
        text.match(new RegExp(`\\b${marker}\\b`, "g")) || []
      ).length;
    }

    if (
      assumptionCount >
      RESPONSE_ANALYSIS_THRESHOLDS.ASSUMPTION_HEAVY
    ) {
      flags.push(RESPONSE_FLAGS.ASSUMPTION_HEAVY);
    }

    if (assumptionCount === 0) {
      flags.push("explicit_reasoning");
    }

    const score = Math.min(
      assumptionCount /
        RESPONSE_ANALYSIS_THRESHOLDS.ASSUMPTION_HEAVY,
      1
    );

    return {
      score,
      flags,
      metadata: {
        assumptionCount,
      },
    };
  }
}