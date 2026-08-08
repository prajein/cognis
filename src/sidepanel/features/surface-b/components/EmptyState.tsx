interface EmptyStateProps {
    startSession: () => void;
}

export function EmptyState({ startSession }: EmptyStateProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginTop: '64px' }}>
            <div className="hero-state">
                <h1 className="state-name">Ready when you are.</h1>
                <p className="state-desc">Start a session to let Cognis observe your interaction with AI.</p>
            </div>
            
            <button className="btn-ghost" onClick={startSession} style={{ alignSelf: 'flex-start', padding: '8px 16px', border: '1px solid var(--border-color)' }}>
                Start Session
            </button>
        </div>
    );
}
