import type { Insight } from "./Insight";
import type { InsightContext } from "./InsightContext";

export interface InsightRule {
  evaluate(context: InsightContext): Insight | null;
}