import type { Insight } from "../Insight";
import type { InsightContext } from "../InsightContext";
import type { InsightRule } from "../InsightRule";

export class AutomaticityRule implements InsightRule {
  evaluate(context: InsightContext): Insight | null {
    const sessionCount = context.sessionCount;

    if (sessionCount == null) {
      return null;
    }

    if (sessionCount < 5) {
      return null;
    }

    return {
      id: "automaticity",
      type: "automaticity",
      severity: "info",
      title: "Automaticity Progress",
      description:
        "Repeated practice suggests progress toward automaticity for this task.",
      timestamp: context.generatedAt,
    };
  }
}