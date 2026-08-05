import type { Insight } from "../Insight";
import type { InsightContext } from "../InsightContext";
import type { InsightRule } from "../InsightRule";

const MILESTONES = [5, 10, 25, 50, 100];

export class MilestoneRule implements InsightRule {
  evaluate(context: InsightContext): Insight | null {
    const sessionCount = context.sessionCount;

    if (sessionCount == null) {
        return null;
    }

    if (!MILESTONES.includes(sessionCount)) {
      return null;
    }

    return {
      id: `milestone-${context.sessionCount}`,
      type: "milestone",
      severity: "success",
      title: "Milestone Reached",
      description: `You've completed ${context.sessionCount} sessions for this task.`,
      timestamp: context.generatedAt,
    };
  }
}