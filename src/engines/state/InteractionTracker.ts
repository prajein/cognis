import { StateSnapshot } from './StateSnapshot';

export class InteractionTracker {
  private lastEventTime = 0;
  private totalChars = 0;
  private totalRevisions = 0;
  private lastPauseDurationMs = 0;
  private startTime = 0;

  public reset(now: number): void {
    this.startTime = now;
    this.lastEventTime = now;
    this.totalChars = 0;
    this.totalRevisions = 0;
    this.lastPauseDurationMs = 0;
  }

  public trackType(chars: number, isRevision: boolean, now: number): void {
    if (this.startTime === 0) this.reset(now);
    
    this.totalChars += chars;
    if (isRevision) {
      this.totalRevisions++;
    }
    this.lastEventTime = now;
  }

  public trackPause(durationMs: number, now: number): void {
    if (this.startTime === 0) this.reset(now);

    this.lastPauseDurationMs = durationMs;
    this.lastEventTime = now;
  }

  public generateSnapshot(now: number): StateSnapshot {
    if (this.startTime === 0) this.reset(now);

    const sessionDuration = Math.max(1000, now - this.startTime); // Avoid divide by 0
    const durationSeconds = sessionDuration / 1000;

    return {
      typingVelocity: this.totalChars / durationSeconds,
      rollingTypingAverage: this.totalChars / durationSeconds, // Simplified for V1
      revisionRate: this.totalRevisions / durationSeconds,
      rollingRevisionAverage: this.totalRevisions / durationSeconds, // Simplified for V1
      pauseDurationMs: this.lastPauseDurationMs,
      idleDurationMs: now - this.lastEventTime,
      interactionDensity: (this.totalChars + this.totalRevisions) / durationSeconds,
      timestamp: now
    };
  }
}
