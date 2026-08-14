import { ProgressCard } from "./components/ProgressCard";
import type { ProgressPanelProps } from "./types";

import { CognitiveProgressChart } from "./components/CognitiveProgressChart";
import { MotorProgressChart } from "./components/MotorProgressChart";

export function ProgressPanel({
    session,
    insights,
    cognitiveProgress,
    motorProgress,
    skillBalance,
    skillTransfer,
    progressLoading,
    progressError,
}: ProgressPanelProps) {
    return (
        <section>
            <h3>Progress</h3>

            {/* ------------------------------------------------------------- */}
            {/* Current session                                                */}
            {/* ------------------------------------------------------------- */}

            <ProgressCard
                title="Current Session"
                value={
                    session
                        ? session.status
                        : "No Active Session"
                }
            />

            {/* ------------------------------------------------------------- */}
            {/* Insights                                                        */}
            {/* ------------------------------------------------------------- */}

            <ProgressCard
                title="Insights Generated"
                value={String(
                    insights?.insights.length ?? 0
                )}
            />

            {/* ------------------------------------------------------------- */}
            {/* Loading                                                        */}
            {/* ------------------------------------------------------------- */}

            {progressLoading && (
                <ProgressCard
                    title="Progress Analytics"
                    value="Loading..."
                />
            )}

            {/* ------------------------------------------------------------- */}
            {/* Error                                                          */}
            {/* ------------------------------------------------------------- */}

            {!progressLoading &&
                progressError && (
                    <ProgressCard
                        title="Progress Analytics"
                        value={progressError}
                    />
                )}

            {/* ------------------------------------------------------------- */}
            {/* No data                                                        */}
            {/* ------------------------------------------------------------- */}

            {!progressLoading &&
                !progressError &&
                !cognitiveProgress &&
                !motorProgress &&
                !skillBalance && (
                    <ProgressCard
                        title="Progress Analytics"
                        value="No completed sessions yet"
                    />
                )}

            {/* ------------------------------------------------------------- */}
            {/* Skill balance                                                  */}
            {/* ------------------------------------------------------------- */}

            {!progressLoading &&
                !progressError &&
                skillBalance && (
                    <section>
                        <h4>
                            Skill Balance
                        </h4>

                        <ProgressCard
                            title="Coefficient of Variation"
                            value={skillBalance.coefficientOfVariation.toFixed(
                                2
                            )}
                        />

                        <ProgressCard
                            title="Practice Distribution"
                            value={
                                skillBalance.classification ===
                                "balanced"
                                    ? "Balanced"
                                    : "Concentrated"
                            }
                        />
                    </section>
                )}

            {/* ------------------------------------------------------------- */}
            {/* Cross-subclass transfer                                        */}
            {/* ------------------------------------------------------------- */}

            {!progressLoading &&
                !progressError &&
                skillTransfer && (
                    <section>
                        <h4>
                            Cross-Subclass Transfer
                        </h4>

                        <ProgressCard
                            title="Prediction"
                            value={
                                skillTransfer.description
                            }
                        />
                    </section>
                )}

            {/* ------------------------------------------------------------- */}
            {/* Cognitive progress                                             */}
            {/* ------------------------------------------------------------- */}

            {!progressLoading &&
                !progressError &&
                cognitiveProgress && (
                    <section>
                        <h4>
                            Are you getting better?
                        </h4>

                        <ProgressCard
                            title="Cognitive Sessions"
                            value={String(
                                cognitiveProgress.points
                                    .length
                            )}
                        />

                        <CognitiveProgressChart
                            data={
                                cognitiveProgress.points
                            }
                        />
                    </section>
                )}

            {/* ------------------------------------------------------------- */}
            {/* Motor progress                                                 */}
            {/* ------------------------------------------------------------- */}

            {!progressLoading &&
                !progressError &&
                motorProgress && (
                    <section>
                        <h4>
                            Motor Progress
                        </h4>

                        <ProgressCard
                            title="Motor Sessions"
                            value={String(
                                motorProgress.points
                                    .length
                            )}
                        />

                        <MotorProgressChart
                            data={motorProgress.points}
                            transition={
                                motorProgress.transition
                            }
                        />

                        {motorProgress.transition && (
                            <ProgressCard
                                title="Automaticity"
                                value={`Transition at session ${motorProgress.transition.sessionNumber}`}
                            />
                        )}
                    </section>
                )}
        </section>
    );
}