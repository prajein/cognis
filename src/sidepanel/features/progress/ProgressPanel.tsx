import { ProgressCard } from "./ProgressCard";
import type { ProgressPanelProps } from "./types";

export function ProgressPanel({
    session,
    insights,
}: ProgressPanelProps) {

    return (

        <section>

            <h3>Progress</h3>

            <ProgressCard
                title="Current Session"
                value={
                    session
                        ? session.status
                        : "No Active Session"
                }
            />

            <ProgressCard
                title="Insights Generated"
                value={String(insights.length)}
            />

            <ProgressCard
                title="Progress Analytics"
                value="Coming Soon"
            />

        </section>

    );

}