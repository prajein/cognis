import type { ProgressSession } from "../../../../core/ipc/messages";
import type {
    MotorProgress,
} from "../types";

export interface MotorActivationProfile {
    readonly category: string;

    readonly region_profile: {
        readonly M1: number;
        readonly Cerebellum: number;
    };
}

/**
 * Generates the chart-ready motor-learning curve.
 *
 * M1 is modeled as decreasing with repeated successful practice.
 * Cerebellar contribution is modeled as increasing.
 *
 * These are activation-profile-derived model values, not measured
 * neurological activity.
 */
export class MotorProgressModel {
    private readonly transferRate = 0.45;

    public generate(
        sessions: readonly ProgressSession[],
        profile: MotorActivationProfile
    ): MotorProgress {
        const baselineM1 =
            this.normalise(profile.region_profile.M1);

        const baselineCerebellum =
            this.normalise(
                profile.region_profile.Cerebellum
            );

        const points = sessions.map((session) => {
            const quality =
                session.responseMetrics.averageQuality;

            const transfer =
                this.calculateTransfer(
                    session.sessionNumber,
                    quality
                );

            return {
                sessionNumber:
                    session.sessionNumber,

                m1Activation:
                    this.interpolate(
                        baselineM1,
                        0,
                        transfer
                    ),

                cerebellumActivation:
                    this.interpolate(
                        baselineCerebellum,
                        1,
                        transfer
                    ),
            };
        });

        return {
            points,
            transition:
                this.findAutomaticityTransition(points),
        };
    }

    private normalise(value: number): number {
        return Math.min(
            1,
            Math.max(0, value / 4)
        );
    }

    private calculateTransfer(
        sessionNumber: number,
        quality: number | null
    ): number {
        if (sessionNumber <= 1 || quality === null) {
            return 0;
        }

        if (quality < 0.5) {
            return 0;
        }

        const practiceProgress =
            1 -
            Math.exp(
                -this.transferRate *
                    (sessionNumber - 1)
            );

        const qualityConfidence =
            0.5 + 0.5 * quality;

        return Math.min(
            1,
            practiceProgress *
                qualityConfidence
        );
    }

    private interpolate(
        start: number,
        end: number,
        progress: number
    ): number {
        return (
            start +
            (end - start) * progress
        );
    }

    private findAutomaticityTransition(
        points: readonly {
            sessionNumber: number;
            m1Activation: number;
            cerebellumActivation: number;
        }[]
    ) {
        for (const point of points) {
            if (
                point.cerebellumActivation >=
                point.m1Activation
            ) {
                return {
                    sessionNumber:
                        point.sessionNumber,
                    label:
                        "Automaticity Transition" as const,
                };
            }
        }

        return undefined;
    }
}