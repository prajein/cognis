import type { ActivationProfile, SkillDomain } from "../../../../core/types";
import type { ProgressSession } from "../../../../core/ipc/messages";
import type { SubclassHours } from "./skillBalance";

export class SkillBalanceAggregation {
    public buildSubclassHours(
        skillDomain: SkillDomain,
        profiles: readonly ActivationProfile[],
        sessions: readonly ProgressSession[]
    ): readonly SubclassHours[] {
        const domainProfiles = profiles.filter(
            profile =>
                profile.skill_domain === skillDomain &&
                profile.subclass !== null
        );

        if (domainProfiles.length === 0) {
            throw new Error(
                `[SkillBalanceAggregation] No multi-subclass profiles found for skill domain "${skillDomain}".`
            );
        }

        const hoursBySubclass = new Map<string, number>();

        for (const profile of domainProfiles) {
            hoursBySubclass.set(profile.subclass!, 0);
        }

        const taskToSubclass = new Map<string, string>();

        for (const profile of domainProfiles) {
            taskToSubclass.set(
                profile.task_id,
                profile.subclass!
            );
        }

        for (const session of sessions) {
            if (!session.taskId || session.durationMs === undefined) {
                continue;
            }

            const subclass = taskToSubclass.get(session.taskId);

            if (!subclass) {
                continue;
            }

            if (
                !Number.isFinite(session.durationMs) ||
                session.durationMs < 0
            ) {
                continue;
            }

            const currentHours =
                hoursBySubclass.get(subclass) ?? 0;

            hoursBySubclass.set(
                subclass,
                currentHours + session.durationMs / 3_600_000
            );
        }

        return Array.from(
            hoursBySubclass,
            ([subclass, hours]) => ({
                subclass,
                hours,
            })
        );
    }
}
