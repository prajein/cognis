import { EventBus } from '../core/event-bus/EventBus';
import { ExtensionEventBridge } from '../core/event-bus/ExtensionEventBridge';
import { ConsoleErrorReporter } from '../core/error/ConsoleErrorReporter';
import { GapDetectionEngine } from '../engines/gap/GapDetectionEngine';
import { ContentScriptEnricher } from './ContentScriptEnricher';
import { EnrichmentEngine } from '../engines/enrichment/EnrichmentEngine';
import { GhostTextEngine } from '../engines/ghosttext/GhostTextEngine';
import { StateEngine } from '../engines/state/StateEngine';
import { PlatformManager } from '../platforms/manager/PlatformManager';
import { QueryAdaptationStateRequest, QueryAdaptationStateResponse } from '../core/ipc/messages';
import { DomainEvent, SessionStartedPayload } from '../core/event-bus/contracts';
import { GapType } from '../core/types/gap.types';
import { SessionId, toEventId, toTimestamp } from '../core/types/session.types';

import {
  SessionEvents,
  PromptEvents,
  CognitiveEvents,
  GhostTextEvents,
  ResponseEvents,
  InsightEvents,
  HardwareEvents,
  AdaptationEvents,
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

    const pureEngine = new EnrichmentEngine();
    const enrichmentEngine = new ContentScriptEnricher(eventBus, pureEngine, 1500);
    enrichmentEngine.start();

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

    // 2. Hydration Logic (Week 4)
    let localSessionId: SessionId | null = null;
    let hydratedSuppressedGaps: GapType[] | null = null;
    let hydrationEmitted = false;

    const tryHydrate = () => {
      if (hydrationEmitted || !localSessionId || !hydratedSuppressedGaps) {
        return;
      }
      hydrationEmitted = true;

      for (const gapType of hydratedSuppressedGaps) {
        eventBus.publish(AdaptationEvents.CONFIGURED, {
          id: toEventId(`hyd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
          type: AdaptationEvents.CONFIGURED,
          timestamp: toTimestamp(Date.now()),
          sessionId: localSessionId,
          source: 'hydration',
          payload: {
            targetModule: 'ghosttext',
            gapType,
            action: 'suppress',
            reasoning: 'Longitudinal transfer policy hydrated from profile'
          }
        });
      }
    };

    // Listen for the local session start
    eventBus.subscribe(SessionEvents.STARTED, (event: DomainEvent<any>) => {
      localSessionId = event.sessionId;
      tryHydrate();
    });

    // Fire the IPC query
    const request: QueryAdaptationStateRequest = { type: 'QUERY_ADAPTATION_STATE' };
    chrome.runtime.sendMessage(request, (response: QueryAdaptationStateResponse | undefined) => {
      if (chrome.runtime.lastError) {
        console.warn('[Content Script] Hydration IPC failed:', chrome.runtime.lastError);
        hydratedSuppressedGaps = [];
      } else if (response) {
        hydratedSuppressedGaps = response.suppressedGaps || [];
      } else {
        hydratedSuppressedGaps = [];
      }
      tryHydrate();
    });

    // 3. Initialize Platform Adapter Wiring
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
