import {
    SKILL_TRANSFER_RELATIONSHIPS,
    buildSkillTransferNote,
} from "./skillTransfer";

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
}

function runSkillTransferTests(): void {
    console.log("[SkillTransfer.selftest] Starting tests...");

    const checker = new Checker();

    // The Week 8 validation relationship.
    const tennisTransfer =
        SKILL_TRANSFER_RELATIONSHIPS.find(
            relationship =>
                relationship.skillDomain === "tennis" &&
                relationship.sourceSubclass === "Serve Practice" &&
                relationship.targetSubclass === "Match Play"
        );

    checker.ok(
        tennisTransfer !== undefined,
        "Tennis Serve Practice → Match Play relationship should exist"
    );

    if (tennisTransfer) {
        checker.eq(
            tennisTransfer.relationship,
            "may-support",
            "Transfer relationship must be non-guaranteed"
        );

        const note =
            buildSkillTransferNote(tennisTransfer);

        checker.ok(
            note.description.includes("may support"),
            "Transfer note must use non-guaranteed language"
        );

        checker.ok(
            !note.description.includes("will"),
            "Transfer note must not use guaranteed language"
        );

        checker.ok(
            !note.description.includes("causes"),
            "Transfer note must not claim causality"
        );
    }

    if (checker.failed > 0) {
        console.error(
            `[SkillTransfer.selftest] FAILED: ${checker.failed} failures`
        );

        for (const failure of checker.failures) {
            console.error(`  - ${failure}`);
        }

        process.exit(1);
    }

    console.log(
        `[SkillTransfer.selftest] PASSED: ${checker.passed} checks`
    );

    process.exit(0);
}

runSkillTransferTests();