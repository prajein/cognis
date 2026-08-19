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
import { AdaptationPreferenceRepository } from '../storage/repositories/AdaptationPreferenceRepository';
import { RetentionRepository } from '../storage/repositories/RetentionRepository';
import { RetentionPolicy } from '../storage/retention/RetentionPolicy';
import { initializeRetentionScheduler } from './retention-scheduler';

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
import { ProgressQueryHandler } from './handlers/ProgressQueryHandler';
import { IdentityQueryHandler } from './handlers/IdentityQueryHandler';
import { GapProfileQueryHandler } from './handlers/GapProfileQueryHandler';
import { AdaptationQueryHandler } from './handlers/AdaptationQueryHandler';
import { SessionProfileUpdater } from './adaptation/SessionProfileUpdater';
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

  // Enable opening side panel when extension toolbar icon is clicked
  if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn('[Background] Failed to set sidePanel behavior:', err);
    });
  }

  // Initialize EventBridge in host mode (background script)
  const eventBridge = new ExtensionEventBridge(
    'background',
    eventBus,
    allEvents
  );

  eventBridge.initialize();

  try {
    // 1. Initialize Database with migrations
    const db = new CognisDatabase(migrations);
    await db.open();

    // 2. Initialize Repositories
    const eventRepo = new EventRepository(db);
    const profileRepo = new ProfileRepository(db);

    // 3. Start Subscriber
    const subscriber = new EventStoreSubscriber(
      eventBus,
      eventRepo,
      errorReporter
    );

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

    const projectionManager = new ProjectionManager(
      builders,
      eventBus,
      eventRepo,
      errorReporter
    );

    projectionManager.startLiveSubscriptions();

    // 5. Register background query handlers
    //    Each handler is a dedicated class; no query logic is inlined here.

    const sessionQueryHandler =
      new SessionQueryHandler(readModelRepo);

    sessionQueryHandler.register();

    const insightQueryHandler =
      new InsightQueryHandler(readModelRepo);

    insightQueryHandler.register();

    // Week 7 — Progress query handler
    const progressQueryHandler =
      new ProgressQueryHandler(readModelRepo);

    progressQueryHandler.register();

    // Identity/profile query handler
    const identityQueryHandler =
      new IdentityQueryHandler(profileRepo);

    identityQueryHandler.register();

    // Gap profile query handler
    const gapProfileQueryHandler =
      new GapProfileQueryHandler(readModelRepo);

    gapProfileQueryHandler.register();

    // Adaptation state query handler
    const adaptationQueryHandler =
      new AdaptationQueryHandler(profileRepo);

    adaptationQueryHandler.register();

    // 6. Start Engines
    const responseIntelligenceEngine =
      new ResponseIntelligenceEngine();

    responseIntelligenceEngine.start(eventBus);

    // 7. Start Insight Engine (Apex Reasoning Layer)
    const insightEngine =
      new InsightEngine();

    insightEngine.start(
      eventBus,
      readModelRepo
    );

    // 8. Start Adaptation loop
    const adaptationPrefRepo =
      new AdaptationPreferenceRepository(db);

    const ghostTextAdaptor =
      new GhostTextAdaptor(
        eventBus,
        adaptationPrefRepo
      );

    ghostTextAdaptor.start();

    const sessionProfileUpdater =
      new SessionProfileUpdater(
        profileRepo,
        readModelRepo,
        eventBus,
        errorReporter
      );

    sessionProfileUpdater.start();

    const identityProfileWriter =
      new IdentityProfileWriter(profileRepo);

    identityProfileWriter.start(eventBus);

    // 9. Start Retention Scheduler
    const retentionRepo = new RetentionRepository(db);
    const retentionPolicy = new RetentionPolicy(retentionRepo, eventBus, errorReporter);
    initializeRetentionScheduler(db, retentionPolicy);

    console.log(
      '[Background] Bootstrap complete. Cognis is active.'
    );
  } catch (error) {
    errorReporter.report(error, {
      eventType: 'system.bootstrap.failed',
      source: 'background',
    });
  }
}

// Start the background process
bootstrapBackground();