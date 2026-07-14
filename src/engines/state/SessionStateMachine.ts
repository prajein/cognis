import { EventBusContract, createDomainEvent } from '../../core/event-bus';
import { SessionId, Timestamp, toTimestamp, toEventId } from '../../core/types/session.types';
import { TaskId } from '../../core/types/activation-profile.types';
import { SessionEvents, InsightEvents } from '../../core/event-bus/registry';

export type SessionState =
  | 'IDLE'
  | 'TASK_SELECTED'
  | 'SESSION_ACTIVE'
  | 'SESSION_ENDED'
  | 'INSIGHT_GENERATED'
  | 'PROGRESS_UPDATED';

export interface SessionStateMachineOptions {
  source?: string;
  clock?: () => number;
  idFactory?: () => string;
}

export class SessionStateMachine {
  private readonly eventBus: EventBusContract;
  private readonly source: string;
  private readonly clock: () => number;
  private readonly idFactory?: () => string;

  // Active state
  private currentState: SessionState = 'IDLE';
  private currentSessionId: SessionId | null = null;
  private activeTaskId: TaskId | null = null;
  private startTime: Timestamp = toTimestamp(0);
  private pauseTime: Timestamp = toTimestamp(0);
  private totalPauseDurationMs = 0;

  private unsubscribes: Array<() => void> = [];
  private started = false;

  constructor(eventBus: EventBusContract, options: SessionStateMachineOptions = {}) {
    this.eventBus = eventBus;
    this.source = options.source ?? 'session-state-machine';
    this.clock = options.clock ?? (() => Date.now());
    this.idFactory = options.idFactory;
  }

  /**
   * Starts listening to event bus signals.
   */
  public start(): () => void {
    if (this.started) return () => this.stop();
    this.started = true;

    this.unsubscribes.push(
      this.eventBus.subscribe(SessionEvents.STARTED, (event) => {
        this.currentSessionId = event.sessionId;
        this.startTime = event.timestamp;
        this.totalPauseDurationMs = 0;
        this.transition('SESSION_ACTIVE');
      })
    );

    this.unsubscribes.push(
      this.eventBus.subscribe(SessionEvents.PAUSED, (event) => {
        if (this.currentState === 'SESSION_ACTIVE') {
          this.pauseTime = event.timestamp;
          this.transition('SESSION_ACTIVE'); // Wait, pause maintains session active but tracks pausing
        }
      })
    );

    this.unsubscribes.push(
      this.eventBus.subscribe(SessionEvents.RESUMED, (event) => {
        if (this.pauseTime > 0) {
          const pauseDuration = event.timestamp - this.pauseTime;
          this.totalPauseDurationMs += pauseDuration;
          this.pauseTime = toTimestamp(0);
        }
      })
    );

    this.unsubscribes.push(
      this.eventBus.subscribe(SessionEvents.ENDED, (event) => {
        this.transition('SESSION_ENDED');
        this.triggerInsightGeneration(event.sessionId);
      })
    );

    this.unsubscribes.push(
      this.eventBus.subscribe(InsightEvents.GENERATED, (event) => {
        if (event.sessionId === this.currentSessionId && this.currentState === 'SESSION_ENDED') {
          this.transition('INSIGHT_GENERATED');
          this.triggerProgressUpdate(event.sessionId);
        }
      })
    );

    this.unsubscribes.push(
      this.eventBus.subscribe(InsightEvents.AUTOMATICITY_UPDATED, (event) => {
        if (event.sessionId === this.currentSessionId && this.currentState === 'INSIGHT_GENERATED') {
          this.transition('PROGRESS_UPDATED');
        }
      })
    );

    return () => this.stop();
  }

  /**
   * Manually select a task (triggers TASK_SELECTED state).
   */
  public selectTask(taskId: TaskId, sessionId: SessionId): void {
    this.currentSessionId = sessionId;
    this.activeTaskId = taskId;
    this.transition('TASK_SELECTED');
  }

  /**
   * Resets the state machine back to IDLE.
   */
  public reset(): void {
    this.currentState = 'IDLE';
    this.currentSessionId = null;
    this.activeTaskId = null;
    this.startTime = toTimestamp(0);
    this.pauseTime = toTimestamp(0);
    this.totalPauseDurationMs = 0;
  }

  /**
   * State transitions helper.
   */
  private transition(nextState: SessionState): void {
    const previous = this.currentState;
    this.currentState = nextState;
    console.log(`[SessionStateMachine] State transitioned: ${previous} -> ${nextState}`);
  }

  /**
   * Simulates/coordinates moving from SESSION_ENDED to INSIGHT_GENERATED.
   */
  private triggerInsightGeneration(sessionId: SessionId): void {
    // In a real run, the InsightEngine hears 'session.ended' and runs its strategy,
    // which publishes 'insight.generated'.
  }

  /**
   * Simulates/coordinates moving from INSIGHT_GENERATED to PROGRESS_UPDATED.
   */
  private triggerProgressUpdate(sessionId: SessionId): void {
    // The automaticity engine or projections update publishes 'automaticity.updated'.
  }

  public getCurrentState(): SessionState {
    return this.currentState;
  }

  public getActiveTaskId(): TaskId | null {
    return this.activeTaskId;
  }

  public getSessionDuration(): number {
    if (this.startTime === 0) return 0;
    const end = this.clock();
    const duration = end - this.startTime - this.totalPauseDurationMs;
    return Math.max(0, duration);
  }

  public stop(): void {
    while (this.unsubscribes.length > 0) {
      const unsub = this.unsubscribes.pop();
      unsub?.();
    }
    this.started = false;
  }
}
