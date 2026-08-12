import type { ProgressSession } from "../../../../core/ipc/messages";
import type { ProgressHistory, ProgressState, ProgressSummary,} from "../types";
import { type CognitiveActivationProfile, CognitiveProgressModel } from "../models/cognitiveProgress";
import { MotorProgressModel, type MotorActivationProfile } from "../models/motorProgress";

export class ProgressService {
    private readonly cognitiveProgressModel = new CognitiveProgressModel();

    private readonly motorProgressModel = new MotorProgressModel();
    public buildHistory(
        sessions: readonly ProgressSession[]
    ): ProgressHistory {
        const orderedSessions = [...sessions].sort(
            (a, b) => a.startTime - b.startTime
        );

        return {
            sessions: orderedSessions,
            sessionCount: orderedSessions.length,
        };
    }

    public buildSummary(
        history: ProgressHistory
    ): ProgressSummary {
        const { sessions } = history;

        if (sessions.length === 0) {
            return {
                sessionCount: 0,
                averageQuality: null,
                averageReasoning: null,
                averageStructure: null,
                totalDurationMs: 0,
            };
        }

        const qualityValues = sessions
            .map(session => session.responseMetrics.averageQuality)
            .filter(
                (value): value is number =>
                    value !== null
            );

        const reasoningValues = sessions
            .map(session => session.responseMetrics.averageReasoning)
            .filter(
                (value): value is number =>
                    value !== null
            );

        const structureValues = sessions
            .map(session => session.responseMetrics.averageStructure)
            .filter(
                (value): value is number =>
                    value !== null
            );

        return {
            sessionCount: sessions.length,

            averageQuality:
                this.average(qualityValues),

            averageReasoning:
                this.average(reasoningValues),

            averageStructure:
                this.average(structureValues),

            totalDurationMs: sessions.reduce(
                (total, session) =>
                    total + (session.durationMs ?? 0),
                0
            ),
        };
    }

    public buildState(
        sessions: readonly ProgressSession[]
    ): ProgressState {
        const history = this.buildHistory(sessions);

        return {
            history,
            summary: this.buildSummary(history),
        };
    }

    private average(values: readonly number[]): number | null {
        if (values.length === 0) {
            return null;
        }

        return (
            values.reduce(
                (sum, value) => sum + value,
                0
            ) / values.length
        );
    }

    public buildCognitiveProgress(
        sessions: readonly ProgressSession[],
        profile: CognitiveActivationProfile
        ) {
        return this.cognitiveProgressModel.generate(
            sessions,
            profile
        );
    }

    public buildMotorProgress(
        sessions: readonly ProgressSession[],
        profile: MotorActivationProfile
        ) {
        return this.motorProgressModel.generate(
            sessions,
            profile
        );
    }

    public buildProgress(
        sessions: readonly ProgressSession[],
        cognitiveProfile: CognitiveActivationProfile,
        motorProfile?: MotorActivationProfile
        ) {
        const history = this.buildHistory(sessions);

        const summary = this.buildSummary(history);

        const cognitiveProgress =
            this.buildCognitiveProgress(
            sessions,
            cognitiveProfile
        );

        const motorProgress =
            motorProfile
                ? this.buildMotorProgress(
                  sessions,
                  motorProfile
              )
            : null;

        return {
            history,
            summary,
            cognitiveProgress,
            motorProgress,
        };
    }
    
}