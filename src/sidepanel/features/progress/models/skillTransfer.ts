import type { SkillDomain } from "../../../../core/types";

export interface SkillTransferRelationship {
    readonly skillDomain: SkillDomain;
    readonly sourceSubclass: string;
    readonly targetSubclass: string;
    readonly relationship: "may-support";
}

export interface SkillTransferNote {
    readonly relationship: SkillTransferRelationship;
    readonly description: string;
}

export const SKILL_TRANSFER_RELATIONSHIPS: readonly SkillTransferRelationship[] = [
    {
        skillDomain: "tennis" as SkillDomain,
        sourceSubclass: "Serve Practice",
        targetSubclass: "Match Play",
        relationship: "may-support",
    },
];

export function buildSkillTransferNote(
    relationship: SkillTransferRelationship
): SkillTransferNote {
    return {
        relationship,
        description:
            `${relationship.sourceSubclass} may support ` +
            `${relationship.targetSubclass} development.`,
    };
}
