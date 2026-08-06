export interface StateSnapshot {
  readonly wordsPerMinute: number;
  readonly baselineWpm: number;
  readonly sampleCount: number;
  readonly typingVelocity: number;
  readonly rollingTypingAverage: number;
  readonly revisionRate: number;
  readonly rollingRevisionAverage: number;
  readonly pauseDurationMs: number;
  readonly idleDurationMs: number;
  readonly interactionDensity: number;
  readonly timestamp: number;
}
