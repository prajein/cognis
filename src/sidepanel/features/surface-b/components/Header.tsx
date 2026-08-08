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

    return (
        <header className="cognis-header">
            <span>COGNIS</span>
            <div className={`status-dot ${dotClass}`} />
        </header>
    );
}
