import { EventBusContract, ErrorReporter } from '../../core/event-bus/types';
import { DomainEvent } from '../../core/event-bus/contracts';
import { EventRepository } from '../repositories/EventRepository';
import { ProjectionBuilder } from './interfaces';
import { SessionId } from '../../core/types/session.types';
import { SessionEvents } from '../../core/event-bus/registry';

/**
 * ProjectionManager
 *
 * Orchestrator for all Projection Builders.
 * Wires builders to the EventBus for live updates, and manages
 * the rebuild/replay pipeline from the EventRepository.
 */
export class ProjectionManager {
  constructor(
    private readonly builders: ProjectionBuilder[],
    private readonly eventBus: EventBusContract,
    private readonly eventRepo: EventRepository,
    private readonly errorReporter: ErrorReporter
  ) {}

  /**
   * Subscribes all builders to their declared `consumedEvents` on the EventBus.
   * Isolates failures so one broken projection doesn't halt the event stream.
   */
  public startLiveSubscriptions(): void {
    for (const builder of this.builders) {
      for (const eventType of builder.consumedEvents) {
        this.eventBus.subscribe(eventType, async (event: DomainEvent<any>) => {
          try {
            await builder.handleEvent(event);
          } catch (error) {
            this.errorReporter.report(error, {
              eventType: 'projection.update.failed',
              source: `ProjectionManager[${builder.projectionId}]`
            });
            // Intentionally not re-throwing to isolate failure
          }
        });
      }
    }
    console.log('[ProjectionManager] Live subscriptions active for', this.builders.length, 'builders.');
  }

  /**
   * Clears and rebuilds projections for a specific session by streaming ordered events.
   * If sessionId is omitted, it could rebuild from all events (future use case).
   */
  public async rebuildForSession(sessionId: SessionId): Promise<void> {
    console.log(`[ProjectionManager] Starting rebuild for session ${sessionId}...`);

    // 1. Fetch strictly ordered events first
    const events = await this.eventRepo.getBySessionOrdered(sessionId);

    // 2. Safely guard against destructive rebuilds of compacted history
    if (events.length === 0) {
      console.warn(`[ProjectionManager] Refusing to rebuild: No events found for session ${sessionId}. If this session was compacted by retention, the existing projection is intentionally preserved.`);
      return;
    }

    if (events[0].type !== SessionEvents.STARTED) {
      console.warn(`[ProjectionManager] Refusing to rebuild: Session ${sessionId} history is partially compacted (missing STARTED event). Rebuilding now would corrupt the projection.`);
      return;
    }

    // 3. Clear state (safe to proceed)
    for (const builder of this.builders) {
      try {
        await builder.clear();
      } catch (error) {
        this.errorReporter.report(error, {
          eventType: 'projection.clear.failed',
          source: `ProjectionManager[${builder.projectionId}]`
        });
      }
    }

    // 4. Sequentially process events (batch optimizations deferred per architectural plan)
    for (const event of events) {
      for (const builder of this.builders) {
        if (builder.consumedEvents.includes(event.type)) {
          try {
            await builder.handleEvent(event);
          } catch (error) {
            this.errorReporter.report(error, {
              eventType: 'projection.replay.failed',
              source: `ProjectionManager[${builder.projectionId}]`
            });
          }
        }
      }
    }

    console.log(`[ProjectionManager] Rebuild complete for session ${sessionId}. Processed ${events.length} events.`);
  }
}
