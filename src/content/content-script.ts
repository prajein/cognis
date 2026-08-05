import { EventBus } from '../core/event-bus/EventBus';
import { ExtensionEventBridge } from '../core/event-bus/ExtensionEventBridge';
import { ConsoleErrorReporter } from '../core/error/ConsoleErrorReporter';
import { PlatformManager } from '../platforms/manager/PlatformManager';
import { DomainEvent } from '../core/event-bus/contracts';
import {
  SessionEvents,
  PromptEvents,
  CognitiveEvents,
  ResponseEvents,
  EventType
} from '../core/event-bus/registry';

const eventsToBridge: EventType[] = [
  ...Object.values(PromptEvents),
  ...Object.values(ResponseEvents),
  ...Object.values(CognitiveEvents),
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

  const platformManager = new PlatformManager(eventBus);
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
