/// <reference types="chrome" />
/**
 * SessionGateway
 *
 * Concrete implementation of both SessionCommandGateway and SessionQueryGateway.
 * This is the transport boundary for all session operations in the sidepanel process.
 *
 * Architectural invariants:
 * - This is the ONLY file in the sidepanel that may call `chrome.runtime.sendMessage`
 *   or reference Chrome IPC APIs for session operations.
 * - Commands are converted into canonical DomainEvents and published to the local
 *   EventBus. ExtensionEventBridge transports them to the background automatically.
 * - Queries use chrome.runtime.sendMessage directly (request/response pattern).
 *   The gateway isolates this from all callers.
 * - The gateway is stateful: it tracks the active sessionId so that lifecycle
 *   commands (end, pause, resume) can associate events with the correct session.
 *   State is updated only after startSession() is called — never speculatively.
 */

import { SessionCommandGateway } from './SessionCommandGateway';
import { SessionQueryGateway } from './SessionQueryGateway';
import { EventBusContract } from '../../core/event-bus/types';
import { SessionEvents } from '../../core/event-bus/registry';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { toSessionId } from '../../core/types/session.types';
import {
  QueryActiveSessionRequest,
  QueryActiveSessionResponse,
} from '../../core/ipc/messages';
import { SessionReadModel } from '../../storage/projections/builders/SessionProjectionBuilder';

/** Timeout in ms before a background query is treated as a connectivity failure. */
const QUERY_TIMEOUT_MS = 5_000;

/** Platform tag recorded in `session.started` events from the sidepanel. */
const SIDEPANEL_PLATFORM = 'side-panel';

export class SessionGateway implements SessionCommandGateway, SessionQueryGateway {
  /**
   * The sessionId currently associated with the active session lifecycle.
   * Set by startSession(); cleared by endSession().
   * Null when no session has been started through this gateway instance.
   */
  private activeSessionId: string | null = null;

  constructor(private readonly eventBus: EventBusContract) {}

  // -------------------------------------------------------------------------
  // SessionCommandGateway — write path
  // -------------------------------------------------------------------------

  /**
   * Converts a startSession command into a `session.started` DomainEvent and
   * publishes it to the local EventBus (bridged to background by ExtensionEventBridge).
   *
   * Generates a new sessionId. The same id will appear in the authoritative
   * `session.started` event broadcast back from the background, allowing
   * useSession to confirm the transition.
   */
  public startSession(taskId: string | undefined, platform: string = SIDEPANEL_PLATFORM): void {
    const sessionId = toSessionId(crypto.randomUUID());
    this.activeSessionId = sessionId;

    const event = createDomainEvent(
      SessionEvents.STARTED,
      sessionId,
      'session-gateway',
      { platform, taskId }
    );

    this.eventBus.publish(SessionEvents.STARTED, event);
  }

  /**
   * Converts an endSession command into a `session.ended` DomainEvent.
   * No-op (with warning) if no session is currently active.
   */
  public endSession(reason: 'explicit' | 'tab_closed' | 'navigation' | 'timeout' = 'explicit'): void {
    console.log('[SessionGateway] endSession called. activeSessionId:', this.activeSessionId);
    if (!this.activeSessionId) {
      console.warn('[SessionGateway] endSession() called with no active session.');
      return;
    }

    const event = createDomainEvent(
      SessionEvents.ENDED,
      toSessionId(this.activeSessionId),
      'session-gateway',
      { reason }
    );

    console.log('[SessionGateway] Publishing session.ended event locally:', event.id);
    this.eventBus.publish(SessionEvents.ENDED, event);
    this.activeSessionId = null;
    console.log('[SessionGateway] activeSessionId cleared.');
  }

  /**
   * Converts a pauseSession command into a `session.paused` DomainEvent.
   * No-op (with warning) if no session is currently active.
   */
  public pauseSession(reason: 'explicit' | 'tab_hidden' | 'idle' = 'explicit'): void {
    if (!this.activeSessionId) {
      console.warn('[SessionGateway] pauseSession() called with no active session.');
      return;
    }

    const event = createDomainEvent(
      SessionEvents.PAUSED,
      toSessionId(this.activeSessionId),
      'session-gateway',
      { reason }
    );

    this.eventBus.publish(SessionEvents.PAUSED, event);
  }

  /**
   * Converts a resumeSession command into a `session.resumed` DomainEvent.
   * No-op (with warning) if no session is currently active.
   */
  public resumeSession(pauseDurationMs: number): void {
    if (!this.activeSessionId) {
      console.warn('[SessionGateway] resumeSession() called with no active session.');
      return;
    }

    const event = createDomainEvent(
      SessionEvents.RESUMED,
      toSessionId(this.activeSessionId),
      'session-gateway',
      { pauseDurationMs }
    );

    this.eventBus.publish(SessionEvents.RESUMED, event);
  }

  // -------------------------------------------------------------------------
  // SessionQueryGateway — read path
  // -------------------------------------------------------------------------

  /**
   * Sends a QUERY_ACTIVE_SESSION request to the background worker via
   * chrome.runtime.sendMessage and returns the active SessionReadModel or null.
   *
   * Rejects after QUERY_TIMEOUT_MS if the background does not respond.
   * bootstrap.ts catches this rejection and falls back to `connectionStatus: 'disconnected'`.
   */
  public getActiveSession(): Promise<SessionReadModel | null> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`[SessionGateway] getActiveSession() timed out after ${QUERY_TIMEOUT_MS}ms`));
      }, QUERY_TIMEOUT_MS);

      const request: QueryActiveSessionRequest = { type: 'QUERY_ACTIVE_SESSION' };

      chrome.runtime.sendMessage(request, (response: QueryActiveSessionResponse | undefined) => {
        clearTimeout(timeoutId);

        // Chrome sets runtime.lastError if the background is unreachable.
        if (chrome.runtime.lastError) {
          reject(new Error(`[SessionGateway] Chrome IPC error: ${chrome.runtime.lastError.message}`));
          return;
        }

        if (!response) {
          resolve(null);
          return;
        }

        if (response.error) {
          // The background handler returned a structured error. Treat as no session.
          console.warn('[SessionGateway] Background returned error:', response.error);
          resolve(null);
          return;
        }

        resolve(response.session);
      });
    });
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Called by bootstrap.ts when a previously active session is restored from
   * the hydrated SessionReadModel. Allows the gateway to attach subsequent
   * lifecycle commands (end, pause, resume) to the restored session.
   */
  public restoreSession(sessionId: string): void {
    this.activeSessionId = sessionId;
  }
}
