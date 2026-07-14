import type { SessionRecord } from "../types";

interface TaskProfileCardProps {
    session: SessionRecord | null;
}

export function TaskProfileCard({
    session,
}: TaskProfileCardProps) {

    if (!session) {
        return (
            <section>
                <h2>Task Profile</h2>
                <p>No task selected.</p>
            </section>
        );
    }

    return (
        <section>

            <h2>Task Profile</h2>

            <p>
                <strong>Task:</strong> {session.taskId}
            </p>

            <p>
                <strong>Status:</strong> {session.status}
            </p>

            <p>
                <strong>Session:</strong> #{session.sessionNumber}
            </p>

            {session.durationMs !== undefined && (
                <p>
                    <strong>Duration:</strong>{" "}
                    {(session.durationMs / 1000).toFixed(1)} s
                </p>
            )}

        </section>
    );
}