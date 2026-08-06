import { EventBus } from '../../core/event-bus/EventBus';
import { ConsoleErrorReporter } from '../../core/error/ConsoleErrorReporter';
import { CognisDatabase } from '../../storage/indexeddb/CognisDatabase';
import { EventRepository } from '../../storage/repositories/EventRepository';
import { EventStoreSubscriber } from '../../storage/indexeddb/EventStoreSubscriber';
import { migrations } from '../../storage/migrations';
import { ReadModelRepository } from '../../storage/repositories/ReadModelRepository';
import { ProjectionManager } from '../../storage/projections/ProjectionManager';
import { SessionProjectionBuilder } from '../../storage/projections/builders/SessionProjectionBuilder';
import { GapProfileProjectionBuilder } from '../../storage/projections/builders/GapProfileProjectionBuilder';
import { IdentityProjectionBuilder } from '../../storage/projections/builders/IdentityProjectionBuilder';
import { AutomaticityProjectionBuilder } from '../../storage/projections/builders/AutomaticityProjectionBuilder';
import { ResponseMetricsProjectionBuilder } from '../../storage/projections/builders/ResponseMetricsProjectionBuilder';
import { InsightProjectionBuilder } from '../../storage/projections/builders/InsightProjectionBuilder';
import { InsightEngine } from '../../engines/insights/InsightEngine';
import { ResponseIntelligenceEngine } from '../../engines/response/ResponseIntelligenceEngine';
import { LocalSessionGateway, LocalInsightGateway } from './gateways';
import { SessionManager } from '../../sidepanel/features/session/manager/SessionManager';
import { SessionService, SidepanelContainer, ConnectionStatus } from '../../sidepanel/runtime/container';
import { MockHarness } from '../../mock/harness/MockHarness';
import { ScenarioPlayer } from './ScenarioPlayer';

/**
 * Bootstraps the Mock Runtime.
 * 
 * Instantiates the EventBus, Storage, Projection Builders, Engines, and Gateways
 * entirely within the local browser tab without relying on a background worker.
 * Returns the identical SidepanelContainer interface as the Live Runtime, proving
 * that everything below the EventBus is runtime-agnostic.
 * 
 * Also returns the ScenarioPlayer so the Demo UI can trigger scripts.
 */
export async function bootstrapMockRuntime(): Promise<{
  container: SidepanelContainer;
  player: ScenarioPlayer;
}> {
  const errorReporter = new ConsoleErrorReporter();
  const eventBus = new EventBus(errorReporter);

  // 1. Initialize Storage
  // We use a separate IndexedDB name for mock to avoid polluting real production data.
  const db = new CognisDatabase(migrations, 'cognis_mock_db');
  await db.open();

  // 2. Initialize Repository & Subscriber
  const eventRepo = new EventRepository(db);
  const subscriber = new EventStoreSubscriber(eventBus, eventRepo, errorReporter);
  subscriber.subscribeToAll();

  // 3. Initialize Projections
  const readModelRepo = new ReadModelRepository(db);
  const builders = [
    new SessionProjectionBuilder(readModelRepo),
    new GapProfileProjectionBuilder(readModelRepo),
    new IdentityProjectionBuilder(readModelRepo),
    new AutomaticityProjectionBuilder(readModelRepo),
    new ResponseMetricsProjectionBuilder(readModelRepo),
    new InsightProjectionBuilder(readModelRepo)
  ];
  const projectionManager = new ProjectionManager(builders, eventBus, eventRepo, errorReporter);
  projectionManager.startLiveSubscriptions();

  // 4. Start Engines
  const responseIntelligenceEngine = new ResponseIntelligenceEngine();
  responseIntelligenceEngine.start(eventBus);

  const insightEngine = new InsightEngine();
  insightEngine.start(eventBus, readModelRepo);

  // 5. Initialize Gateways (Local implementation for mock)
  const sessionGateway = new LocalSessionGateway(eventBus, readModelRepo);
  const insightGateway = new LocalInsightGateway(readModelRepo);

  // 6. Session Manager & Service
  const sessionManager = new SessionManager(sessionGateway);
  const sessionService: SessionService = {
    startSession: (taskId: string) => {
      sessionManager.selectTask(taskId);
      sessionManager.startSession();
    },
    endSession: () => sessionManager.endSession(),
    pauseSession: () => sessionManager.pauseSession(),
    resumeSession: () => sessionManager.resumeSession(),
  };

  // 7. Hydrate initial state
  let activeSession = null;
  let connectionStatus: ConnectionStatus = 'connected';
  const platform = 'mock-harness';
  const isStreaming = false;

  try {
    activeSession = await sessionGateway.getActiveSession();
    if (activeSession) {
      sessionGateway.restoreSession(activeSession.sessionId);
      sessionManager.restoreSession(activeSession.taskId ?? 'restored-task');
    }
  } catch (error) {
    console.warn('[MockRuntime] Hydration failed', error);
    connectionStatus = 'disconnected';
  }

  // 8. Prepare Mock Harness & Scenario Player
  // We wrap the event bus for the harness so that any event it generates is treated
  // as authoritative and remote, mimicking the behavior of ExtensionEventBridge 
  // receiving events from the background script.
  const harnessEventBus = {
    publish: (type: any, event: any) => {
      eventBus.publish(type, { ...event, isAuthoritative: true, origin: 'remote' });
    },
    subscribe: eventBus.subscribe.bind(eventBus)
  };
  
  const harness = new MockHarness(harnessEventBus, { platform });
  const player = new ScenarioPlayer(harness);

  const container: SidepanelContainer = Object.freeze({
    sessionService,
    eventBus,
    insightGateway,
    runtimeState: Object.freeze({
      activeSession,
      connectionStatus,
      platform,
      isStreaming
    }),
  });

  console.log(`[MockRuntime] Bootstrap complete. Session: ${activeSession?.sessionId ?? 'none'}.`);

  return { container, player };
}
