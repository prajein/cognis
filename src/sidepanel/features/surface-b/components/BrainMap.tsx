import type { ActivationProfile } from "../../../../core/types";

interface BrainMapProps {
    profile?: ActivationProfile;
    isStreaming?: boolean;
}

export function BrainMap({
    profile,
    isStreaming
}: BrainMapProps) {
    if (!profile) {
        return (
            <p className="brain-map-empty">
                Select a task above to see its cognitive activation profile.
            </p>
        );
    }

    return (
        <section className={`brain-map ${isStreaming ? "streaming" : ""}`}>
            <h3 className="brain-map-title">{profile.display_name}</h3>

            <div className="brain-map-regions">
                {Object.entries(profile.region_profile).map(
                    ([region, value]) => (
                        <div key={region} className="brain-map-region">
                            <div className="brain-map-region-name">{region}</div>
                            <div className="brain-map-region-bar">
                                <div
                                    className="brain-map-region-fill"
                                    style={{ width: `${(value / 5) * 100}%` }}
                                />
                            </div>
                            <div className="brain-map-region-value">{value}</div>
                        </div>
                    )
                )}
            </div>
        </section>
    );
}
