/**
 * Sidepanel Runtime Bootstrap
 *
 * The composition root for the sidepanel process.
 * Instantiates infrastructure (EventBus, ExtensionEventBridge, SessionGateway),
 * hydrates initial state from the background, and returns a frozen SidepanelContainer.
 *
 * Architectural invariants:
 * - This is the ONLY place that `new EventBus()`, `new ExtensionEventBridge()`,
 *   and `new SessionGateway()` are called in the sidepanel process.
 * - Called ONCE in main.tsx before React renders any session-dependent UI.
 * - Returns a frozen container so no consumer can mutate service references.
 * - If background hydration times out or fails, the runtime still boots
 *   (with `activeSession: null`, `connectionStatus: 'disconnected'`).
 *   React renders a loading/disconnected shell; it does NOT block paint.
 *
 * Transport choice:
 * - The default Transport is ExtensionEventBridge (Chrome IPC via a persistent port).
 * - This choice is made here and nowhere else. Swapping transport means only
 *   changing this file.
 */

import { EventBus } from '../../core/event-bus/EventBus';
import { ExtensionEventBridge } from '../../core/event-bus/ExtensionEventBridge';
import { ConsoleErrorReporter } from '../../core/error/ConsoleErrorReporter';
import { SessionGateway } from './SessionGateway';
import { SessionManager } from '../features/session/manager/SessionManager';
import { SessionService } from './container';
import type { SidepanelContainer, ConnectionStatus } from './container';
import {
  SessionEvents,
  PromptEvents,
  CognitiveEvents,
  GhostTextEvents,
  ResponseEvents,
  InsightEvents,
  HardwareEvents,
  EventType,
} from '../../core/event-bus/registry';

/** All event types the sidepanel bridge should relay to the local EventBus. */
const BRIDGED_EVENTS: EventType[] = [
  ...Object.values(SessionEvents),
  ...Object.values(PromptEvents),
  ...Object.values(CognitiveEvents),
  ...Object.values(GhostTextEvents),
  ...Object.values(ResponseEvents),
  ...Object.values(InsightEvents),
  ...Object.values(HardwareEvents),
];

/**
 * Bootstraps the sidepanel runtime and returns a frozen SidepanelContainer.
 *
 * @returns A promise that always resolves — never rejects.
 *          If background hydration fails, `runtimeState` reflects the failure.
 */
export async function bootstrapSidepanelRuntime(): Promise<SidepanelContainer> {
  // 1. Create the sidepanel-scoped EventBus.
  //    One instance per sidepanel lifecycle. Never shared with content scripts
  //    or background — each process has its own bus.
  const errorReporter = new ConsoleErrorReporter();
  const eventBus = new EventBus(errorReporter);

  // 2. Instantiate and initialize the Transport (ExtensionEventBridge in 'side-panel' mode).
  //    This opens a persistent chrome.runtime.connect port to the background host,
  //    subscriptions and bridging begin immediately after initialize().
  const bridge = new ExtensionEventBridge('side-panel', eventBus, BRIDGED_EVENTS);
  bridge.initialize();

  // 3. Instantiate the SessionGateway (command + query facade over the transport).
  const gateway = new SessionGateway(eventBus);

  // 4. Instantiate SessionManager and build the SessionService facade.
  //    SessionService delegates user-intent lifecycle methods to SessionManager,
  //    which enforces state machine invariants before dispatching via SessionGateway.
  const sessionManager = new SessionManager(gateway);

  const sessionService: SessionService = {
    startSession: (taskId: string) => {
      sessionManager.selectTask(taskId);
      sessionManager.startSession();
    },
    endSession: () => sessionManager.endSession(),
    pauseSession: () => sessionManager.pauseSession(),
    resumeSession: () => sessionManager.resumeSession(),
  };

  // 5. Hydrate initial state from the background.
  //    Performed before React renders so the first render has real data.
  //    The gateway's getActiveSession() rejects on timeout; we catch here
  //    to ensure bootstrap always succeeds.
  let activeSession = null;
  let connectionStatus: ConnectionStatus = 'connected';

  try {
    activeSession = await gateway.getActiveSession();

    // If a session was restored, reattach the gateway's internal sessionId
    // and synchronize SessionManager so subsequent lifecycle commands reference
    // the restored session.
    if (activeSession) {
      gateway.restoreSession(activeSession.sessionId);
      sessionManager.restoreSession(activeSession.taskId ?? 'restored-task');
    }
  } catch (error) {
    console.warn(
      '[SidepanelRuntime] Background hydration failed — rendering disconnected state.',
      error
    );
    connectionStatus = 'disconnected';
  }

  // 6. Return a frozen container. Object.freeze() prevents consumer code from
  //    accidentally replacing service references after bootstrap.
  const container: SidepanelContainer = Object.freeze({
    sessionService,
    eventBus,
    runtimeState: Object.freeze({
      activeSession,
      connectionStatus,
    }),
  });

  console.log(
    `[SidepanelRuntime] Bootstrap complete. Session: ${activeSession?.sessionId ?? 'none'}. Status: ${connectionStatus}.`
  );

  return container;
}
