// surface-b/SurfaceB.tsx


import { useState, useMemo } from "react";
import { TaskPicker } from "./components/TaskPicker";
import { BrainMap } from "./components/BrainMap";
import { DisclosureLabel } from "./components/DisclosureLabel";
import { getAllActivationProfiles } from "../../../core/config";
import type {TaskOption} from "./types";

// Load profiles once outside the component since they are static config
const profiles = getAllActivationProfiles();

export function SurfaceB() {
  console.log("SurfaceB rendered");
  const [selectedTaskId, setSelectedTaskId] = useState(
    profiles[0]?.task_id ?? null
  );

  
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
  

  return (
        <main>

            <TaskPicker
                tasks={taskOptions}
                selectedTaskId={selectedTaskId}
                onTaskSelect={(id) => setSelectedTaskId}
            />

            <BrainMap
                profile={selectedProfile}
            />

            <DisclosureLabel />

        </main>
    );
}