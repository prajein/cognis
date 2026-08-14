import {
    SkillBalanceModel,
    type SubclassHours,
} from "./skillBalance";

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

function runSkillBalanceTests(): void {
    const checker = new Checker();
    const model = new SkillBalanceModel();

    console.log("[SkillBalanceModel.selftest] Starting tests...");

    // ---------------------------------------------------------
    // Test 1: Perfectly balanced distribution
    // Writing:
    // Creative = 10h
    // Analytical = 10h
    // Technical = 10h
    // ---------------------------------------------------------

    const balancedWriting: SubclassHours[] = [
        { subclass: "Creative", hours: 10 },
        { subclass: "Analytical", hours: 10 },
        { subclass: "Technical", hours: 10 },
    ];

    const writingResult =
        model.calculate(balancedWriting);

    checker.approximately(
        writingResult.meanHours,
        10,
        0.0001,
        "Balanced writing mean should be 10"
    );

    checker.approximately(
        writingResult.standardDeviation,
        0,
        0.0001,
        "Balanced writing standard deviation should be 0"
    );

    checker.approximately(
        writingResult.coefficientOfVariation,
        0,
        0.0001,
        "Balanced writing CV should be 0"
    );

    checker.eq(
        writingResult.classification,
        "balanced",
        "Balanced writing should be classified as balanced"
    );

    // ---------------------------------------------------------
    // Test 2: Moderately uneven distribution
    // Studying:
    // Memorisation = 10h
    // Conceptual = 8h
    // Exam Practice = 4h
    // ---------------------------------------------------------

    const unevenStudying: SubclassHours[] = [
        { subclass: "Memorisation", hours: 10 },
        { subclass: "Conceptual", hours: 8 },
        { subclass: "Exam Practice", hours: 4 },
    ];

    const studyingResult =
        model.calculate(unevenStudying);

    checker.approximately(
        studyingResult.meanHours,
        22 / 3,
        0.0001,
        "Studying mean should be 22/3"
    );

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
    // Test 3: Strongly concentrated distribution
    // Tennis:
    // Baseline Rallying = 20h
    // Serve Practice = 2h
    // Match Play = 2h
    // ---------------------------------------------------------

    const concentratedTennis: SubclassHours[] = [
        { subclass: "Baseline Rallying", hours: 20 },
        { subclass: "Serve Practice", hours: 2 },
        { subclass: "Match Play", hours: 2 },
    ];

    const tennisResult =
        model.calculate(concentratedTennis);

    checker.approximately(
        tennisResult.meanHours,
        8,
        0.0001,
        "Tennis mean should be 8"
    );

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
    // Test 4: Scale invariance
    // Multiplying every subclass by the same factor must not
    // change the coefficient of variation.
    // ---------------------------------------------------------

    const scaledTennis: SubclassHours[] = [
        { subclass: "Baseline Rallying", hours: 200 },
        { subclass: "Serve Practice", hours: 20 },
        { subclass: "Match Play", hours: 20 },
    ];

    const scaledResult =
        model.calculate(scaledTennis);

    checker.approximately(
        scaledResult.coefficientOfVariation,
        tennisResult.coefficientOfVariation,
        0.0001,
        "CV should be invariant to uniform scaling"
    );

    // ---------------------------------------------------------
    // Test 5: Zero-hour domain
    // ---------------------------------------------------------

    const zeroHours: SubclassHours[] = [
        { subclass: "Creative", hours: 0 },
        { subclass: "Analytical", hours: 0 },
        { subclass: "Technical", hours: 0 },
    ];

    const zeroResult =
        model.calculate(zeroHours);

    checker.eq(
        zeroResult.meanHours,
        0,
        "Zero-hour mean should be 0"
    );

    checker.eq(
        zeroResult.coefficientOfVariation,
        0,
        "Zero-hour CV should be 0"
    );

    checker.eq(
        zeroResult.classification,
        "balanced",
        "Zero-hour domain should not be marked concentrated"
    );

    // ---------------------------------------------------------
    // Test 6: Invalid negative hours
    // ---------------------------------------------------------

    let rejectedNegativeHours = false;

    try {
        model.calculate([
            { subclass: "Creative", hours: -1 },
            { subclass: "Analytical", hours: 2 },
        ]);
    } catch {
        rejectedNegativeHours = true;
    }

    checker.ok(
        rejectedNegativeHours,
        "Negative practice hours should be rejected"
    );

    if (checker.failed > 0) {
        console.error(
            `[SkillBalanceModel.selftest] FAILED: ${checker.failed} failures`
        );

        for (const failure of checker.failures) {
            console.error(`  - ${failure}`);
        }

        process.exit(1);
    }

    console.log(
        `[SkillBalanceModel.selftest] PASSED: ${checker.passed} checks`
    );

    process.exit(0);
}

runSkillBalanceTests();