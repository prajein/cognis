import type { InsightReadModel } from "../../../storage/projections/builders/InsightProjectionBuilder";
import type { SessionRecord } from "../session/types";
import type { ProgressSession } from "../../../core/ipc/messages";
import type { SkillBalanceResult } from "./models/skillBalance";
import type { SkillTransferNote } from "./models/skillTransfer";

export interface ProgressHistory {
    readonly sessions: readonly ProgressSession[];
    readonly sessionCount: number;
}

export interface ProgressSummary {
    readonly sessionCount: number;
    readonly averageQuality: number | null;
    readonly averageReasoning: number | null;
    readonly averageStructure: number | null;
    readonly totalDurationMs: number;
}

export interface ProgressState {
    readonly history: ProgressHistory;
    readonly summary: ProgressSummary;
}

export interface ProgressPanelProps {
    session: SessionRecord | null;
    insights: InsightReadModel | null;

    cognitiveProgress: CognitiveProgress | null;
    motorProgress: MotorProgress | null;

    skillBalance?: SkillBalanceResult | null;
    skillTransfer?: SkillTransferNote | null;

    progressLoading: boolean;
    progressError: string | null;
}

export interface ProgressCardProps {
    readonly title: string;
    readonly value: string;
}

export interface CognitiveProgressPoint {
    readonly sessionNumber: number;
    readonly prefrontalCost: number;
    readonly sessionQuality: number | null;
}

export interface CognitiveProgress {
    readonly points: readonly CognitiveProgressPoint[];
}

export interface MotorProgressPoint {
    readonly sessionNumber: number;
    readonly m1Activation: number;
    readonly cerebellumActivation: number;
}

export interface AutomaticityTransition {
    readonly sessionNumber: number;
    readonly label: "Automaticity Transition";
}

export interface MotorProgress {
    readonly points: readonly MotorProgressPoint[];
    readonly transition?: AutomaticityTransition;
}