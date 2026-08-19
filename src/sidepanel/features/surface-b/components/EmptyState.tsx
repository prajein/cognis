import React from 'react';

interface EmptyStateProps {
    startSession: () => void;
}

export function EmptyState({ startSession }: EmptyStateProps) {
    return (
        <div className="empty-state-card">
            <div className="empty-state-content">
                <div className="empty-state-badge">
                    <span className="empty-state-dot"></span>
                    Session Observation Idle
                </div>
                <h2 className="empty-state-title">Ready when you are.</h2>
                <p className="empty-state-desc">
                    Start a session to let Cognis observe your prompt formulations, typing cadence, and AI response quality in real time.
                </p>
                
                <div className="empty-state-steps">
                    <div className="empty-step">
                        <span className="step-num">1</span> Select a task above
                    </div>
                    <div className="empty-step">
                        <span className="step-num">2</span> Start observation
                    </div>
                    <div className="empty-step">
                        <span className="step-num">3</span> Open ChatGPT or Claude
                    </div>
                </div>

                <button className="empty-state-btn" onClick={startSession}>
                    <span>▶</span> Start Observation Session
                </button>
            </div>
        </div>
    );
}

