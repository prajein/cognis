import type { ProgressSession } from "../../../../core/ipc/messages";
import type {
    CognitiveProgress,
} from "../types";

/**
 * Minimal activation-profile contract required by the cognitive model.
 *
 * The actual Cognis activation profile contains a larger region_profile
 * object. The progress model only depends on the two prefrontal regions
 * relevant to this curve.
 */
export interface CognitiveActivationProfile {
    readonly region_profile: {
        readonly DLPFC: number;
        readonly mPFC: number;
    };
}

/**
 * Generates chart-ready cognitive progress data.
 *
 * Important:
 * - DLPFC/mPFC values are research-derived baselines.
 * - They are NOT measured neurological activity.
 * - Session quality comes from actual response-analysis data.
 * - Personalisation is intentionally not inferred before the
 *   session-5 boundary defined by the activation-profile specification.
 */
export class CognitiveProgressModel {
    private readonly maxReduction = 0.45;
    private readonly learningRate = 0.55;

    /**
     * Session at which the activation-profile specification allows
     * personalisation to begin.
     */
    private readonly personalizationStartSession = 5;

    public generate(
        sessions: readonly ProgressSession[],
        profile: CognitiveActivationProfile
    ): CognitiveProgress {
        const baseline =
            this.getPrefrontalBaseline(profile);

        const points = sessions.map((session) => ({
            sessionNumber: session.sessionNumber,

            prefrontalCost:
                this.calculatePrefrontalCost(
                    baseline,
                    session.sessionNumber,
                    session.responseMetrics.averageQuality
                ),

            sessionQuality:
                session.responseMetrics.averageQuality,
        }));

        return {
            points,
        };
    }

    /**
     * Normalises DLPFC + mPFC from the activation-profile's 0-4
     * regional scale into a [0, 1] modeled prefrontal-demand baseline.
     */
    private getPrefrontalBaseline(
        profile: CognitiveActivationProfile
    ): number {
        const dlpfc =
            this.normaliseRegionValue(
                profile.region_profile.DLPFC
            );

        const mpfc =
            this.normaliseRegionValue(
                profile.region_profile.mPFC
            );

        return (dlpfc + mpfc) / 2;
    }

    /**
     * Converts the activation profile's 0-4 scale into [0, 1].
     */
    private normaliseRegionValue(
        value: number
    ): number {
        return Math.min(
            1,
            Math.max(0, value / 4)
        );
    }

    private calculatePrefrontalCost(
        baseline: number,
        sessionNumber: number,
        quality: number | null
    ): number {
        /*
         * The first session establishes the research-derived baseline.
         */
        if (sessionNumber <= 1) {
            return baseline;
        }

        /*
         * Without an observed quality score we do not have enough
         * evidence to claim that reduced cognitive effort represents
         * successful automaticity.
         */
        if (quality === null) {
            return baseline;
        }

        /*
         * A quality score below 0.5 is treated conservatively:
         * reduced effort is not credited as automaticity.
         */
        if (quality < 0.5) {
            return baseline;
        }

        /*
         * Diminishing-return learning curve.
         *
         * This models decreasing modeled cognitive demand with
         * repeated successful practice rather than a linear decline.
         */
        const practiceProgress =
            1 -
            Math.exp(
                -this.learningRate *
                    (sessionNumber - 1)
            );

        /*
         * Quality acts as evidence that the reduction in modeled
         * cognitive demand is associated with maintained performance.
         */
        const qualityConfidence =
            0.5 + 0.5 * quality;

        const reduction =
            this.maxReduction *
            practiceProgress *
            qualityConfidence;

        /*
         * Do not apply the modeled reduction beyond the configured
         * baseline. Personalisation from session 5 onward is a
         * separate extension point and is not invented here.
         */
        return Math.max(
            0,
            baseline * (1 - reduction)
        );
    }

    /**
     * Exposes the specification boundary so the eventual
     * session-5+ personalisation logic has one explicit location.
     */
    public shouldPersonalize(
        sessionNumber: number
    ): boolean {
        return (
            sessionNumber >=
            this.personalizationStartSession
        );
    }
}