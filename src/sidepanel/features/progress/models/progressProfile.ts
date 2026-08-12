export interface ProgressActivationProfile {
    readonly category: string;

    readonly region_profile: {
        readonly DLPFC: number;
        readonly mPFC: number;
        readonly M1: number;
        readonly Cerebellum: number;
    };
}