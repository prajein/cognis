export interface StateSnapshot {
  readonly typingVelocity: number;
  readonly rollingTypingAverage: number;
  readonly revisionRate: number;
  readonly rollingRevisionAverage: number;
  readonly pauseDurationMs: number;
  readonly idleDurationMs: number;
  readonly interactionDensity: number;
  readonly timestamp: number;
}
