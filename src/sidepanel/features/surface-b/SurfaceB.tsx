// surface-b/SurfaceB.tsx

import { useState } from "react";
import { useSession } from "../session/hooks/useSession";
import { useInsights } from "./hooks/useInsights";
import { SessionState } from "../session/types";
import { ProgressPanel } from "../progress";

import { useSidepanelRuntime } from "../../runtime/RuntimeContext";

// New UI Components
import { Header } from "./components/Header";
import { EmptyState } from "./components/EmptyState";
import { CurrentState } from "./components/CurrentState";
import { CognitiveTopology } from "./components/CognitiveTopology";
import { ObservationsTimeline } from "./components/ObservationsTimeline";
import { SessionMetrics } from "./components/SessionMetrics";
import { SessionReview } from "./components/SessionReview";
import { ResponseMetricsHUD } from "../surface-a/components/ResponseMetricsHUD";
import { useResponseMetrics } from "../surface-a/hooks/useResponseMetrics";

export function SurfaceB() {
  const {
        currentState,
        currentSession,
        startSession,
        endSession,
        connectionStatus,
    } = useSession();

    const handleExportM11Telemetry = () => {
        const request = indexedDB.open('cognis_v1');
        request.onsuccess = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            const transaction = db.transaction(['events'], 'readonly');
            const objectStore = transaction.objectStore('events');
            const req = objectStore.getAll();
            req.onsuccess = () => {
                const allEvents = req.result;
                const metrics = allEvents.filter(ev => ev.type === 'ghosttext.measurement.computed');
                const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `cognis_m11_telemetry_${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
            };
        };
        request.onerror = (e) => {
            console.error('Failed to export telemetry:', e);
        };
    };

    const { runtimeState } = useSidepanelRuntime();
    const { insights } = useInsights(currentSession?.id !== 'pending' ? currentSession?.id : undefined);
    const { state: responseState, metrics: responseMetrics } = useResponseMetrics();

    const isStreaming = runtimeState.isStreaming;

    // Handle completely disconnected error state
    if (connectionStatus !== 'connected' && connectionStatus !== 'reconnecting') {
        return (
            <div className="surface-container">
                <Header connectionStatus={connectionStatus} sessionState={currentState} isStreaming={isStreaming} />
                <div style={{ marginTop: '64px' }}>
                    <p className="state-desc" style={{ color: 'var(--text-primary)' }}>Cognis is temporarily disconnected.</p>
                    <p className="state-desc" style={{ marginTop: '8px' }}>Your ChatGPT session is not affected.</p>
                </div>
            </div>
        );
    }

    // Determine the view based on the UI State Machine
    let view;

    if (currentState === SessionState.SESSION_ENDED) {
        view = <SessionReview session={currentSession} insightsModel={insights} />;
    } else if (currentState === SessionState.IDLE || currentState === SessionState.TASK_SELECTED) {
        // Technically TASK_SELECTED is when they picked a task but haven't started. 
        // We simplified the flow to just "Start Session".
        view = <EmptyState startSession={startSession} />;
    } else {
        // OBSERVING / LIVE STATE
        view = (
            <>
                <CurrentState sessionState={currentState} isStreaming={isStreaming} />
                <ResponseMetricsHUD state={responseState} metrics={responseMetrics} />
                <CognitiveTopology isStreaming={isStreaming} isActive={currentState === SessionState.SESSION_ACTIVE} />
                <ObservationsTimeline insightsModel={insights} />
                <SessionMetrics session={currentSession} />
                
                {/* Temporary manual end session button for development flow */}
                <div style={{ display: 'flex', gap: '8px', alignSelf: 'center', marginTop: '16px' }}>
                    <button className="btn-ghost" onClick={handleExportM11Telemetry}>
                        Export M11 Telemetry
                    </button>
                    <button className="btn-ghost" onClick={endSession}>
                        End Session
                    </button>
                </div>
            </>
        );
    }

    return (
        <div className="surface-container">
            <Header connectionStatus={connectionStatus} sessionState={currentState} isStreaming={isStreaming} />
            {view}
        </div>
    );
}