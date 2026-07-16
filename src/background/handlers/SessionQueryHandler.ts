/// <reference types="chrome" />
import { ReadModelRepository } from '../../storage/repositories/ReadModelRepository';
import { SessionReadModel } from '../../storage/projections/builders/SessionProjectionBuilder';
import {
  QueryActiveSessionRequest,
  QueryActiveSessionResponse,
} from '../../core/ipc/messages';

/**
 * SessionQueryHandler
 *
 * Dedicated background-side handler for session read-model queries.
 * Registered against chrome.runtime.onMessage by the background composition root.
 *
 * Architectural invariant:
 * - This class owns ALL session query logic. background/index.ts must never
 *   inline query reads directly; it only delegates to this handler.
 * - This is the symmetric counterpart to SessionQueryGateway in the sidepanel.
 *   Gateway (sidepanel) ↔ Handler (background).
 * - The handler does NOT modify state. It is a pure read path.
 */
export class SessionQueryHandler {
  /** Prefix used by SessionProjectionBuilder for all session projection IDs. */
  private static readonly SESSION_PREFIX = 'session-v1_';

  constructor(private readonly readModelRepo: ReadModelRepository) {}

  /**
   * Registers this handler with the Chrome runtime message listener.
   *
   * Must be called once during background bootstrap, after the database is open.
   * Returns an unregister function for symmetrical teardown (useful in tests).
   */
  public register(): () => void {
    const listener = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: QueryActiveSessionResponse) => void
    ): boolean | undefined => {
      if (!this.isQueryActiveSessionRequest(message)) {
        // Not our message — let other listeners handle it.
        return undefined;
      }

      // Handle asynchronously; return true to keep the message channel open
      // until sendResponse is called (Chrome requirement).
      this.handleQueryActiveSession()
        .then(sendResponse)
        .catch((error) => {
          console.error('[SessionQueryHandler] Unexpected error:', error);
          sendResponse({
            session: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });

      return true;
    };

    chrome.runtime.onMessage.addListener(listener);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }

  /**
   * Reads all session projections and returns the most recently updated
   * session that is currently active or paused.
   *
   * An 'active' or 'paused' session is returned in preference to an 'ended'
   * one, sorted by `lastUpdated` descending so the most recent state wins
   * in cases where multiple partial sessions exist in the store.
   */
  private async handleQueryActiveSession(): Promise<QueryActiveSessionResponse> {
    const all = await this.readModelRepo.getAllByPrefix<SessionReadModel>(
      SessionQueryHandler.SESSION_PREFIX
    );

    const liveSession = all
      .filter((s) => s.status === 'active' || s.status === 'paused')
      .sort((a, b) => b.lastUpdated - a.lastUpdated)[0] ?? null;

    return { session: liveSession };
  }

  private isQueryActiveSessionRequest(
    message: unknown
  ): message is QueryActiveSessionRequest {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as QueryActiveSessionRequest).type === 'QUERY_ACTIVE_SESSION'
    );
  }
}
