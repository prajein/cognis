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

  const selectedProfile = useMemo(
        () =>
            profiles.find(
                profile => profile.task_id === selectedTaskId
            ),
        [selectedTaskId]
    );
  
    const {
        currentState,
        currentSession,
        selectTask,
        startSession,
        endSession,
    } = useSession();
    

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

        </main>
    );
}