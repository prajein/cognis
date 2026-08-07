// surface-b/SurfaceB.tsx


import { useState, useMemo } from "react";
import { TaskPicker } from "./components/TaskPicker";
import { BrainMap } from "./components/BrainMap";
import { DisclosureLabel } from "./components/DisclosureLabel";
import { getAllActivationProfiles } from "../../../core/config";
import type {TaskOption} from "./types";
import { useSession } from "../session/hooks/useSession";
import { SessionControls } from "../session/components/SessionControls";
import { SessionTimer } from "../session/components/SessionTimer";
import { TaskProfileCard } from "../session/components/TaskProfileCard";
import { useInsights } from "./hooks/useInsights";
import { SessionState } from "../session/types";
import { ProgressPanel } from "../progress";


// Load profiles once outside the component since they are static config
const profiles = getAllActivationProfiles();

export function SurfaceB() {
  
  const [selectedTaskId, setSelectedTaskId] =
    useState<string | null>(null);

  
  const taskOptions: TaskOption[] = useMemo(
        () =>
            profiles.map(profile => ({
                id: profile.task_id,
                label: profile.display_name,
            })),
        []
    );

  const {
        currentState,
        currentSession,
        selectTask,
        startSession,
        endSession,
        connectionStatus,
    } = useSession();

  const activeTaskId = currentSession?.taskId ?? selectedTaskId;

  const selectedProfile = useMemo(
        () =>
            profiles.find(
                profile => profile.task_id === activeTaskId
            ),
        [activeTaskId]
    );

    const { runtimeState } = useSidepanelRuntime();
    const { insights } = useInsights(currentSession?.id !== 'pending' ? currentSession?.id : undefined);

    if (connectionStatus !== 'connected') {
        return (
            <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '240px', color: '#666', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <div>
                    {connectionStatus === 'reconnecting'
                        ? 'Reconnecting to Cognis service...'
                        : 'Disconnected from Cognis background service.'}
                </div>
            </main>
        );
    }

  return (
        <main>

            <TaskPicker
                tasks={taskOptions}
                selectedTaskId={selectedTaskId}
                onTaskSelect={(id) => {
                        setSelectedTaskId(id);
                        selectTask(id);
                }}
            />

            <BrainMap
                profile={selectedProfile}
                isStreaming={runtimeState.isStreaming}
            />

            <DisclosureLabel />

            <TaskProfileCard
                session={currentSession}
            />

            <SessionTimer
                currentState={currentState}
                startedAt={currentSession?.startedAt}
            />

            <SessionControls
                currentState={currentState}
                startSession={startSession}
                endSession={endSession}
            />

            <ProgressPanel
                session={currentSession}
                insights={insights}
            />

            {insights.map((insight) => (
                <div key={insight.id}>
                <h4>{insight.title}</h4>
                <p>{insight.description}</p>
                </div>
                ))}

        </main>
        
    );
}