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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="hero-state">
                <h1 className="section-label">Session Review</h1>
                <p className="state-desc" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Your thinking trajectory</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
                    <span>Explore</span>
                    <span>→</span>
                    <span>Stretch</span>
                    <span>→</span>
                    <span>Revise</span>
                    <span>→</span>
                    <span style={{ color: 'var(--text-primary)' }}>Resolve</span>
                </div>
            </div>
            
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
            
            <section>
                <h2 className="section-label">Moments Worth Noticing</h2>
                <div className="timeline-list">
                    {insights.map((insight: any, idx: number) => (
                        <div key={insight.id} className="timeline-item">
                            <span className="timeline-time">0{idx + 1}</span>
                            <span className="timeline-content">{insight.summary}</span>
                        </div>
                    ))}
                </div>
            </section>
            
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
            
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                <div>{insights.length} observations</div>
                <div>1 intervention</div>
            </div>
        </div>
    );
}
