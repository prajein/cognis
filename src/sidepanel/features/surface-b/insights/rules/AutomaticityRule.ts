import type { Insight } from "../Insight";
import type { InsightContext } from "../InsightContext";
import type { InsightRule } from "../InsightRule";

export class AutomaticityRule implements InsightRule {
  evaluate(context: InsightContext): Insight | null {
    // [PLACEHOLDER] Automaticity inference is currently in research phase.
    // The V1 AutomaticityEvaluator has been deferred. 
    // This rule is intentionally returning null so that the UI does not 
    // render fake intelligence based on simple session counts.
    return null;
  }
}