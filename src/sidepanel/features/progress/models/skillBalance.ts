/**
 * Skill balance model
 *
 * Calculates how evenly practice hours are distributed across
 * the subclasses of a skill domain.
 *
 * Balance is measured using the coefficient of variation (CV):
 *
 *     CV = standard deviation / mean
 *
 * CV = 0 represents perfectly balanced practice.
 * CV > 0.5 represents concentrated practice.
 *
 * This is a software-mode estimate derived from logged practice
 * duration; it is not a hardware measurement.
 */

export type SkillBalanceClassification =
    | "balanced"
    | "concentrated";

export interface SubclassHours {
    readonly subclass: string;
    readonly hours: number;
}

export interface SkillBalanceResult {
    readonly meanHours: number;
    readonly standardDeviation: number;
    readonly coefficientOfVariation: number;
    readonly classification: SkillBalanceClassification;
}

export class SkillBalanceModel {
    public static readonly CONCENTRATION_THRESHOLD = 0.5;

    public calculate(
        subclasses: readonly SubclassHours[]
    ): SkillBalanceResult {
        if (subclasses.length === 0) {
            throw new Error(
                "[SkillBalanceModel] At least one subclass is required."
            );
        }

        const hours = subclasses.map(({ hours }) => hours);

        if (hours.some((value) => !Number.isFinite(value) || value < 0)) {
            throw new Error(
                "[SkillBalanceModel] Hours must be finite non-negative numbers."
            );
        }

        const meanHours =
            hours.reduce((sum, value) => sum + value, 0) /
            hours.length;

        if (meanHours === 0) {
            return {
                meanHours: 0,
                standardDeviation: 0,
                coefficientOfVariation: 0,
                classification: "balanced",
            };
        }

        const variance =
            hours.reduce(
                (sum, value) =>
                    sum + Math.pow(value - meanHours, 2),
                0
            ) / hours.length;

        const standardDeviation = Math.sqrt(variance);

        const coefficientOfVariation =
            standardDeviation / meanHours;

        return {
            meanHours,
            standardDeviation,
            coefficientOfVariation,
            classification:
                coefficientOfVariation > SkillBalanceModel.CONCENTRATION_THRESHOLD
                    ? "concentrated"
                    : "balanced",
        };
    }
}