// surface-b/SurfaceB.tsx

import { useMemo, useState } from "react";

import { TaskPicker } from "./components/TaskPicker";
import { BrainMap } from "./components/BrainMap";
import { DisclosureLabel } from "./components/DisclosureLabel";
import { Header } from "./components/Header";
import { EmptyState } from "./components/EmptyState";
import { CurrentState } from "./components/CurrentState";
import { CognitiveTopology } from "./components/CognitiveTopology";
import { ObservationsTimeline } from "./components/ObservationsTimeline";
import { SessionMetrics } from "./components/SessionMetrics";
import { SessionReview } from "./components/SessionReview";

import { getAllActivationProfiles } from "../../../core/config";
import type { TaskOption } from "./types";

import { useSession } from "../session/hooks/useSession";
import { useInsights } from "./hooks/useInsights";
import { SessionState } from "../session/types";

import { ProgressPanel } from "../progress";
import { useProgress } from "../progress/hooks/useProgress";

import { useSidepanelRuntime } from "../../runtime/RuntimeContext";


// ---------------------------------------------------------------------------
// Static activation profile configuration
// ---------------------------------------------------------------------------

const profiles = getAllActivationProfiles();


// ---------------------------------------------------------------------------
// Surface B
// ---------------------------------------------------------------------------

export function SurfaceB() {
    const [selectedTaskId, setSelectedTaskId] =
        useState<string | null>(null);

    const taskOptions: TaskOption[] = useMemo(
        () =>
            profiles.map((profile) => ({
                id: profile.task_id,
                label: profile.display_name,
            })),
        []
    );

    const selectedProfile = useMemo(
        () =>
            profiles.find(
                (profile) =>
                    profile.task_id === selectedTaskId
            ),
        [selectedTaskId]
    );

    // -----------------------------------------------------------------------
    // Session state
    // -----------------------------------------------------------------------

    const {
        currentState,
        currentSession,
        selectTask,
        startSession,
        endSession,
        connectionStatus,
    } = useSession();


    // -----------------------------------------------------------------------
    // Runtime state
    // -----------------------------------------------------------------------

    const { runtimeState } = useSidepanelRuntime();

    const isStreaming = runtimeState.isStreaming;


    // -----------------------------------------------------------------------
    // Insights
    // -----------------------------------------------------------------------

    const { insights } = useInsights(
        currentSession?.id !== "pending"
            ? currentSession?.id
            : undefined
    );


    // -----------------------------------------------------------------------
    // Progress
    // -----------------------------------------------------------------------

    const {
        progress,
        loading: progressLoading,
        error: progressError,
    } = useProgress(
        selectedTaskId,
        selectedProfile ?? null
    );


    // -----------------------------------------------------------------------
    // Connection state
    // -----------------------------------------------------------------------

    if (
        connectionStatus !== "connected" &&
        connectionStatus !== "reconnecting"
    ) {
        return (
            <div className="surface-container">
                <Header
                    connectionStatus={connectionStatus}
                    sessionState={currentState}
                    isStreaming={isStreaming}
                />

                <div style={{ marginTop: "64px" }}>
                    <p
                        className="state-desc"
                        style={{
                            color: "var(--text-primary)",
                        }}
                    >
                        Cognis is temporarily disconnected.
                    </p>

                    <p
                        className="state-desc"
                        style={{
                            marginTop: "8px",
                        }}
                    >
                        Your ChatGPT session is not affected.
                    </p>
                </div>
            </div>
        );
    }


    // -----------------------------------------------------------------------
    // Determine the primary session view
    // -----------------------------------------------------------------------

    let view;

    if (
        currentState ===
        SessionState.SESSION_ENDED
    ) {
        view = (
            <SessionReview
                session={currentSession}
                insightsModel={insights}
            />
        );
    } else if (
        currentState === SessionState.IDLE ||
        currentState === SessionState.TASK_SELECTED
    ) {
        // TASK_SELECTED means a task has been selected
        // but the session has not started yet.
        view = (
            <EmptyState
                startSession={startSession}
            />
        );
    } else {
        // OBSERVING / LIVE STATE
        view = (
            <>
                <CurrentState
                    sessionState={currentState}
                    isStreaming={isStreaming}
                />

                <CognitiveTopology
                    isStreaming={isStreaming}
                    isActive={
                        currentState ===
                        SessionState.SESSION_ACTIVE
                    }
                />

                <ObservationsTimeline
                    insightsModel={insights}
                />

                <SessionMetrics
                    session={currentSession}
                />

                {/* Temporary manual end-session button for development flow */}
                <button
                    className="btn-ghost"
                    onClick={endSession}
                    style={{
                        alignSelf: "center",
                        marginTop: "16px",
                    }}
                >
                    End Session
                </button>
            </>
        );
    }


    // -----------------------------------------------------------------------
    // Surface B
    // -----------------------------------------------------------------------

    return (
        <div className="surface-container">

            <Header
                connectionStatus={connectionStatus}
                sessionState={currentState}
                isStreaming={isStreaming}
            />

            {/* ------------------------------------------------------------- */}
            {/* Task selection                                                 */}
            {/* ------------------------------------------------------------- */}

            <TaskPicker
                tasks={taskOptions}
                selectedTaskId={selectedTaskId}
                onTaskSelect={(id) => {
                    setSelectedTaskId(id);
                    selectTask(id);
                }}
            />


            {/* ------------------------------------------------------------- */}
            {/* Brain visualization                                            */}
            {/* ------------------------------------------------------------- */}

            <BrainMap
                profile={selectedProfile}
            />


            {/* ------------------------------------------------------------- */}
            {/* Disclosure / research-derived activation information          */}
            {/* ------------------------------------------------------------- */}

            <DisclosureLabel />


            {/* ------------------------------------------------------------- */}
            {/* Current session state / remote UI                             */}
            {/* ------------------------------------------------------------- */}

            {view}


            {/* ------------------------------------------------------------- */}
            {/* Week 7 — Progress                                             */}
            {/* ------------------------------------------------------------- */}

            <ProgressPanel
                session={currentSession}
                insights={insights}
                cognitiveProgress={
                    progress?.cognitiveProgress ??
                    null
                }
                motorProgress={
                    progress?.motorProgress ??
                    null
                }
                progressLoading={progressLoading}
                progressError={progressError}
            />

        </div>
    );
}