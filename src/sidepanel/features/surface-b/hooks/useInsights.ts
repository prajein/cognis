import { useMemo } from "react";

import type { Insight } from "../insights/Insight";
import type { InsightContext } from "../insights/InsightContext";
import { SessionState } from "../../session";
import { InsightProvider } from "../insights/InsightProvider";
import { UniversalInsightEngine } from "../insights/UniversalInsightEngine";

import { StateQualityRule } from "../insights/rules/StateQualityRule";
import { DominantRegionRule } from "../insights/rules/DominatRegionRule";
import { AutomaticityRule } from "../insights/rules/AutomaticityRule";
import { MilestoneRule } from "../insights/rules/MilestoneRule";

export function useInsights() {
  const provider = useMemo(() => {
    const engine = new UniversalInsightEngine([
      new StateQualityRule(),
      new DominantRegionRule(),
      new AutomaticityRule(),
      new MilestoneRule(),
    ]);

    return new InsightProvider(engine);
  }, []);

  const generateInsights = (context: InsightContext): Insight[] => {
    return provider.generate(context);
  };

  return {
    generateInsights,
  };
}