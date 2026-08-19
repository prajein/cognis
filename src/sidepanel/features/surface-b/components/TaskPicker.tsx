import { useMemo, useState } from "react";
import type { TaskOption } from "../types";

interface TaskPickerProps {
    tasks: TaskOption[];
    selectedTaskId: string | null;
    onTaskSelect: (taskId: string) => void;
}

const CATEGORIES = [
    { id: "all", label: "All" },
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
                <h2 className="section-heading" style={{ marginBottom: 0 }}>
                    What are you practicing?
                </h2>
                {selectedTask && (
                    <span className="task-picker-active-badge">
                        ● {selectedTask.label}
                    </span>
                )}
            </div>

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

            <div className="task-quick-chips">
                {filteredTasks.map((task) => {
                    const isSelected = task.id === selectedTaskId;
                    return (
                        <button
                            key={task.id}
                            type="button"
                            className={`task-chip ${isSelected ? "selected" : ""}`}
                            onClick={() => onTaskSelect(task.id)}
                        >
                            {task.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
