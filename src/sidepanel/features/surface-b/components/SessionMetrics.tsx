import { SessionRecord } from "../../session/types";

interface SessionMetricsProps {
    session: SessionRecord | null;
}

export function SessionMetrics({ session }: SessionMetricsProps) {
    if (!session) {
        return null;
    }

    const timeString = session.startedAt 
        ? new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '--:--';

    // Mock values for derived metrics for now
    const focusValue = 85;
    const revisionValue = 30;

    return (
        <section className="session-metrics">
            <div className="task-picker-header">
                <h2 className="section-heading" style={{ marginBottom: 0 }}>Session</h2>
                <span className="micro-label">{timeString}</span>
            </div>

            <div className="metric-row">
                <span>Focus</span>
                <div className="metric-bar-container">
                    <div className="metric-bar-fill" style={{ width: `${focusValue}%` }} />
                </div>
            </div>
            
            <div className="metric-row">
                <span>Revision</span>
                <div className="metric-bar-container">
                    <div className="metric-bar-fill" style={{ width: `${revisionValue}%` }} />
                </div>
            </div>
        </section>
    );
}
