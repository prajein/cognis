import type { SessionRecord } from "../../session";
import type { ActivationProfile } from "../../../../core/types";

export interface InsightContext {

    currentSession: SessionRecord;

    previousSession?: SessionRecord;

    sessionHistory?: SessionRecord[];

    activationProfile: ActivationProfile;

    sessionCount?: number;

    generatedAt: Date;
}