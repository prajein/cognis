import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type {
    MotorProgressPoint,
    AutomaticityTransition,
} from "../types";

interface MotorProgressChartProps {
    readonly data: readonly MotorProgressPoint[];
    readonly transition?: AutomaticityTransition;
}

export function MotorProgressChart({
    data,
    transition,
}: MotorProgressChartProps) {
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
                height: 300,
            }}
        >
            <ResponsiveContainer
                width="100%"
                height="100%"
            >
                <LineChart
                    data={data}
                    margin={{
                        top: 20,
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
                            value: "Normalized activation",
                            angle: -90,
                            position: "insideLeft",
                        }}
                    />

                    <Tooltip />

                    <Legend />

                    <Line
                        type="monotone"
                        dataKey="m1Activation"
                        name="M1"
                        dot
                    />

                    <Line
                        type="monotone"
                        dataKey="cerebellumActivation"
                        name="Cerebellum"
                        dot
                    />

                    {transition && (
                        <ReferenceLine
                            x={transition.sessionNumber}
                            label={{
                                value:
                                    transition.label,
                                position: "top",
                            }}
                            strokeDasharray="5 5"
                        />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}