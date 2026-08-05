import { SessionState } from "../types";

interface SessionControlsProps {
    currentState: SessionState;
    startSession: () => void;
    endSession: () => void;
}

export function SessionControls({
    currentState,
    startSession,
    endSession,
}: SessionControlsProps) {

    console.log('[SessionControls] Rendering with state:', currentState);

    const handleEndSession = () => {
        console.log('[SessionControls] End Session button clicked');
        endSession();
    };

    switch (currentState) {

        case SessionState.TASK_SELECTED:
            return (
                <button onClick={startSession}>
                    Start Session
                </button>
            );

        case SessionState.SESSION_ACTIVE:
            return (
                <button onClick={handleEndSession}>
                    End Session
                </button>
            );

        default:
            return null;
    }
}