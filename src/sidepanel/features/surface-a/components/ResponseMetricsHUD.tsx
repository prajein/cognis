import type { ResponseAnalysisCompletedPayload } from '../../../../core/event-bus/contracts';
import { ResponseAnalysisState } from '../hooks/useResponseMetrics';

interface ResponseMetricsHUDProps {
    state: ResponseAnalysisState;
    metrics: ResponseAnalysisCompletedPayload | null;
}

export function ResponseMetricsHUD({ state, metrics }: ResponseMetricsHUDProps) {
    if (state === ResponseAnalysisState.NO_ANALYSIS || !metrics) {
        return null;
    }

    const isStale = state === ResponseAnalysisState.STALE;

    // Helper to safely convert a 0.0-1.0 score to a percentage string.
    const toPercent = (score: number | undefined | null) => {
        if (typeof score !== 'number' || isNaN(score)) return '0%';
        // Clamp to 0-1
        const clamped = Math.max(0, Math.min(1, score));
        return `${Math.round(clamped * 100)}%`;
    };

    const formatFlags = (flags?: readonly string[]) => {
        if (!flags || flags.length === 0) return 'None';
        return flags.join(', ');
    };

    return (
        <section 
            className={`session-metrics ${isStale ? 'metrics-stale' : ''}`} 
            style={{ 
                marginTop: '16px', 
                borderTop: '1px solid var(--border-color)', 
                paddingTop: '16px',
            }}
        >
            <h2 className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span>Response Analysis</span>
                {isStale && (
                    <span style={{ 
                        fontSize: '10px', 
                        color: 'var(--bg-panel)',
                        backgroundColor: 'var(--text-primary)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600
                    }}>
                        Analyzing new response...
                    </span>
                )}
            </h2>
            
            <div style={{ opacity: isStale ? 0.6 : 1, transition: 'opacity 0.2s ease-in-out' }}>
                <div className="metric-row">
                    <span>Quality Score</span>
                    <div className="metric-bar-container">
                        <div className="metric-bar-fill" style={{ width: toPercent(metrics.qualityScore) }} />
                    </div>
                </div>

            <div className="metric-row">
                <span>Structure Score</span>
                <div className="metric-bar-container">
                    <div className="metric-bar-fill" style={{ width: toPercent(metrics.structuralScore) }} />
                </div>
            </div>

            <div className="metric-row">
                <span>Reasoning Score</span>
                <div className="metric-bar-container">
                    <div className="metric-bar-fill" style={{ width: toPercent(metrics.reasoningScore) }} />
                </div>
            </div>

            <div className="metric-row">
                <span>Completeness Score</span>
                <div className="metric-bar-container">
                    <div className="metric-bar-fill" style={{ width: toPercent(metrics.completenessScore) }} />
                </div>
            </div>

            <div className="metric-row">
                <span>Assumption Score</span>
                <div className="metric-bar-container">
                    <div className="metric-bar-fill" style={{ width: toPercent(metrics.assumptionScore) }} />
                </div>
            </div>

            <div className="metric-row">
                <span>Gap Completion</span>
                <div className="metric-bar-container">
                    <div className="metric-bar-fill" style={{ width: toPercent(metrics.gapCompletionScore) }} />
                </div>
            </div>

            <div className="metric-row" style={{ marginTop: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Flags: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{formatFlags(metrics.flags)}</span></span>
            </div>
            </div>
        </section>
    );
}
