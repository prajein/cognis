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
        <section className="progress-panel">
            <h2 className="section-heading">Progress</h2>

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
                    <section className="progress-group">
                        <span className="micro-label">
                            Skill Balance
                        </span>

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
                    <section className="progress-group">
                        <span className="micro-label">
                            Cross-Subclass Transfer
                        </span>

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
                    <section className="progress-group">
                        <span className="micro-label">
                            Are you getting better?
                        </span>

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
                    <section className="progress-group">
                        <span className="micro-label">
                            Motor Progress
                        </span>

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