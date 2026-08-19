import React from 'react';
import type { ProgressCardProps } from "../types";

export function ProgressCard({
    title,
    value,
}: ProgressCardProps) {
    return (
        <div className="telemetry-card">
            <span className="telemetry-card-title">{title}</span>
            <span className="telemetry-card-value">{value}</span>
        </div>
    );
}