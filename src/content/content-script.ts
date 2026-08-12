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
  AdaptationEvents,
  EventType
} from '../core/event-bus/registry';
import { toSessionId } from '../core/types/session.types';

const eventsToBridge: EventType[] = [
  ...Object.values(PromptEvents),
  ...Object.values(ResponseEvents),
  ...Object.values(CognitiveEvents),
  ...Object.values(GhostTextEvents),
  ...Object.values(AdaptationEvents),
  SessionEvents.PAUSED,
  SessionEvents.RESUMED
];

import {
  QueryActiveSessionRequest,
  QueryActiveSessionResponse,
  QueryIdentityProfileRequest,
  QueryIdentityProfileResponse,
  QuerySessionGapsRequest,
  QuerySessionGapsResponse
} from '../core/ipc/messages';

async function bootstrapContentScript(): Promise<void> {
  const hostname = window.location.hostname;
  if (!hostname.includes('chatgpt.com') && !hostname.includes('claude.ai')) {
    console.warn('[Cognis] Content script loaded on unsupported domain:', hostname);
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

  // Deterministic Asynchronous Bootstrap Sequence
  const activeSessionReq: QueryActiveSessionRequest = { type: 'QUERY_ACTIVE_SESSION' };
  const sessionRes = await new Promise<QueryActiveSessionResponse>((resolve) =>
    chrome.runtime.sendMessage(activeSessionReq, resolve)
  );

  let identityProfile = undefined;
  let initialActiveGaps = undefined;
  const activeSessionId = sessionRes?.session?.sessionId;

  if (activeSessionId) {
    const identityReq: QueryIdentityProfileRequest = { type: 'QUERY_IDENTITY_PROFILE' };
    const gapsReq: QuerySessionGapsRequest = { type: 'QUERY_SESSION_GAPS', sessionId: activeSessionId };

    const [identityRes, gapsRes] = await Promise.all([
      new Promise<QueryIdentityProfileResponse>((resolve) => chrome.runtime.sendMessage(identityReq, resolve)),
      new Promise<QuerySessionGapsResponse>((resolve) => chrome.runtime.sendMessage(gapsReq, resolve))
    ]);

    if (!chrome.runtime.lastError) {
      if (identityRes?.onboarding) {
        identityProfile = identityRes.onboarding;
      }
      if (gapsRes?.gapProfile?.gaps) {
        initialActiveGaps = Object.keys(gapsRes.gapProfile.gaps) as any[];
      }
    }
  }

  const enrichmentEngine = new EnrichmentEngine(eventBus, {
    identityProfile,
    initialActiveGaps
  });
  enrichmentEngine.start();

  const platformManager = new PlatformManager(eventBus, gapEngine, enrichmentEngine);
  platformManager.prepareAdapter(window.location.href);

  // If a session was already active (e.g. from a page reload), begin observation immediately
  if (activeSessionId) {
    console.log('[Cognis] Recovered active session:', activeSessionId);
    platformManager.beginObservation(toSessionId(activeSessionId));
  }

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

bootstrapContentScript().catch(err => console.error('[Cognis] Bootstrap failed', err));
