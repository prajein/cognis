import type { Insight } from "../Insight";
import type { InsightContext } from "../InsightContext";
import type { InsightRule } from "../InsightRule";

export class StateQualityRule implements InsightRule {
  evaluate(context: InsightContext): Insight | null {
    if (!context.previousSession) {
      return null;
    }

    const currentQuality = context.currentSession.qualityScore;
    const previousQuality = context.previousSession.qualityScore;

    if (
      typeof currentQuality !== "number" ||
      typeof previousQuality !== "number" ||
      currentQuality <= previousQuality
    ) {
      return null;
    }

    return {
      id: "state-quality",
      type: "state-quality",
      severity: "success",
      title: "Session Quality Improved",
      description:
        "This session showed an improvement compared with your previous session.",
      timestamp: context.generatedAt,
    };
  }
}
