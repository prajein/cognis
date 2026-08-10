import { EventBusContract, createDomainEvent } from '../../core/event-bus';
import { GhostTextEvents, SessionEvents, AdaptationEvents } from '../../core/event-bus/registry';
import { DomainEvent, GhostTextDisplayedPayload, GhostTextDismissedPayload } from '../../core/event-bus/contracts';
import { GapType } from '../../core/types/gap.types';
import { SessionId } from '../../core/types/session.types';

interface Counters {
  exposures: number;
  rejections: number;
}

export class GhostTextAdaptor {
  private readonly source = 'ghost-text-adaptor';
  private currentSessionId: SessionId | null = null;
  private readonly counters = new Map<GapType, Counters>();
  private readonly suppressedGaps = new Set<GapType>();
  private unsubscribes: Array<() => void> = [];

  constructor(private readonly eventBus: EventBusContract) {}

  public start(): void {
    if (this.unsubscribes.length > 0) return;

    this.unsubscribes.push(
      this.eventBus.subscribe(SessionEvents.STARTED, (event) => {
        this.reset(event.sessionId);
      }),
      this.eventBus.subscribe(SessionEvents.ENDED, () => {
        this.reset(null);
      }),
      this.eventBus.subscribe(GhostTextEvents.ACCEPTED, (event) => {
        this.handleAccepted(event);
      }),
      this.eventBus.subscribe(GhostTextEvents.DISMISSED, (event) => {
        this.handleDismissed(event);
      })
    );
  }

  public stop(): void {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
    this.reset(null);
  }

  private reset(sessionId: SessionId | null): void {
    this.currentSessionId = sessionId;
    this.counters.clear();
    this.suppressedGaps.clear();
  }

  private handleAccepted(event: DomainEvent<any>): void {
    if (!this.currentSessionId || event.sessionId !== this.currentSessionId) return;

    const { gapType } = event.payload;
    if (!gapType) return;

    const stats = this.getOrCreateCounters(gapType);
    stats.exposures++;

    this.evaluatePolicy(gapType, stats, event.sessionId);
  }

  private handleDismissed(event: DomainEvent<GhostTextDismissedPayload>): void {
    if (!this.currentSessionId || event.sessionId !== this.currentSessionId) return;

    const { gapType, reason } = event.payload;
    if (!gapType || reason === 'replaced') return;

    const stats = this.getOrCreateCounters(gapType);
    stats.exposures++; // Only count valid terminal events as exposures

    // Check if the dismissal reason counts as an explicit user rejection
    if (reason === 'continued_typing' || reason === 'caret_moved') {
      stats.rejections++;
    }

    // Evaluate the adaptation policy
    this.evaluatePolicy(gapType, stats, event.sessionId);
  }

  private getOrCreateCounters(gapType: GapType): Counters {
    let stats = this.counters.get(gapType);
    if (!stats) {
      stats = { exposures: 0, rejections: 0 };
      this.counters.set(gapType, stats);
    }
    return stats;
  }

  private evaluatePolicy(gapType: GapType, stats: Counters, sessionId: SessionId): void {
    if (this.suppressedGaps.has(gapType)) return;

    const exposures = stats.exposures;
    const rejections = stats.rejections;

    // Deterministic policy constant: exposures >= 4 and rejectionRate >= 0.75
    if (exposures >= 4 && (rejections / exposures) >= 0.75) {
      this.suppressedGaps.add(gapType);

      const reasoning = `Ghost Text for gap '${gapType}' suppressed due to high user rejection rate: ` +
        `${rejections}/${exposures} exposures (${((rejections / exposures) * 100).toFixed(1)}%) dismissed with active typing/caret events.`;

      console.log(`[GhostTextAdaptor] Publishing suppression decision:`, reasoning);

      const adaptationEvent = createDomainEvent(
        AdaptationEvents.CONFIGURED,
        sessionId,
        this.source,
        {
          targetModule: 'ghosttext',
          gapType,
          action: 'suppress',
          reasoning
        }
      );

      this.eventBus.publish(AdaptationEvents.CONFIGURED, adaptationEvent);
    }
  }
}
