import { StateSnapshot } from './StateSnapshot';

export class InteractionTracker {
  private lastEventTime = 0;
  private lastTypingTime = 0;
  private totalChars = 0;
  private totalWords = 0;
  private lastWordCount = 0;
  private totalRevisions = 0;
  private lastPauseDurationMs = 0;
  private startTime = 0;

  // WPM & EMA Baseline
  private currentWpm = 0;
  private emaWpm = 0;
  private sampleCount = 0;
  private lastRevisionDepth = 0;
  private readonly emaAlpha: number;

  constructor(emaAlpha = 0.3) {
    this.emaAlpha = emaAlpha;
  }

  public reset(now: number): void {
    this.startTime = now;
    this.lastEventTime = now;
    this.lastTypingTime = now;
    this.totalChars = 0;
    this.totalWords = 0;
    this.lastWordCount = 0;
    this.totalRevisions = 0;
    this.lastRevisionDepth = 0;
    this.lastPauseDurationMs = 0;
    this.currentWpm = 0;
    this.emaWpm = 0;
    this.sampleCount = 0;
  }

  public trackType(chars: number, isRevision: boolean, now: number): void {
    this.trackTyping(0, chars, isRevision ? this.lastRevisionDepth + 1 : this.lastRevisionDepth, now);
  }

  public trackTyping(wordCount: number, textLength: number, revisionDepth: number, now: number): void {
    if (this.startTime === 0) this.reset(now);

    const timeDeltaMs = Math.max(100, now - (this.lastTypingTime || this.startTime));
    const timeDeltaSec = timeDeltaMs / 1000;

    const charsDelta = Math.max(0, textLength - this.totalChars);
    this.totalChars = textLength > 0 ? textLength : this.totalChars + charsDelta;
    
    if (revisionDepth > this.lastRevisionDepth) {
      this.totalRevisions += (revisionDepth - this.lastRevisionDepth);
      this.lastRevisionDepth = revisionDepth;
    }

    if (wordCount > 0) {
      const deltaWords = Math.max(0, wordCount - this.lastWordCount);
      this.totalWords = wordCount;
      this.lastWordCount = wordCount;

      if (deltaWords > 0) {
        const instantWpm = (deltaWords / timeDeltaSec) * 60;
        // Cap extreme instant WPM spikes (e.g. paste) at 200 WPM
        this.currentWpm = Math.min(200, instantWpm);
        this.sampleCount++;

        if (this.sampleCount === 1) {
          this.emaWpm = this.currentWpm;
        } else {
          this.emaWpm = this.emaAlpha * this.currentWpm + (1 - this.emaAlpha) * this.emaWpm;
        }
      }
    }

    this.lastTypingTime = now;
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

    // Cumulative WPM as reference if instantaneous WPM is 0
    const cumulativeWpm = (this.totalWords / durationSeconds) * 60;
    const effectiveWpm = this.currentWpm > 0 ? this.currentWpm : cumulativeWpm;

    return {
      wordsPerMinute: effectiveWpm,
      baselineWpm: this.emaWpm,
      sampleCount: this.sampleCount,
      typingVelocity: this.totalChars / durationSeconds,
      rollingTypingAverage: this.totalChars / durationSeconds,
      revisionRate: this.totalRevisions / durationSeconds,
      rollingRevisionAverage: this.totalRevisions / durationSeconds,
      pauseDurationMs: this.lastPauseDurationMs,
      idleDurationMs: now - this.lastEventTime,
      interactionDensity: (this.totalChars + this.totalRevisions) / durationSeconds,
      timestamp: now
    };
  }
}
