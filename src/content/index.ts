import { EventBus } from '../core/event-bus/EventBus';
import { ExtensionEventBridge } from '../core/event-bus/ExtensionEventBridge';
import { ConsoleErrorReporter } from '../core/error/ConsoleErrorReporter';
import { GapDetectionEngine } from '../engines/gap/GapDetectionEngine';
import { EnrichmentEngine } from '../engines/enrichment/EnrichmentEngine';
import { ResponseIntelligenceEngine } from '../engines/response/ResponseIntelligenceEngine';
import { GhostTextEngine } from '../engines/ghosttext/GhostTextEngine';
import { StateEngine } from '../engines/state/StateEngine';
import { PlatformManager } from '../platforms/manager/PlatformManager';

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

/**
 * Content Script Composition Root
 *
 * Bootstraps the EventBus in "client" mode, instantiates domain engines
 * that require synchronous transient text (like Gap Detection), and
 * initializes the PlatformManager.
 */
function bootstrapContentScript(): void {
  const errorReporter = new ConsoleErrorReporter();
  
  try {
    const eventBus = new EventBus(errorReporter);

    // Initialize EventBridge in client mode (content script)
    const eventBridge = new ExtensionEventBridge('content-script', eventBus, allEvents);
    eventBridge.initialize();

    // 1. Initialize Engines
    const gapEngine = new GapDetectionEngine(eventBus);
    gapEngine.start();

    const ghostEngine = new GhostTextEngine(eventBus);
    ghostEngine.start();

    const enrichmentEngine = new EnrichmentEngine(eventBus);
    enrichmentEngine.start();

    const responseEngine = new ResponseIntelligenceEngine();
    responseEngine.start(eventBus);

    const stateEngine = new StateEngine(eventBus);
    stateEngine.start();

    // Development Mode Diagnostics
    // @ts-ignore: Injected by bundler
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      // @ts-ignore: Injected by bundler
      const { EventTraceValidator } = require('../engines/diagnostics/EventTraceValidator');
      const validator = new EventTraceValidator(eventBus);
      validator.start();
    }

    // 2. Initialize Platform Adapter Wiring
    const platformManager = new PlatformManager(eventBus, gapEngine);
    platformManager.prepareAdapter(window.location.href);

    console.log('[Content Script] Bootstrap complete. Cognis Surface A is active.');
  } catch (error) {
    errorReporter.report(error, {
      eventType: 'system.bootstrap.failed',
      source: 'content-script',
    });
  }
}

// Start the content script process
bootstrapContentScript();
