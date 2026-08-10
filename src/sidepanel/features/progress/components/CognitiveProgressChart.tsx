import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type { CognitiveProgressPoint } from "../types";

interface CognitiveProgressChartProps {
    readonly data: readonly CognitiveProgressPoint[];
}

export function CognitiveProgressChart({
    data,
}: CognitiveProgressChartProps) {
    if (data.length === 0) {
        return (
            <div
                style={{
                    padding: "16px",
                    textAlign: "center",
                    color: "#666",
                }}
            >
                No completed sessions yet.
            </div>
        );
    }

    return (
        <div
            style={{
                width: "100%",
                height: 280,
            }}
        >
            <ResponsiveContainer
                width="100%"
                height="100%"
            >
                <LineChart
                    data={data}
                    margin={{
                        top: 10,
                        right: 20,
                        left: 0,
                        bottom: 10,
                    }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                    />

                    <XAxis
                        dataKey="sessionNumber"
                        label={{
                            value: "Sessions",
                            position: "insideBottom",
                            offset: -5,
                        }}
                    />

                    <YAxis
                        domain={[0, 1]}
                        label={{
                            value: "Normalized value",
                            angle: -90,
                            position: "insideLeft",
                        }}
                    />

                    <Tooltip />

                    <Legend />

                    <Line
                        type="monotone"
                        dataKey="prefrontalCost"
                        name="Modeled Prefrontal Cost"
                        dot
                    />

                    <Line
                        type="monotone"
                        dataKey="sessionQuality"
                        name="Session Quality"
                        dot
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}