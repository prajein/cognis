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

import { ResponseMetricsHUD } from "../surface-a/components/ResponseMetricsHUD";
import { useResponseMetrics } from "../surface-a/hooks/useResponseMetrics";

import { getAllActivationProfiles } from "../../../core/config";
import type { TaskOption } from "./types";

import { useSession } from "../session/hooks/useSession";
import { useInsights } from "./hooks/useInsights";
import { SessionState } from "../session/types";

import { ProgressPanel } from "../progress/ProgressPanel";
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
    // -----------------------------------------------------------------------
    // Task selection
    // -----------------------------------------------------------------------

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
    // Response metrics
    // -----------------------------------------------------------------------

    const {
        state: responseState,
        metrics: responseMetrics,
    } = useResponseMetrics();


    // -----------------------------------------------------------------------
    // M11 telemetry export
    // -----------------------------------------------------------------------

    const handleExportM11Telemetry = () => {
        const request = indexedDB.open("cognis_v1");

        request.onsuccess = (event) => {
            const db =
                (event.target as IDBOpenDBRequest).result;

            const transaction =
                db.transaction(
                    ["events"],
                    "readonly"
                );

            const objectStore =
                transaction.objectStore("events");

            const request =
                objectStore.getAll();

            request.onsuccess = () => {
                const allEvents = request.result;

                const metrics = allEvents.filter(
                    (event) =>
                        event.type ===
                        "ghosttext.measurement.computed"
                );

                const blob = new Blob(
                    [
                        JSON.stringify(
                            metrics,
                            null,
                            2
                        ),
                    ],
                    {
                        type: "application/json",
                    }
                );

                const url =
                    URL.createObjectURL(blob);

                const anchor =
                    document.createElement("a");

                anchor.href = url;

                anchor.download =
                    `cognis_m11_telemetry_${Date.now()}.json`;

                anchor.click();

                URL.revokeObjectURL(url);
            };
        };

        request.onerror = () => {
            console.error(
                "Failed to export telemetry:"
            );
        };
    };


    // -----------------------------------------------------------------------
    // Week 7 — Progress
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

                <div
                    style={{
                        marginTop: "64px",
                    }}
                >
                    <p
                        className="state-desc"
                        style={{
                            color:
                                "var(--text-primary)",
                        }}
                    >
                        Cognis is temporarily
                        disconnected.
                    </p>

                    <p
                        className="state-desc"
                        style={{
                            marginTop: "8px",
                        }}
                    >
                        Your ChatGPT session is not
                        affected.
                    </p>
                </div>
            </div>
        );
    }


    // -----------------------------------------------------------------------
    // Determine primary session view
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

                <ResponseMetricsHUD
                    state={responseState}
                    metrics={responseMetrics}
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

                {/* Development / M11 telemetry controls */}
                <div
                    style={{
                        display: "flex",
                        gap: "8px",
                        alignSelf: "center",
                        marginTop: "16px",
                    }}
                >
                    <button
                        className="btn-ghost"
                        onClick={
                            handleExportM11Telemetry
                        }
                    >
                        Export M11 Telemetry
                    </button>

                    <button
                        className="btn-ghost"
                        onClick={endSession}
                    >
                        End Session
                    </button>
                </div>
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
            {/* Disclosure / activation information                           */}
            {/* ------------------------------------------------------------- */}

            <DisclosureLabel />


            {/* ------------------------------------------------------------- */}
            {/* Current session state                                          */}
            {/* ------------------------------------------------------------- */}

            {view}


            {/* ------------------------------------------------------------- */}
            {/* Week 7 — Progress                                              */}
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

                skillBalance={
                    progress?.skillBalance ??
                    null
                }

                skillTransfer={
                    progress?.skillTransfer ??
                    null
                }

                progressLoading={
                    progressLoading
                }

                progressError={
                    progressError
                }
                />

        </div>
    );
}