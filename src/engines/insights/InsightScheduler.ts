import { EventBusContract } from '../../core/event-bus/types';
import { SessionEvents, PromptEvents } from '../../core/event-bus/registry';
import { DomainEvent } from '../../core/event-bus/contracts';
import { ReasoningPipeline } from './pipeline/ReasoningPipeline';

/**
 * Represents a coalesced trigger that arrived while a pipeline was already in-flight.
 * Using a union type instead of a boolean so new terminal event types can be added
 * without collapsing into multiple boolean flags.
 */
type PendingTrigger = 'none' | 'terminal';

export class InsightScheduler {
  private unsubscribeHandlers: Array<() => void> = [];
  private promptsSinceLastEval = 0;
  private readonly PROMPT_VOLUME_THRESHOLD = 100;

  /**
   * Per-session in-flight state.
   *
   * Problem: The EventBus is synchronous, but our handlers are async. A second
   * event can fire while the first handler is suspended at `await`, causing two
   * pipeline executions to interleave for the same session.
   *
   * Drop vs. Coalesce:
   * - For volume threshold triggers: drop is safe. The in-flight pipeline is
   *   already reading current read model state; running again immediately adds
   *   no new information.
   * - For session.ended: coalesce is required. `session.ended` synchronously
   *   writes `SessionReadModel.status = 'ended'` before this handler awaits.
   *   An in-flight pipeline started before that write will observe stale
   *   `status = 'active'` and produce an incomplete terminal insight. The
   *   session.ended run must always execute once the first pipeline finishes.
   */
  private readonly inFlightSessions = new Map<string, { pendingTrigger: PendingTrigger }>();

  constructor(
    private readonly eventBus: EventBusContract,
    private readonly pipeline: ReasoningPipeline
  ) {}

  public start(): void {
    // Strategy 1: Session Ended
    this.unsubscribeHandlers.push(
      this.eventBus.subscribe(SessionEvents.ENDED, this.handleSessionEnded.bind(this))
    );

    // Strategy 2: Volume Threshold (e.g. 100 prompts)
    this.unsubscribeHandlers.push(
      this.eventBus.subscribe(PromptEvents.SENT, this.handlePromptSent.bind(this))
    );
  }

  public stop(): void {
    for (const unsubscribe of this.unsubscribeHandlers) {
      unsubscribe();
    }
    this.unsubscribeHandlers = [];
    this.inFlightSessions.clear();
  }

  private async handleSessionEnded(event: DomainEvent<any>): Promise<void> {
    const { sessionId } = event;
    await this.runPipeline(sessionId, 'session.ended', /* terminal */ true);
    this.promptsSinceLastEval = 0;
  }

  private async handlePromptSent(event: DomainEvent<any>): Promise<void> {
    this.promptsSinceLastEval++;

    if (this.promptsSinceLastEval >= this.PROMPT_VOLUME_THRESHOLD) {
      const { sessionId } = event;
      this.promptsSinceLastEval = 0;
      await this.runPipeline(sessionId, 'volume.threshold', /* terminal */ false);
    }
  }

  /**
   * Executes the pipeline for a session, guarded against duplicate concurrent runs.
   *
   * - Non-terminal triggers (volume threshold): dropped if in-flight. The
   *   in-flight run already observes current state; repeating immediately adds nothing.
   * - Terminal triggers (session.ended): coalesced. If in-flight, the pending flag
   *   is set so the pipeline reruns exactly once after the current execution completes,
   *   ensuring the final read model state (status: 'ended') is always observed.
   */
  private async runPipeline(sessionId: string, trigger: string, terminal: boolean): Promise<void> {
    const inflight = this.inFlightSessions.get(sessionId);

    if (inflight) {
      if (terminal) {
        inflight.pendingTrigger = 'terminal';
        console.log(`[InsightScheduler] Pipeline in-flight for ${sessionId}; coalescing terminal trigger '${trigger}'.`);
      } else {
        console.log(`[InsightScheduler] Pipeline in-flight for ${sessionId}; dropping intermediate trigger '${trigger}'.`);
      }
      return;
    }

    this.inFlightSessions.set(sessionId, { pendingTrigger: 'none' });
    console.log(`[InsightScheduler] Triggering pipeline for '${trigger}' (${sessionId})`);

    try {
      await this.pipeline.execute(sessionId);
    } catch (error) {
      console.error(`[InsightScheduler] Pipeline failed for session ${sessionId}:`, error);
    } finally {
      const state = this.inFlightSessions.get(sessionId);
      this.inFlightSessions.delete(sessionId);

      // If a terminal trigger arrived while we were in-flight, rerun once now
      // that the read models reflect the final session state.
      if (state?.pendingTrigger === 'terminal') {
        console.log(`[InsightScheduler] Executing coalesced terminal pipeline for session ${sessionId}`);
        await this.runPipeline(sessionId, 'session.ended (coalesced)', true);
      }
    }
  }
}


