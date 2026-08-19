import React, { useMemo, useState } from "react";
import type { TaskOption } from "../types";

interface TaskPickerProps {
    tasks: TaskOption[];
    selectedTaskId: string | null;
    onTaskSelect: (taskId: string) => void;
}

const CATEGORIES = [
    { id: "all", label: "All Tasks" },
    { id: "ai", label: "AI Co-pilot" },
    { id: "coding", label: "Coding & Tech" },
    { id: "writing", label: "Writing" },
    { id: "studying", label: "Studying & Lang" },
    { id: "arts", label: "Arts & Media" },
    { id: "wellness", label: "Wellness & Physical" },
];

function getCategoryForTask(label: string): string {
    const l = label.toLowerCase();
    if (l.includes("ai co-pilot")) return "ai";
    if (l.includes("coding") || l.includes("maths")) return "coding";
    if (l.includes("writing") || l.includes("deep reading")) return "writing";
    if (l.includes("studying") || l.includes("language")) return "studying";
    if (l.includes("drawing") || l.includes("music") || l.includes("songwriting") || l.includes("filmmaking")) return "arts";
    return "wellness";
}

export function TaskPicker({
    tasks,
    selectedTaskId,
    onTaskSelect,
}: TaskPickerProps) {
    const [selectedCategory, setSelectedCategory] = useState("all");

    const filteredTasks = useMemo(() => {
        if (selectedCategory === "all") return tasks;
        return tasks.filter((t) => getCategoryForTask(t.label) === selectedCategory);
    }, [tasks, selectedCategory]);

    const selectedTask = useMemo(
        () => tasks.find((t) => t.id === selectedTaskId),
        [tasks, selectedTaskId]
    );

    return (
        <div className="task-picker-container">
            <div className="task-picker-header">
                <span className="task-picker-label">Target Practice Task</span>
                {selectedTask && (
                    <span className="task-picker-active-badge">
                        ● {selectedTask.label}
                    </span>
                )}
            </div>

            {/* Category Filter Pills */}
            <div className="task-category-pills">
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        type="button"
                        className={`task-category-pill ${selectedCategory === cat.id ? "active" : ""}`}
                        onClick={() => setSelectedCategory(cat.id)}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Styled Dropdown Selector */}
            <div className="task-select-wrapper">
                <select
                    className="task-select-input"
                    value={selectedTaskId ?? ""}
                    onChange={(e) => {
                        if (e.target.value) {
                            onTaskSelect(e.target.value);
                        }
                    }}
                >
                    <option value="" disabled>
                        Choose a task profile to observe... ({filteredTasks.length} available)
                    </option>
                    {filteredTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                            {task.label}
                        </option>
                    ))}
                </select>
                <div className="task-select-arrow">▼</div>
            </div>

            {/* Quick Choice Chips for Filtered Tasks (showing max 8) */}
            <div className="task-quick-chips">
                {filteredTasks.slice(0, 8).map((task) => {
                    const isSelected = task.id === selectedTaskId;
                    return (
                        <button
                            key={task.id}
                            type="button"
                            className={`task-chip ${isSelected ? "selected" : ""}`}
                            onClick={() => onTaskSelect(task.id)}
                        >
                            {task.label}
                            {isSelected && " ✓"}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}