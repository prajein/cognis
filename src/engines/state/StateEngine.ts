import { EventBusContract, Clock, EventIdFactory, createDomainEvent } from '../../core/event-bus';
import { PromptEvents, SessionEvents, CognitiveEvents } from '../../core/event-bus/registry';
import { DomainEvent, StateChangedPayload, PromptTypedPayload, PauseDetectedPayload, SessionStartedPayload } from '../../core/event-bus/contracts';
import { StateRulesLoader } from '../../core/config/state-rules-loader';
import { InteractionTracker } from './InteractionTracker';
import { StateEvaluator } from './StateEvaluator';
import { TransitionPolicy } from './TransitionPolicy';
import { toSessionId } from '../../core/types/session.types';

export interface StateEngineOptions {
  readonly clock?: Clock;
  readonly idFactory?: EventIdFactory;
}

export class StateEngine {
  private readonly tracker: InteractionTracker;
  private readonly evaluator: StateEvaluator;
  private readonly policy: TransitionPolicy;
  private readonly clock: Clock;
  private readonly idFactory?: EventIdFactory;
  private activeSessionId: string | null = null;
  private unsubscribeHandlers: Array<() => void> = [];

  constructor(
    private readonly eventBus: EventBusContract,
    options: StateEngineOptions = {}
  ) {
    const rules = StateRulesLoader.load();
    this.tracker = new InteractionTracker(rules.baseline?.emaAlpha ?? 0.3);
    this.evaluator = new StateEvaluator(rules);
    this.policy = new TransitionPolicy(rules);
    this.clock = options.clock ?? (() => Date.now() as any);
    this.idFactory = options.idFactory;
  }

  public start(): void {
    if (this.unsubscribeHandlers.length > 0) return;

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

  private handleSessionStarted(event: DomainEvent<SessionStartedPayload>): void {
    this.activeSessionId = event.sessionId;
    const now = this.clock();
    this.tracker.reset(now);
    this.policy.reset('stretch');
  }

  private handleSessionEnded(): void {
    this.activeSessionId = null;
  }

  private handleTyped(event: DomainEvent<PromptTypedPayload>): void {
    if (!this.activeSessionId || event.sessionId !== this.activeSessionId) return;
    const now = this.clock();
    
    const { wordCount, textLength, revisionDepth } = event.payload;
    
    this.tracker.trackTyping(wordCount, textLength, revisionDepth, now);
    this.evaluateAndPublish(now);
  }

  private handlePause(event: DomainEvent<PauseDetectedPayload>): void {
    if (!this.activeSessionId || event.sessionId !== this.activeSessionId) return;
    const now = this.clock();
    
    const duration = event.payload.durationMs || 1000;
    this.tracker.trackPause(duration, now);
    this.evaluateAndPublish(now);
  }

  private evaluateAndPublish(now: number): void {
    if (!this.activeSessionId) return;

    const previousState = this.policy.getCurrentState();
    const snapshot = this.tracker.generateSnapshot(now);
    const proposedState = this.evaluator.evaluate(snapshot);
    const approvedState = this.policy.approveTransition(proposedState, now);

    if (approvedState) {
      const payload: StateChangedPayload = {
        previousState,
        currentState: approvedState,
        confidence: 0.9
      };

      const event = createDomainEvent(
        CognitiveEvents.STATE_CHANGED,
        toSessionId(this.activeSessionId),
        'StateEngine',
        payload,
        { clock: () => now as any, idFactory: this.idFactory }
      );

      this.eventBus.publish(CognitiveEvents.STATE_CHANGED, event);
    }
  }
}
