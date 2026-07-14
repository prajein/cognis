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
import { GapProfileProjectionBuilder } from '../storage/projections/builders/GapProfileProjectionBuilder';
import { IdentityProjectionBuilder } from '../storage/projections/builders/IdentityProjectionBuilder';
import { AutomaticityProjectionBuilder } from '../storage/projections/builders/AutomaticityProjectionBuilder';
import { ResponseMetricsProjectionBuilder } from '../storage/projections/builders/ResponseMetricsProjectionBuilder';

import {
  SessionEvents,
  PromptEvents,
  CognitiveEvents,
  GhostTextEvents,
  ResponseEvents,
  InsightEvents,
  HardwareEvents,
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
];

import { InsightEngine } from '../engines/insights/InsightEngine';

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

    // 2. Initialize Repository
    const eventRepo = new EventRepository(db);

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
      new ResponseMetricsProjectionBuilder(readModelRepo)
    ];
    const projectionManager = new ProjectionManager(builders, eventBus, eventRepo, errorReporter);
    projectionManager.startLiveSubscriptions();

    // 5. Start Insight Engine (Apex Reasoning Layer)
    const insightEngine = new InsightEngine();
    insightEngine.start(eventBus, readModelRepo);

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
