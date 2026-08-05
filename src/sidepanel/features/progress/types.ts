import type { Insight } from "../surface-b/insights/Insight";
import type { SessionRecord } from "../session/types";

export interface ProgressPanelProps {
    session: SessionRecord | null;
    insights: Insight[];
}

export interface ProgressCardProps {
    title: string;
    value: string;
}