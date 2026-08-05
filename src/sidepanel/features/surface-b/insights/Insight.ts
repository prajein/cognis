export type InsightSeverity = "info" | "success" | "warning";

export type InsightType =
  | "state-quality"
  | "dominant-region"
  | "automaticity"
  | "milestone";

export interface Insight {
  id: string;

  type: InsightType;

  severity: InsightSeverity;

  title: string;

  description: string;

  timestamp: Date;

  confidence?: number;
}