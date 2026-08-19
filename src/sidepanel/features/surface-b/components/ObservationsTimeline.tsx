import { InsightReadModel } from "../../../../storage/projections/builders/InsightProjectionBuilder";

interface ObservationsTimelineProps {
    insightsModel: InsightReadModel | null;
}

export function ObservationsTimeline({ insightsModel }: ObservationsTimelineProps) {
    if (!insightsModel || insightsModel.insights.length === 0) {
        return null;
    }

    // Sort newest first
    const sortedInsights = [...insightsModel.insights].sort((a, b) => b.generatedAt - a.generatedAt);

    return (
        <section>
            <h2 className="section-heading">What I noticed</h2>
            <div className="timeline-list">
                {sortedInsights.map(insight => {
                    const time = new Date(insight.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    return (
                        <div key={insight.id} className="timeline-item">
                            <span className="timeline-time">{time}</span>
                            <span className="timeline-content">{insight.summary}</span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
