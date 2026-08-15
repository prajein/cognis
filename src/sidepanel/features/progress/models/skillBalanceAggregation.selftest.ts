import {
    getAllActivationProfiles,
} from "../../../../core/config/activation-profile-loader";
import {
    toSkillDomain,
} from "../../../../core/types";
import type { ProgressSession } from "../../../../core/ipc/messages";

import { SkillBalanceAggregation } from "./skillBalanceAggregation";
import { SkillBalanceModel } from "./skillBalance";

class Checker {
    passed = 0;
    failed = 0;
    readonly failures: string[] = [];

    ok(condition: boolean, label: string): void {
        if (condition) {
            this.passed++;
        } else {
            this.failed++;
            this.failures.push(label);
        }
    }

    eq(actual: unknown, expected: unknown, label: string): void {
        this.ok(
            actual === expected,
            `${label} (expected ${expected}, got ${actual})`
        );
    }

    approximately(
        actual: number,
        expected: number,
        tolerance: number,
        label: string
    ): void {
        this.ok(
            Math.abs(actual - expected) <= tolerance,
            `${label} (expected ${expected}, got ${actual})`
        );
    }
}

const HOUR_MS = 3_600_000;

function session(
    taskId: string,
    hours: number,
    sessionNumber: number
): ProgressSession {
    return {
        sessionNumber,
        sessionId: `selftest-${sessionNumber}`,
        taskId,
        platform: "selftest",
        startTime: sessionNumber,
        durationMs: hours * HOUR_MS,
        responseMetrics: {
            totalResponses: 0,
            averageQuality: null,
            averageReasoning: null,
            averageStructure: null,
        },
    };
}

function runSkillBalanceAggregationTests(): void {
    console.log(
        "[SkillBalanceAggregation.selftest] Starting tests..."
    );

    const checker = new Checker();

    const profiles = getAllActivationProfiles();
    const aggregation = new SkillBalanceAggregation();
    const balanceModel = new SkillBalanceModel();

    // ---------------------------------------------------------
    // Writing
    //
    // Creative      = 10h
    // Analytical    = 10h
    // Technical     = 10h
    //
    // Expected CV = 0
    // ---------------------------------------------------------

    const writingSessions: ProgressSession[] = [
        session("writing_creative", 10, 1),
        session("writing_analytical", 10, 2),
        session("writing_technical", 10, 3),
    ];

    const writingHours =
        aggregation.buildSubclassHours(
            toSkillDomain("writing"),
            profiles,
            writingSessions
        );

    checker.eq(
        writingHours.length,
        3,
        "Writing should contain three subclasses"
    );

    const writingResult =
        balanceModel.calculate(writingHours);

    checker.approximately(
        writingResult.coefficientOfVariation,
        0,
        0.0001,
        "Writing CV should be 0"
    );

    checker.eq(
        writingResult.classification,
        "balanced",
        "Writing should be balanced"
    );

    // ---------------------------------------------------------
    // Studying
    //
    // Memorisation  = 10h
    // Conceptual    = 8h
    // Exam Practice = 4h
    //
    // Expected CV ≈ 0.3402
    // ---------------------------------------------------------

    const studyingSessions: ProgressSession[] = [
        session("studying_memorisation", 10, 4),
        session("studying_conceptual", 8, 5),
        session("studying_exam_practice", 4, 6),
    ];

    const studyingHours =
        aggregation.buildSubclassHours(
            toSkillDomain("studying"),
            profiles,
            studyingSessions
        );

    checker.eq(
        studyingHours.length,
        3,
        "Studying should contain three subclasses"
    );

    const studyingResult =
        balanceModel.calculate(studyingHours);

    checker.approximately(
        studyingResult.coefficientOfVariation,
        0.340168,
        0.0001,
        "Studying CV should be approximately 0.3402"
    );

    checker.eq(
        studyingResult.classification,
        "balanced",
        "Studying should remain below the concentration threshold"
    );

    // ---------------------------------------------------------
    // Tennis
    //
    // Baseline Rallying = 20h
    // Serve Practice    = 2h
    // Match Play        = 2h
    //
    // Expected CV ≈ 1.0607
    // ---------------------------------------------------------

    const tennisSessions: ProgressSession[] = [
        session("tennis_baseline_rallying", 20, 7),
        session("tennis_serve_practice", 2, 8),
        session("tennis_match_play", 2, 9),
    ];

    const tennisHours =
        aggregation.buildSubclassHours(
            toSkillDomain("tennis"),
            profiles,
            tennisSessions
        );

    checker.eq(
        tennisHours.length,
        3,
        "Tennis should contain three subclasses"
    );

    const tennisResult =
        balanceModel.calculate(tennisHours);

    checker.approximately(
        tennisResult.coefficientOfVariation,
        1.06066,
        0.0001,
        "Tennis CV should be approximately 1.0607"
    );

    checker.eq(
        tennisResult.classification,
        "concentrated",
        "Tennis should be classified as concentrated"
    );

    // ---------------------------------------------------------
    // Important integration invariant:
    //
    // A subclass with no sessions must remain present with 0h.
    // ---------------------------------------------------------

    const incompleteTennisSessions: ProgressSession[] = [
        session("tennis_serve_practice", 5, 10),
    ];

    const incompleteTennisHours =
        aggregation.buildSubclassHours(
            toSkillDomain("tennis"),
            profiles,
            incompleteTennisSessions
        );

    checker.eq(
        incompleteTennisHours.length,
        3,
        "All Tennis subclasses should remain represented"
    );

    const matchPlay =
        incompleteTennisHours.find(
            item => item.subclass === "Match Play"
        );

    checker.eq(
        matchPlay?.hours,
        0,
        "Unpracticed Match Play should have 0 hours"
    );

    if (checker.failed > 0) {
        console.error(
            `[SkillBalanceAggregation.selftest] FAILED: ${checker.failed} failures`
        );

        for (const failure of checker.failures) {
            console.error(`  - ${failure}`);
        }

        process.exit(1);
    }

    console.log(
        `[SkillBalanceAggregation.selftest] PASSED: ${checker.passed} checks`
    );

    process.exit(0);
}

runSkillBalanceAggregationTests();