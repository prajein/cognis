import { SessionState } from "../../session/types";

interface CurrentStateProps {
    sessionState: SessionState;
    isStreaming: boolean;
}

export function CurrentState({ sessionState, isStreaming }: CurrentStateProps) {
    let title = "Stretch";
    let desc = "You're working steadily.";

    if (isStreaming) {
        title = "Analyzing response";
        desc = "Cognis is processing the outcome.";
    } else if (sessionState === SessionState.IDLE || sessionState === SessionState.TASK_SELECTED) {
        title = "Waiting";
        desc = "Cognis is observing.";
    }
    // We can expand this with semantic inference based on real data later, 
    // for now we'll stick to a default working state if active.

    return (
        <section>
            <span className="micro-label">Current State</span>
            <div className="hero-state" style={{ marginTop: "0.6rem" }}>
                <div className="state-name">{title}</div>
                <div className="state-desc">{desc}</div>
            </div>
        </section>
    );
}
