import { SessionCommandGateway } from '../../sidepanel/runtime/SessionCommandGateway';
import { SessionQueryGateway } from '../../sidepanel/runtime/SessionQueryGateway';
import { InsightGateway } from '../../sidepanel/runtime/InsightGateway';
import { EventBusContract } from '../../core/event-bus/types';
import { SessionEvents } from '../../core/event-bus/registry';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { toSessionId } from '../../core/types/session.types';
import { ReadModelRepository } from '../../storage/repositories/ReadModelRepository';
import { SessionReadModel } from '../../storage/projections/builders/SessionProjectionBuilder';
import { InsightReadModel } from '../../storage/projections/builders/InsightProjectionBuilder';

const MOCK_PLATFORM = 'mock-harness';

export class LocalSessionGateway implements SessionCommandGateway, SessionQueryGateway {
  private activeSessionId: string | null = null;

  constructor(
    private readonly eventBus: EventBusContract,
    private readonly readModelRepo: ReadModelRepository
  ) {}

  public startSession(taskId: string | undefined, platform: string = MOCK_PLATFORM): void {
    const sessionId = toSessionId(crypto.randomUUID());
    this.activeSessionId = sessionId;

    const event = createDomainEvent(
      SessionEvents.STARTED,
      sessionId,
      'session-gateway',
      { platform, taskId }
    );

    this.eventBus.publish(SessionEvents.STARTED, event);
  }

  public endSession(reason: 'explicit' | 'tab_closed' | 'navigation' | 'timeout' = 'explicit'): void {
    if (!this.activeSessionId) return;

    const event = createDomainEvent(
      SessionEvents.ENDED,
      toSessionId(this.activeSessionId),
      'session-gateway',
      { reason }
    );

    this.eventBus.publish(SessionEvents.ENDED, event);
    this.activeSessionId = null;
  }

  public pauseSession(reason: 'explicit' | 'tab_hidden' | 'idle' = 'explicit'): void {
    if (!this.activeSessionId) return;
    const event = createDomainEvent(SessionEvents.PAUSED, toSessionId(this.activeSessionId), 'session-gateway', { reason });
    this.eventBus.publish(SessionEvents.PAUSED, event);
  }

  public resumeSession(pauseDurationMs: number): void {
    if (!this.activeSessionId) return;
    const event = createDomainEvent(SessionEvents.RESUMED, toSessionId(this.activeSessionId), 'session-gateway', { pauseDurationMs });
    this.eventBus.publish(SessionEvents.RESUMED, event);
  }

  public async getActiveSession(): Promise<SessionReadModel | null> {
    const all = await this.readModelRepo.getAllByPrefix<SessionReadModel>('session-v1_');
    const liveSession = all
      .filter((s) => s.status === 'active' || s.status === 'paused')
      .sort((a, b) => b.lastUpdated - a.lastUpdated)[0] ?? null;
    return liveSession;
  }

  public restoreSession(sessionId: string): void {
    this.activeSessionId = sessionId;
  }
}

export class LocalInsightGateway implements InsightGateway {
  constructor(private readonly readModelRepo: ReadModelRepository) {}

  public async getSessionInsights(sessionId: string): Promise<InsightReadModel | null> {
    const model = await this.readModelRepo.get<InsightReadModel>(`insight-v1_${sessionId}`);
    return model || null;
  }
}
