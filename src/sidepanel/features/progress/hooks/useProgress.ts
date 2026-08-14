import { useCallback, useEffect, useState } from "react";

import type { ProgressSession } from "../../../../core/ipc/messages";

import {
    getAllActivationProfiles,
} from "../../../../core/config/activation-profile-loader";

import { ProgressQueryGateway } from "../../../runtime/ProgressQueryGateway";
import { ProgressService } from "../services/ProgressService";

import type {
    CognitiveProgress,
    MotorProgress,
    ProgressState,
} from "../types";

import type { ActivationProfile } from "../../../../core/types";

import {
    SkillBalanceModel,
} from "../models/skillBalance";

import {
    SkillBalanceAggregation,
} from "../models/skillBalanceAggregation";

import {
    SKILL_TRANSFER_RELATIONSHIPS,
    buildSkillTransferNote,
} from "../models/skillTransfer";

import type {
    SkillBalanceResult,
} from "../models/skillBalance";

import type {
    SkillTransferNote,
} from "../models/skillTransfer";

const gateway = new ProgressQueryGateway();
const progressService = new ProgressService();

const skillBalanceModel = new SkillBalanceModel();
const skillBalanceAggregation =
    new SkillBalanceAggregation();

/**
 * Progress data exposed to Surface B.
 *
 * ProgressState contains the historical session/summary information.
 * Cognitive and motor progress are derived from that history.
 *
 * Skill balance is calculated across all subclasses belonging to
 * the selected skill domain.
 *
 * Transfer notes are declarative, non-guaranteed predictions.
 */
export interface ProgressResult {
    readonly history: ProgressState["history"];
    readonly summary: ProgressState["summary"];

    readonly cognitiveProgress: CognitiveProgress | null;
    readonly motorProgress: MotorProgress | null;

    readonly skillBalance: SkillBalanceResult | null;
    readonly skillTransfer: SkillTransferNote | null;
}

interface UseProgressResult {
    readonly progress: ProgressResult | null;
    readonly loading: boolean;
    readonly error: string | null;
    readonly refresh: () => Promise<void>;
}

export function useProgress(
    taskId: string | null,
     profile: ActivationProfile | null
): UseProgressResult {
    const [progress, setProgress] =
        useState<ProgressResult | null>(null);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    const loadProgress = useCallback(async () => {
        /*
         * No task selected means there is no progress
         * history or skill analysis to load.
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
             * ---------------------------------------------------------
             * Step 1:
             * Retrieve completed sessions for the currently selected
             * task.
             *
             * These sessions remain the authoritative history for the
             * selected task.
             * ---------------------------------------------------------
             */
            const sessions: readonly ProgressSession[] =
                await gateway.getProgress(taskId);

            /*
             * ---------------------------------------------------------
             * Step 2:
             * Build the generic history and summary.
             * ---------------------------------------------------------
             */
            const state =
                progressService.buildState(sessions);

            /*
             * ---------------------------------------------------------
             * Step 3:
             * Generate the cognitive curve only for cognitive tasks.
             * ---------------------------------------------------------
             */
            const cognitiveProgress =
                profile.category === "Cognitive"
                    ? progressService.buildCognitiveProgress(
                          sessions,
                          profile
                      )
                    : null;

            /*
             * ---------------------------------------------------------
             * Step 4:
             * Generate the motor curve only for motor tasks.
             *
             * Preserve the existing behavior here.
             * ---------------------------------------------------------
             */
            const motorProgress =
                profile.category === "Sport and Movement"
                ? progressService.buildMotorProgress(
                    sessions,
                    profile
                )
                : null;

            /*
             * ---------------------------------------------------------
             * Step 5:
             * Load every activation profile belonging to the same
             * skill domain as the selected task.
             *
             * Example:
             *
             * tennis
             * ├── Baseline Rallying
             * ├── Serve Practice
             * └── Match Play
             * ---------------------------------------------------------
             */
            const allProfiles =
                getAllActivationProfiles();

            const domainProfiles =
                allProfiles.filter(
                    candidate =>
                        candidate.skill_domain ===
                            profile.skill_domain &&
                        candidate.subclass !== null
                );

            /*
             * ---------------------------------------------------------
             * Step 6:
             * Retrieve historical sessions for every subclass task.
             *
             * The existing gateway intentionally queries one task at
             * a time, so we compose those queries here rather than
             * changing the IPC contract.
             * ---------------------------------------------------------
             */
            const subclassSessions =
                await Promise.all(
                    domainProfiles.map(
                        candidate =>
                            gateway.getProgress(
                                candidate.task_id
                            )
                    )
                );

            /*
             * Flatten the per-task histories into one skill-domain
             * session collection.
             */
            const allSkillSessions =
                subclassSessions.flat();

            /*
             * ---------------------------------------------------------
             * Step 7:
             * Aggregate duration into hours for each subclass.
             *
             * Unpracticed subclasses remain represented with 0 hours.
             * ---------------------------------------------------------
             */
            const subclassHours =
                skillBalanceAggregation.buildSubclassHours(
                    profile.skill_domain,
                    allProfiles,
                    allSkillSessions
                );

            /*
             * ---------------------------------------------------------
             * Step 8:
             * Calculate coefficient of variation and classify the
             * skill-domain practice distribution.
             * ---------------------------------------------------------
             */
            const skillBalance =
                skillBalanceModel.calculate(
                    subclassHours
                );

            /*
             * ---------------------------------------------------------
             * Step 9:
             * Find a declared cross-subclass transfer relationship
             * for this skill domain.
             *
             * Transfer relationships are intentionally expressed as
             * "may-support" rather than causal guarantees.
             * ---------------------------------------------------------
             */
            const transferRelationship =
                SKILL_TRANSFER_RELATIONSHIPS.find(
                    relationship =>
                        relationship.skillDomain ===
                        profile.skill_domain
                );

            const skillTransfer =
                transferRelationship
                    ? buildSkillTransferNote(
                          transferRelationship
                      )
                    : null;

            /*
             * ---------------------------------------------------------
             * Step 10:
             * Expose the complete progress result to Surface B.
             * ---------------------------------------------------------
             */
            setProgress({
                history: state.history,
                summary: state.summary,

                cognitiveProgress,
                motorProgress,

                skillBalance,
                skillTransfer,
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