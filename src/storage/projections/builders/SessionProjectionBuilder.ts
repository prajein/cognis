import { DomainEvent, SessionStartedPayload, SessionEndedPayload, SessionPausedPayload, SessionResumedPayload } from '../../../core/event-bus/contracts';
import { PromptEvents, SessionEvents, EventType } from '../../../core/event-bus/registry';
import { ProjectionBuilder } from '../interfaces';
import { ReadModelRepository } from '../../repositories/ReadModelRepository';

export interface SessionReadModel {
  projectionId: string; // e.g. "session_v1_SESSION_ID"
  sessionId: string;
  platform: string;
  /**
   * The task the user was working on during this session.
   * Populated only when the session was initiated from Surface B.
   * Undefined for sessions started implicitly by the platform adapter.
   */
  taskId?: string;
  hasTypingActivity?: boolean;
  startTime: number;
  endTime?: number;
  status: 'active' | 'paused' | 'ended';
  totalPauseDurationMs: number;
  lastUpdated: number;
}

export class SessionProjectionBuilder implements ProjectionBuilder {
  public readonly projectionId = 'session-v1';
  public readonly consumedEvents: ReadonlyArray<EventType> = [
    SessionEvents.STARTED,
    SessionEvents.ENDED,
    SessionEvents.PAUSED,
    SessionEvents.RESUMED,
    PromptEvents.TYPED
  ];

  constructor(private readonly repo: ReadModelRepository) {}

  public async handleEvent(event: DomainEvent<any>): Promise<void> {
    const id = `${this.projectionId}_${event.sessionId}`;
    
    // Retrieve existing state or initialize
    let model = await this.repo.get<SessionReadModel>(id);

    if (!model) {
      if (event.type === SessionEvents.STARTED) {
        const payload = event.payload as SessionStartedPayload;
        model = {
          projectionId: id,
          sessionId: event.sessionId,
          platform: payload.platform,
          taskId: payload.taskId,
          hasTypingActivity: false,
          startTime: event.timestamp,
          status: 'active',
          totalPauseDurationMs: 0,
          lastUpdated: event.timestamp
        };
      } else {
        // We received a lifecycle event before STARTED. 
        // In a strictly ordered event sourced system, this is rare but possible during replays if partial.
        console.warn(`[SessionProjectionBuilder] Received ${event.type} before session.started for ${event.sessionId}`);
        return;
      }
    }

    // Apply idempotent state transitions
    switch (event.type) {
      case SessionEvents.ENDED: {
        const payload = event.payload as SessionEndedPayload;
        model.status = 'ended';
        model.endTime = event.timestamp;
        break;
      }
      case SessionEvents.PAUSED: {
        const payload = event.payload as SessionPausedPayload;
        model.status = 'paused';
        break;
      }
      case SessionEvents.RESUMED: {
        const payload = event.payload as SessionResumedPayload;
        model.status = 'active';
        model.totalPauseDurationMs += payload.pauseDurationMs;
        break;
      }
      case PromptEvents.TYPED: {
        model.hasTypingActivity = true;
        break;
      }
    }

    model.lastUpdated = event.timestamp;

    // Persist (upsert)
    await this.repo.put(model);
  }

  public async clear(): Promise<void> {
    // In a real production system with thousands of sessions, we'd need a bulk delete by prefix.
    // For now, this requires extending ReadModelRepository to delete by index or prefix, or rebuilding individual sessions.
    // Given the ProjectionManager uses rebuildForSession, it's safer to not have a global clear if we are doing session-by-session rebuilds.
    console.warn(`[SessionProjectionBuilder] clear() called. Not implemented for session-level rebuilds yet.`);
  }
}
