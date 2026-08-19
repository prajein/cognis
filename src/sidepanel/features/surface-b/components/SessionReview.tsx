import { SessionRecord } from "../../session/types";
import { InsightReadModel } from "../../../../storage/projections/builders/InsightProjectionBuilder";

interface SessionReviewProps {
    session: SessionRecord | null;
    insightsModel: InsightReadModel | null;
}

export function SessionReview({ session, insightsModel }: SessionReviewProps) {
    if (!session) return null;

    const insights = insightsModel?.insights || [];
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
            <div className="hero-state">
                <span className="micro-label">Session Review</span>
                <div className="state-name" style={{ fontSize: '2rem', marginTop: '0.4rem' }}>Your thinking trajectory</div>
                <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--dim)', fontSize: '12px', marginTop: '0.6rem' }}>
                    <span>Explore</span>
                    <span>→</span>
                    <span>Stretch</span>
                    <span>→</span>
                    <span>Revise</span>
                    <span>→</span>
                    <span style={{ color: 'var(--fg)' }}>Resolve</span>
                </div>
            </div>

            <section>
                <h2 className="section-heading">Moments worth noticing</h2>
                <div className="timeline-list">
                    {insights.map((insight: any, idx: number) => (
                        <div key={insight.id} className="timeline-item">
                            <span className="timeline-time">0{idx + 1}</span>
                            <span className="timeline-content">{insight.summary}</span>
                        </div>
                    ))}
                </div>
            </section>

            <div className="micro-label" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <span>{insights.length} observations</span>
                <span>1 intervention</span>
            </div>
        </div>
    );
}
