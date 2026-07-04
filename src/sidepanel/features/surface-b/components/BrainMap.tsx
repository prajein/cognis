import type { ActivationProfile } from "../../../../core/types";

interface BrainMapProps {

    profile?: ActivationProfile;

}

export function BrainMap({

    profile,

}: BrainMapProps) {

    if (!profile) {

        return (

            <section>

                Select a task.

            </section>

        );

    }

    return (

        <section>

            <h2>{profile.display_name}</h2>

            <ul>

                {Object.entries(profile.region_profile).map(

                    ([region, value]) => (

                        <li key={region}>

                            {region}: {value}

                        </li>

                    )

                )}

            </ul>

        </section>

    );

}