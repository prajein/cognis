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

    switch (currentState) {

        case SessionState.TASK_SELECTED:
            return (
                <button onClick={startSession}>
                    Start Session
                </button>
            );

        case SessionState.SESSION_ACTIVE:
            return (
                <button onClick={endSession}>
                    End Session
                </button>
            );

        default:
            return null;
    }
}