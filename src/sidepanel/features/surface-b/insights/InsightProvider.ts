import { UniversalInsightEngine } from "./UniversalInsightEngine";
import type { InsightContext } from "./InsightContext";
import type { Insight } from "./Insight";

export class InsightProvider {
  constructor(private readonly engine: UniversalInsightEngine) {}

  generate(context: InsightContext): Insight[] {
    return this.engine.generate(context);
  }
}