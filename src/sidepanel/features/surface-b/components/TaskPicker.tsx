import type { TaskOption } from "../types";

import type { Dispatch, SetStateAction } from "react";

interface TaskPickerProps {
    tasks: TaskOption[];
    selectedTaskId: string | null;
    onTaskSelect: Dispatch<SetStateAction<string | null>>;
}

export function TaskPicker({

    tasks,
    selectedTaskId,
    onTaskSelect,

}: TaskPickerProps) {

    return (

        <section>

            <h2>Select Task</h2>

            {tasks.map(task => {

                const isSelected =
                    task.id === selectedTaskId;

                return (

                    <button

                        key={task.id}

                        onClick={() => onTaskSelect(task.id)}

                    >

                        {task.label}

                        {isSelected && " ✓"}

                    </button>

                );

            })}

        </section>

    );

}