import { useRef, useState } from "react";

import { SessionManager } from "../manager/SessionManager";
import { InMemorySessionRepository } from "../repository/InMemorySessionRepository";

export function useSession() {

    const managerRef = useRef(
        new SessionManager(
            new InMemorySessionRepository()
        )
    );

    const [currentState, setCurrentState] = useState(
        managerRef.current.getCurrentState()
    );

    const [currentSession, setCurrentSession] = useState(
        managerRef.current.getCurrentSession()
    );

    const syncState = () => {
        setCurrentState(
            managerRef.current.getCurrentState()
        );

        setCurrentSession(
            managerRef.current.getCurrentSession()
        );
    };

    const selectTask = (taskId: string) => {
        managerRef.current.selectTask(taskId);

        syncState();
    };

    const startSession = () => {
        managerRef.current.startSession();

        syncState();
    };

    const endSession = () => {
        managerRef.current.endSession();

        syncState();
    };

    const reset = () => {
        managerRef.current.reset();

        syncState();
    };

    return {
        currentState,

        currentSession,

        selectTask,

        startSession,

        endSession,

        reset,
    };
}