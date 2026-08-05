import type { Insight } from "./Insight";
import type { InsightContext } from "./InsightContext";
import type { InsightRule } from "./InsightRule";

export class UniversalInsightEngine {
    constructor(private readonly rules: InsightRule[]) {}

    generate(context: InsightContext): Insight[] {
        return this.rules
        .map((rule) => rule.evaluate(context))
        .filter((insight): insight is Insight => insight !== null);
  }
}