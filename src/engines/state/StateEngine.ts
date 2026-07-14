import { EventBusContract, createDomainEvent } from '../../core/event-bus';
import { PromptEvents, SessionEvents, CognitiveEvents } from '../../core/event-bus/registry';
import { DomainEvent, StateChangedPayload, PromptTypedPayload, PauseDetectedPayload } from '../../core/event-bus/contracts';
import { StateRulesLoader } from '../../core/config/state-rules-loader';
import { InteractionTracker } from './InteractionTracker';
import { StateEvaluator } from './StateEvaluator';
import { TransitionPolicy } from './TransitionPolicy';
import { toSessionId } from '../../core/types/session.types';

export class StateEngine {
  private readonly tracker = new InteractionTracker();
  private readonly evaluator: StateEvaluator;
  private readonly policy: TransitionPolicy;
  private activeSessionId: string | null = null;
  private unsubscribeHandlers: Array<() => void> = [];

  constructor(private readonly eventBus: EventBusContract) {
    const rules = StateRulesLoader.load();
    this.evaluator = new StateEvaluator(rules);
    this.policy = new TransitionPolicy(rules);
  }

  public start(): void {
    this.unsubscribeHandlers.push(
      this.eventBus.subscribe(SessionEvents.STARTED, this.handleSessionStarted.bind(this)),
      this.eventBus.subscribe(SessionEvents.ENDED, this.handleSessionEnded.bind(this)),
      this.eventBus.subscribe(PromptEvents.TYPED, this.handleTyped.bind(this)),
      this.eventBus.subscribe(CognitiveEvents.PAUSE_DETECTED, this.handlePause.bind(this))
    );
  }

  public stop(): void {
    for (const unsubscribe of this.unsubscribeHandlers) {
      unsubscribe();
    }
    this.unsubscribeHandlers = [];
  }

  private handleSessionStarted(event: DomainEvent<any>): void {
    this.activeSessionId = event.sessionId;
    this.tracker.reset(Date.now());
  }

  private handleSessionEnded(): void {
    this.activeSessionId = null;
  }

  private handleTyped(event: DomainEvent<PromptTypedPayload>): void {
    if (!this.activeSessionId || event.sessionId !== this.activeSessionId) return;
    const now = Date.now();
    
    // Simplification for V1 metrics
    // We treat every 'typed' event as 1 char action (or track actual deltas if maintained in state)
    // Here we use revisionDepth > 0 to assume some revision is happening.
    const isRevision = event.payload.revisionDepth > 0;
    
    this.tracker.trackType(1, isRevision, now);
    this.evaluateAndPublish(now, event.id);
  }

  private handlePause(event: DomainEvent<PauseDetectedPayload>): void {
    if (!this.activeSessionId || event.sessionId !== this.activeSessionId) return;
    const now = Date.now();
    
    const duration = event.payload.durationMs || 1000;
    this.tracker.trackPause(duration, now);
    this.evaluateAndPublish(now, event.id);
  }

  private evaluateAndPublish(now: number, triggerEventId: string): void {
    if (!this.activeSessionId) return;

    const snapshot = this.tracker.generateSnapshot(now);
    const proposedState = this.evaluator.evaluate(snapshot);
    const approvedState = this.policy.approveTransition(proposedState, now);

    if (approvedState) {
      const payload: StateChangedPayload = {
        previousState: 'stretch', // Simplified for V1 - typically from policy.previousState
        currentState: approvedState,
        confidence: 0.9 // High baseline for deterministic transitions
      };

      const event = createDomainEvent(
        CognitiveEvents.STATE_CHANGED,
        toSessionId(this.activeSessionId),
        'StateEngine',
        payload
      );

      this.eventBus.publish(CognitiveEvents.STATE_CHANGED, event);
    }
  }
}
