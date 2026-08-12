import type { ProgressCardProps } from "./types";

export function ProgressCard({
    title,
    value,
}: ProgressCardProps) {
    return (
        <div
            style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
            }}
        >
            <h4>{title}</h4>
            <p>{value}</p>
        </div>
    );
}