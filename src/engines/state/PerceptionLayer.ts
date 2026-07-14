import { EventBusContract, createDomainEvent } from '../../core/event-bus';
import { SessionId, Timestamp, EventId, toTimestamp, toEventId } from '../../core/types/session.types';

export interface PerceptionLayerOptions {
  source?: string;
  clock?: () => number;
  idFactory?: () => string;
}

export class PerceptionLayer {
  private readonly eventBus: EventBusContract;
  private readonly source: string;
  private readonly clock: () => number;
  private readonly idFactory?: () => string;

  // Typing state tracking
  private lastText = '';
  private lastTime = 0;
  private revisionDepth = 0;
  private totalDeletions = 0;
  private totalInsertions = 0;

  // Rolling window of keystroke inputs for WPM calculation (last 10 seconds)
  private inputHistory: Array<{ timestamp: number; charCountDelta: number; wordCountDelta: number }> = [];
  
  // Pause detection timer
  private pauseTimer: any = null;
  private currentSessionId: SessionId | null = null;
  
  // The cognitive pause threshold (1200ms per config)
  private readonly PAUSE_THRESHOLD_MS = 1200;

  constructor(eventBus: EventBusContract, options: PerceptionLayerOptions = {}) {
    this.eventBus = eventBus;
    this.source = options.source ?? 'perception';
    this.clock = options.clock ?? (() => Date.now());
    this.idFactory = options.idFactory;
  }

  /**
   * Resets perception metrics for a new session.
   */
  public reset(sessionId: SessionId): void {
    this.currentSessionId = sessionId;
    this.lastText = '';
    this.lastTime = this.clock();
    this.revisionDepth = 0;
    this.totalDeletions = 0;
    this.totalInsertions = 0;
    this.inputHistory = [];
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  /**
   * Handles user typing input, calculates metrics, and publishes events.
   * 
   * @param text - The current prompt text (transient)
   * @param sessionId - The active session ID
   */
  public handleInput(text: string, sessionId: SessionId): void {
    this.currentSessionId = sessionId;
    const now = this.clock();

    // 1. Calculate word counts
    const cleanText = text.trim();
    const wordCount = cleanText === '' ? 0 : cleanText.split(/\s+/).length;
    const textLength = text.length;

    const prevCleanText = this.lastText.trim();
    const prevWordCount = prevCleanText === '' ? 0 : prevCleanText.split(/\s+/).length;
    const prevLength = this.lastText.length;

    // 2. Track insertions and deletions to compute revision depth and deletion rate
    const lengthDelta = textLength - prevLength;
    const wordDelta = wordCount - prevWordCount;

    if (lengthDelta < 0) {
      // Deletion occurred
      this.totalDeletions += Math.abs(lengthDelta);
      this.revisionDepth++;
    } else if (lengthDelta > 0) {
      // Insertion occurred
      this.totalInsertions += lengthDelta;
      
      // If insertion is in the middle of existing text (non-append), it counts as a revision
      const isAppend = text.startsWith(this.lastText);
      if (!isAppend && this.lastText !== '') {
        this.revisionDepth++;
      }
    }

    // Add to rolling typing history (for WPM)
    this.inputHistory.push({
      timestamp: now,
      charCountDelta: lengthDelta > 0 ? lengthDelta : 0,
      wordCountDelta: wordDelta > 0 ? wordDelta : 0
    });

    this.lastText = text;
    this.lastTime = now;

    // 3. Compute simple string hash for prompt.typed payload to keep raw text off the bus
    const textHash = this.hashString(text);

    // Prepare options
    const eventOptions = {
      clock: () => toTimestamp(this.clock()),
      idFactory: this.idFactory ? () => toEventId(this.idFactory!()) : undefined
    };

    // 4. Publish prompt.typed event
    const typedEvent = createDomainEvent(
      'prompt.typed',
      sessionId,
      this.source,
      {
        textLength,
        wordCount,
        currentTextHash: textHash,
        revisionDepth: this.revisionDepth
      },
      eventOptions
    );
    this.eventBus.publish('prompt.typed', typedEvent);

    // 5. Manage pause detection timeout
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
    }

    this.pauseTimer = setTimeout(() => {
      this.triggerPause(textLength);
    }, this.PAUSE_THRESHOLD_MS);
  }

  /**
   * Triggers a pause.detected event when inactivity exceeds 1200ms.
   */
  private triggerPause(textLength: number): void {
    if (!this.currentSessionId) return;
    
    const eventOptions = {
      clock: () => toTimestamp(this.clock()),
      idFactory: this.idFactory ? () => toEventId(this.idFactory!()) : undefined
    };

    const pauseEvent = createDomainEvent(
      'pause.detected',
      this.currentSessionId,
      this.source,
      {
        durationMs: this.PAUSE_THRESHOLD_MS,
        textLength
      },
      eventOptions
    );
    this.eventBus.publish('pause.detected', pauseEvent);
  }

  /**
   * Computes the Words Per Minute (WPM) based on the rolling window of the last 10 seconds.
   */
  public getWordsPerMinute(): number {
    const now = this.clock();
    const windowMs = 10000; // 10 second rolling window
    
    // Evict older inputs
    this.inputHistory = this.inputHistory.filter(item => now - item.timestamp <= windowMs);
    
    if (this.inputHistory.length === 0) {
      return 0;
    }

    // WPM is calculated as standard: (charCount / 5) / (minutes)
    let totalChars = 0;
    for (const item of this.inputHistory) {
      totalChars += item.charCountDelta;
    }

    const elapsedMinutes = windowMs / 60000; // 1/6 of a minute
    const wpm = (totalChars / 5) / elapsedMinutes;
    return Math.round(wpm);
  }

  /**
   * Calculates the current deletion rate (percentage of deleted characters to total typed characters).
   */
  public getDeletionRate(): number {
    const totalTyped = this.totalInsertions;
    if (totalTyped === 0) return 0;
    return parseFloat((this.totalDeletions / totalTyped).toFixed(2));
  }

  /**
   * Gets the current revision depth.
   */
  public getRevisionDepth(): number {
    return this.revisionDepth;
  }

  /**
   * Helper to hash a string client-side without storing the text (simple, deterministic djb2)
   */
  private hashString(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return 'h_' + (hash >>> 0).toString(16);
  }

  /**
   * Clean up timers on dispose
   */
  public dispose(): void {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }
}
