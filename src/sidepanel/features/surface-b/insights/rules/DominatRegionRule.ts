import type { Insight } from "../Insight";
import type { InsightContext } from "../InsightContext";
import type { InsightRule } from "../InsightRule";

export class DominantRegionRule implements InsightRule {
  evaluate(context: InsightContext): Insight | null {
    const entries = Object.entries(context.activationProfile.region_profile);

    if (entries.length === 0) {
      return null;
    }

    const [region] = entries.reduce((max, current) =>
      current[1] > max[1] ? current : max
    );

    return {
      id: "dominant-region",
      type: "dominant-region",
      severity: "info",
      title: "Dominant Brain Region",
      description: `Predicted dominant region: ${region}.`,
      timestamp: context.generatedAt,
    };
  }
}