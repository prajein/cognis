import { EventBus } from '../core/event-bus/EventBus';
import { ExtensionEventBridge } from '../core/event-bus/ExtensionEventBridge';
import { ConsoleErrorReporter } from '../core/error/ConsoleErrorReporter';
import { PlatformManager } from '../platforms/manager/PlatformManager';
import { GapDetectionEngine } from '../engines/gap/GapDetectionEngine';
import { GhostTextEngine } from '../engines/ghosttext/GhostTextEngine';
import { StateEngine } from '../engines/state/StateEngine';
import { EnrichmentEngine } from '../engines/enrichment/EnrichmentEngine';
import { DomainEvent } from '../core/event-bus/contracts';
import {
  SessionEvents,
  PromptEvents,
  CognitiveEvents,
  ResponseEvents,
  GhostTextEvents,
  EventType
} from '../core/event-bus/registry';

const eventsToBridge: EventType[] = [
  ...Object.values(PromptEvents),
  ...Object.values(ResponseEvents),
  ...Object.values(CognitiveEvents),
  ...Object.values(GhostTextEvents),
  SessionEvents.PAUSED,
  SessionEvents.RESUMED
];

function bootstrapContentScript(): void {
  if (!window.location.hostname.includes('chatgpt.com')) {
    console.warn('[Cognis] Content script loaded on unsupported domain:', window.location.hostname);
    return;
  }

  const errorReporter = new ConsoleErrorReporter();
  const eventBus = new EventBus(errorReporter);
  
  const eventBridge = new ExtensionEventBridge('content-script', eventBus, eventsToBridge);
  eventBridge.initialize();

  const gapEngine = new GapDetectionEngine(eventBus);
  gapEngine.start();

  const ghostEngine = new GhostTextEngine(eventBus);
  ghostEngine.start();

  const stateEngine = new StateEngine(eventBus);
  stateEngine.start();

  const enrichmentEngine = new EnrichmentEngine(eventBus);
  enrichmentEngine.start();

  const platformManager = new PlatformManager(eventBus, gapEngine, enrichmentEngine);
  platformManager.prepareAdapter(window.location.href);

  eventBus.subscribe(SessionEvents.STARTED, (event: DomainEvent<any>) => {
    console.log('[Cognis] Authoritative session started received in content script:', event.payload);
    platformManager.beginObservation(event.sessionId);
  });

  eventBus.subscribe(SessionEvents.ENDED, (event: DomainEvent<any>) => {
    console.log('[Cognis] Authoritative session ended received in content script:', event.payload);
    platformManager.endObservation();
  });

  console.log('[Cognis] Content script initialized. Platform Ready.');
}

bootstrapContentScript();
