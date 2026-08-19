// surface-b/components/TabNav.tsx

export type SurfaceBTab = "task" | "session" | "progress";

interface TabNavProps {
    active: SurfaceBTab;
    onChange: (tab: SurfaceBTab) => void;
}

const TABS: { id: SurfaceBTab; label: string }[] = [
    { id: "task", label: "Task" },
    { id: "session", label: "Session" },
    { id: "progress", label: "Progress" },
];

export function TabNav({ active, onChange }: TabNavProps) {
    return (
        <nav className="tab-nav">
            {TABS.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    className={`tab-nav-item ${active === tab.id ? "active" : ""}`}
                    onClick={() => onChange(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </nav>
    );
}
