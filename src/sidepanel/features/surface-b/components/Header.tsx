import { useState, useRef, useEffect } from "react";
import { SessionState } from "../../session/types";

interface HeaderProps {
    connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
    sessionState: SessionState;
    isStreaming: boolean;
}

export function Header({ connectionStatus, sessionState, isStreaming }: HeaderProps) {
    let dotClass = 'idle';
    
    if (connectionStatus !== 'connected') {
        dotClass = 'idle';
    } else if (isStreaming) {
        dotClass = 'processing';
    } else if (sessionState === SessionState.SESSION_ACTIVE || sessionState === SessionState.INSIGHT_GENERATED || sessionState === SessionState.PROGRESS_UPDATED) {
        dotClass = 'active';
    }

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
        };

        if (isSettingsOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSettingsOpen]);

    return (
        <header className="cognis-header">
            <span className="cognis-wordmark">Cognis</span>
            <div className="header-controls">
                <div className={`status-dot ${dotClass}`} />
                <button 
                    className="settings-trigger" 
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    aria-label="Settings"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                </button>
                {isSettingsOpen && (
                    <div className="settings-popover" ref={popoverRef}>
                        <div className="settings-popover-title">Mode</div>
                        <div className="settings-option active">
                            <div className="settings-option-name">Full</div>
                        </div>
                        <div className="settings-option disabled">
                            <div className="settings-option-name">Guided</div>
                            <div className="settings-option-badge">Coming soon</div>
                        </div>
                        <div className="settings-option disabled">
                            <div className="settings-option-name">Shadow</div>
                            <div className="settings-option-badge">Coming soon</div>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}
