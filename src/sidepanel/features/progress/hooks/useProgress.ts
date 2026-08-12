import { useCallback, useEffect, useState } from "react";
import type { ProgressSession } from "../../../../core/ipc/messages";
import { ProgressQueryGateway } from "../../../runtime/ProgressQueryGateway";
import { ProgressService } from "../services/ProgressService";
import type {
    CognitiveProgress,
    MotorProgress,
    ProgressState,
} from "../types";

import type { CognitiveActivationProfile } from "../models/cognitiveProgress";
import type { MotorActivationProfile } from "../models/motorProgress";

const gateway = new ProgressQueryGateway();
const progressService = new ProgressService();

/**
 * Progress data exposed to Surface B.
 *
 * ProgressState contains the historical session/summary information.
 * The cognitive and motor models are added here because they are
 * derived from that history and are consumed directly by ProgressPanel.
 */
export interface ProgressResult {
    readonly history: ProgressState["history"];
    readonly summary: ProgressState["summary"];

    readonly cognitiveProgress: CognitiveProgress | null;
    readonly motorProgress: MotorProgress | null;
}

interface UseProgressResult {
    readonly progress: ProgressResult | null;
    readonly loading: boolean;
    readonly error: string | null;
    readonly refresh: () => Promise<void>;
}

export function useProgress(
    taskId: string | null,
    profile: CognitiveActivationProfile &
        MotorActivationProfile | null
): UseProgressResult {
    const [progress, setProgress] =
        useState<ProgressResult | null>(null);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    const loadProgress = useCallback(async () => {
        /*
         * No task selected means there is no progress history to load.
         */
        if (!taskId || !profile) {
            setProgress(null);
            setError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            /*
             * Step 1:
             * Retrieve the real completed sessions from the background.
             */
            const sessions: readonly ProgressSession[] =
                await gateway.getProgress(taskId);

            /*
             * Step 2:
             * Build the generic history and summary.
             */
            const state =
                progressService.buildState(sessions);

            /*
             * Step 3:
             * Generate the cognitive curve only for cognitive tasks.
             */
            const cognitiveProgress =
                profile.category === "Cognitive"
                    ? progressService.buildCognitiveProgress(
                          sessions,
                          profile
                      )
                    : null;

            /*
             * Step 4:
             * Generate the motor curve only for motor tasks.
             */
            const motorProgress =
                profile.category === "Motor"
                    ? progressService.buildMotorProgress(
                          sessions,
                          profile
                      )
                    : null;

            /*
             * Step 5:
             * Expose everything Surface B needs.
             */
            setProgress({
                history: state.history,
                summary: state.summary,
                cognitiveProgress,
                motorProgress,
            });
        } catch (err) {
            setProgress(null);

            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load progress."
            );
        } finally {
            setLoading(false);
        }
    }, [taskId, profile]);

    /*
     * Load whenever the selected task/profile changes.
     */
    useEffect(() => {
        void loadProgress();
    }, [loadProgress]);

    return {
        progress,
        loading,
        error,
        refresh: loadProgress,
    };
}