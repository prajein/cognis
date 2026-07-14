import { useEffect, useState } from "react";
import { SessionState } from "../types";

interface SessionTimerProps {
    currentState: SessionState;
    startedAt?: Date;
}

export function SessionTimer({
    currentState,
    startedAt,
}: SessionTimerProps) {

    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {

        if (
            currentState !== SessionState.SESSION_ACTIVE ||
            !startedAt
        ) {
            return;
        }

        const interval = setInterval(() => {

            setElapsed(
                Date.now() - startedAt.getTime()
            );

        }, 1000);

        return () => clearInterval(interval);

    }, [currentState, startedAt]);

    const seconds = Math.floor(elapsed / 1000);

    return (
        <section>

            <h2>Session Timer</h2>

            <p>{seconds} s</p>

        </section>
    );
}