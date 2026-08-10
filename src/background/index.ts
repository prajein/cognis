import { EventBus } from '../core/event-bus/EventBus';
import { ExtensionEventBridge } from '../core/event-bus/ExtensionEventBridge';
import { ConsoleErrorReporter } from '../core/error/ConsoleErrorReporter';
import { CognisDatabase } from '../storage/indexeddb/CognisDatabase';
import { EventRepository } from '../storage/repositories/EventRepository';
import { EventStoreSubscriber } from '../storage/indexeddb/EventStoreSubscriber';
import { migrations } from '../storage/migrations';
import { ReadModelRepository } from '../storage/repositories/ReadModelRepository';
import { ProjectionManager } from '../storage/projections/ProjectionManager';
import { SessionProjectionBuilder } from '../storage/projections/builders/SessionProjectionBuilder';
import { ProfileRepository } from '../storage/repositories/ProfileRepository';
import { GapProfileProjectionBuilder } from '../storage/projections/builders/GapProfileProjectionBuilder';
import { IdentityProjectionBuilder } from '../storage/projections/builders/IdentityProjectionBuilder';
import { AutomaticityProjectionBuilder } from '../storage/projections/builders/AutomaticityProjectionBuilder';
import { ResponseMetricsProjectionBuilder } from '../storage/projections/builders/ResponseMetricsProjectionBuilder';
import { InsightProjectionBuilder } from '../storage/projections/builders/InsightProjectionBuilder';

import {
  SessionEvents,
  PromptEvents,
  CognitiveEvents,
  GhostTextEvents,
  ResponseEvents,
  InsightEvents,
  HardwareEvents,
  AdaptationEvents,
  IdentityEvents,
  EventType
} from '../core/event-bus/registry';

const allEvents: EventType[] = [
  ...Object.values(SessionEvents),
  ...Object.values(PromptEvents),
  ...Object.values(CognitiveEvents),
  ...Object.values(GhostTextEvents),
  ...Object.values(ResponseEvents),
  ...Object.values(InsightEvents),
  ...Object.values(HardwareEvents),
  ...Object.values(AdaptationEvents),
  ...Object.values(IdentityEvents),
];

import { InsightEngine } from '../engines/insights/InsightEngine';
import { ResponseIntelligenceEngine } from '../engines/response/ResponseIntelligenceEngine';
import { SessionQueryHandler } from './handlers/SessionQueryHandler';
import { InsightQueryHandler } from './handlers/InsightQueryHandler';
import { IdentityQueryHandler } from './handlers/IdentityQueryHandler';
import { GhostTextAdaptor } from './adaptation/GhostTextAdaptor';
import { IdentityProfileWriter } from '../engines/identity/IdentityProfileWriter';

/**
 * Background Service Worker Composition Root
 *
 * Bootstraps the EventBus in "host" mode, establishes the database
 * connection, and spins up the EventStoreSubscriber and Insight Engine.
 */
async function bootstrapBackground(): Promise<void> {
  const errorReporter = new ConsoleErrorReporter();
  const eventBus = new EventBus(errorReporter);

  // Initialize EventBridge in host mode (background script)
  const eventBridge = new ExtensionEventBridge('background', eventBus, allEvents);
  eventBridge.initialize();

  try {
    // 1. Initialize Database with migrations
    const db = new CognisDatabase(migrations);
    await db.open();

    // 2. Initialize Repositories
    const eventRepo = new EventRepository(db);
    const profileRepo = new ProfileRepository(db);

    // 3. Start Subscriber
    const subscriber = new EventStoreSubscriber(eventBus, eventRepo, errorReporter);
    subscriber.subscribeToAll();

    // 4. Initialize Projections
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

    // 5. Register background query handlers
    //    Each handler is a dedicated class; no query logic is inlined here.
    const sessionQueryHandler = new SessionQueryHandler(readModelRepo);
    sessionQueryHandler.register();

    const insightQueryHandler = new InsightQueryHandler(readModelRepo);
    insightQueryHandler.register();

    const identityQueryHandler = new IdentityQueryHandler(profileRepo);
    identityQueryHandler.register();

    // 6. Start Engines
    const responseIntelligenceEngine = new ResponseIntelligenceEngine();
    responseIntelligenceEngine.start(eventBus);

    const insightEngine = new InsightEngine();
    insightEngine.start(eventBus, readModelRepo);

    // 7. Start Adaptation loop
    const ghostTextAdaptor = new GhostTextAdaptor(eventBus);
    ghostTextAdaptor.start();

    const identityProfileWriter = new IdentityProfileWriter(profileRepo);
    identityProfileWriter.start(eventBus);

    console.log('[Background] Bootstrap complete. Cognis is active.');
  } catch (error) {
    errorReporter.report(error, {
      eventType: 'system.bootstrap.failed',
      source: 'background',
    });
  }
}

// Start the background process
bootstrapBackground();
