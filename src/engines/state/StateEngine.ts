import { EventBusContract, createDomainEvent } from '../../core/event-bus';
import { SessionEvents, PromptEvents, CognitiveEvents } from '../../core/event-bus/registry';
import { SessionId, Timestamp, toTimestamp, toEventId } from '../../core/types/session.types';
import { StateLabel } from '../../core/types/state.types';

export interface StateEngineOptions {
  source?: string;
  clock?: () => number;
  idFactory?: () => string;
}

export class StateEngine {
  private readonly eventBus: EventBusContract;
  private readonly source: string;
  private readonly clock: () => number;
  private readonly idFactory?: () => string;

  // Running tracking metrics
  private currentState: StateLabel = 'stretch';
  private baselineWpm = 40; // Starts at a default baseline, updates dynamically
  private sessionWpmHistory: number[] = [];
  private lastPauseTime: Timestamp = toTimestamp(0);
  private currentSessionId: SessionId | null = null;
  private active = false;

  private unsubscribes: Array<() => void> = [];

  constructor(eventBus: EventBusContract, options: StateEngineOptions = {}) {
    this.eventBus = eventBus;
    this.source = options.source ?? 'state-engine';
    this.clock = options.clock ?? (() => Date.now());
    this.idFactory = options.idFactory;
  }

  /**
   * Starts the state engine event listeners.
   */
  public start(): () => void {
    if (this.active) return () => this.stop();
    this.active = true;

    this.unsubscribes.push(
      this.eventBus.subscribe(SessionEvents.STARTED, (event) => {
        this.currentSessionId = event.sessionId;
        this.resetSessionMetrics();
      })
    );

    this.unsubscribes.push(
      this.eventBus.subscribe(CognitiveEvents.PAUSE_DETECTED, (event) => {
        if (this.currentSessionId === event.sessionId) {
          this.lastPauseTime = event.timestamp;
          this.evaluateStateAndPublish(10, 0, event.sessionId); // Mock small speed on pause
        }
      })
    );

    this.unsubscribes.push(
      this.eventBus.subscribe(PromptEvents.TYPED, (event) => {
        if (this.currentSessionId === event.sessionId) {
          // Extract typing metrics and infer state
          const textLength = event.payload.textLength;
          const wordCount = event.payload.wordCount;
          const revisionDepth = event.payload.revisionDepth;
          
          // Estimate rolling speed and deletion metrics
          const durationSec = Math.max(1, (this.clock() - this.lastPauseTime) / 1000);
          const currentWpm = Math.round((wordCount / durationSec) * 60);

          // Simulated deletion rate from revision depth
          const deletionRate = revisionDepth > 0 ? 0.12 : 0.02;

          this.evaluateStateAndPublish(currentWpm, deletionRate, event.sessionId);
        }
      })
    );

    return () => this.stop();
  }

  /**
   * Resets metrics on session start.
   */
  private resetSessionMetrics(): void {
    this.currentState = 'stretch';
    this.sessionWpmHistory = [];
    this.lastPauseTime = toTimestamp(this.clock());
  }

  /**
   * Evaluates cognitive state based on speed (WPM) vs. baseline and deletion rates,
   * then publishes state.changed if it changes.
   */
  private evaluateStateAndPublish(wpm: number, deletionRate: number, sessionId: SessionId): void {
    // 1. Maintain baseline typing speed (running average of past speeds)
    if (wpm > 5 && wpm < 150) {
      this.sessionWpmHistory.push(wpm);
      if (this.sessionWpmHistory.length > 20) {
        this.sessionWpmHistory.shift();
      }
      this.baselineWpm = Math.round(
        this.sessionWpmHistory.reduce((a, c) => a + c, 0) / this.sessionWpmHistory.length
      );
    }

    const previousState = this.currentState;
    let inferredState: StateLabel = 'stretch';

    // 2. Infer cognitive state label
    if (wpm > this.baselineWpm * 1.2 && deletionRate < 0.15) {
      // Fast, fluent typing -> low load, coasting
      inferredState = 'coasting';
    } else if (wpm < this.baselineWpm * 0.7 && deletionRate >= 0.25) {
      // Slow typing, high deletions -> high load, overload
      inferredState = 'overload';
    } else {
      // operating near capacity/baseline -> productive struggle/stretch
      inferredState = 'stretch';
    }

    this.currentState = inferredState;

    // 3. Publish state.changed event if state changes
    if (inferredState !== previousState) {
      const eventOptions = {
        clock: () => toTimestamp(this.clock()),
        idFactory: this.idFactory ? () => toEventId(this.idFactory!()) : undefined
      };

      const stateEvent = createDomainEvent(
        'state.changed',
        sessionId,
        this.source,
        {
          previousState,
          currentState: inferredState,
          confidence: 0.85
        },
        eventOptions
      );
      this.eventBus.publish('state.changed', stateEvent);
    }
  }

  public getInferredState(): StateLabel {
    return this.currentState;
  }

  public getBaselineWpm(): number {
    return this.baselineWpm;
  }

  /**
   * Stops the state engine listeners.
   */
  public stop(): void {
    while (this.unsubscribes.length > 0) {
      const unsub = this.unsubscribes.pop();
      unsub?.();
    }
    this.active = false;
  }
}
