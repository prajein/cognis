/**
 * SessionQueryGateway
 *
 * Contract for the query side of the background → sidepanel session bridge.
 *
 * Architectural invariants:
 * - This interface has NO write / command methods. It is read-only.
 * - Implementors delegate queries to the background worker via Transport and
 *   return the result. They do not touch IndexedDB directly.
 * - Queries are point-in-time reads. Real-time synchronization is handled
 *   separately via EventBus subscriptions in the session service layer.
 *
 * Callers (bootstrap.ts, SessionService) depend on this interface,
 * never on a concrete class. Transport is an implementation detail.
 */

import { SessionReadModel } from '../../storage/projections/builders/SessionProjectionBuilder';

export interface SessionQueryGateway {
  /**
   * Retrieves the currently active or paused session from the background
   * read-model store.
   *
   * Resolution semantics:
   * - Returns the most recently updated session with status 'active' or 'paused'.
   * - Returns `null` if no such session exists (e.g. on first launch, or after
   *   all sessions have ended).
   * - Rejects if the Transport cannot reach the background within the
   *   implementation's configured timeout. Callers should treat a rejection
   *   as a connectivity failure and render a disconnected state rather than
   *   propagating the error to the user.
   */
  getActiveSession(): Promise<SessionReadModel | null>;
}
