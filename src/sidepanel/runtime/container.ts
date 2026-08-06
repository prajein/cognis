/**
 * Sidepanel Container
 *
 * Defines the service interfaces and the container shape that the
 * SidepanelRuntime composition root (`bootstrap.ts`) returns.
 *
 * Architectural invariants:
 * - Hooks and React components ONLY interact with types from this file.
 *   They never import EventBus (concrete), ExtensionEventBridge,
 *   SessionGateway, or anything from src/core/event-bus directly.
 * - `eventBus` is typed as `EventBusContract` (interface), not `EventBus`
 *   (class). This keeps the UI layer free of infrastructure coupling.
 * - `runtimeState` is a snapshot captured at bootstrap time. Real-time
 *   updates arrive via `eventBus` subscriptions; there is no polling.
 */

import { EventBusContract } from '../../core/event-bus/types';
import { SessionReadModel } from '../../storage/projections/builders/SessionProjectionBuilder';
import { InsightGateway } from './InsightGateway';

// ---------------------------------------------------------------------------
// SessionService — UI-facing façade
// ---------------------------------------------------------------------------

/**
 * The interface that React hooks call to perform session lifecycle actions.
 *
 * SessionService is intentionally thin: it exposes user-intent methods and
 * delegates domain validation to SessionManager and command dispatch to
 * SessionCommandGateway. No business logic lives here.
 *
 * Naming reflects user intent (startSession, endSession) rather than
 * infrastructure mechanics (publish, dispatch).
 */
export interface SessionService {
  /**
   * Start a new session for the given task.
   * Returns the generated sessionId so callers can associate it if needed.
   * The UI must NOT transition to SESSION_ACTIVE until the authoritative
   * `session.started` event is received from the background.
   */
  startSession(taskId: string): void;

  /** End the current active session. */
  endSession(): void;

  /** Pause the current active session. */
  pauseSession(): void;

  /** Resume a paused session. */
  resumeSession(): void;
}

// ---------------------------------------------------------------------------
// RuntimeState — point-in-time snapshot at bootstrap
// ---------------------------------------------------------------------------

/**
 * Connection status of the sidepanel Transport to the background worker.
 * - `connected`     Bridge port is open and background is reachable.
 * - `reconnecting`  Port dropped; automatic reconnect in progress.
 * - `disconnected`  Background unreachable after retries. UI shows error state.
 */
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

// ---------------------------------------------------------------------------
// SidepanelContainer — the composition root output
// ---------------------------------------------------------------------------

/**
 * RuntimeState
 * 
 * Snapshot of the current sidepanel context and state.
 */
export interface RuntimeState {
  readonly activeSession: SessionReadModel | null;
  readonly isStreaming: boolean;
  readonly platform: string;
  readonly connectionStatus: ConnectionStatus;
}

/**
 * The frozen container returned by `bootstrapSidepanelRuntime()`.
 *
 * React components access services and state exclusively through this object.
 * Infrastructure (EventBus impl, ExtensionEventBridge, SessionGateway) is
 * accessible only via the interfaces exposed here.
 *
 * `Object.freeze()` is applied by `bootstrap.ts` so no consumer can mutate
 * or reassign container properties at runtime.
 */
export interface SidepanelContainer {
  /**
   * The UI-facing session service. Hooks call this for user-initiated
   * lifecycle actions (start, end, pause, resume).
   */
  readonly sessionService: SessionService;

  /**
   * The local sidepanel EventBus (typed as the contract interface).
   * Hooks subscribe to this to receive authoritative events broadcast
   * from the background (session lifecycle changes, insight updates, etc.).
   *
   * Hooks MUST use this for subscriptions. They must never import EventBus directly.
   */
  readonly eventBus: EventBusContract;

  /**
   * Gateway for querying insights from the background.
   */
  readonly insightGateway: InsightGateway;

  /**
   * Snapshot captured at bootstrap and updated via hooks.
   */
  readonly runtimeState: RuntimeState;
}
