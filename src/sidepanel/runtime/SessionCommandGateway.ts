/**
 * SessionCommandGateway
 *
 * Contract for the command side of the sidepanel → background session bridge.
 *
 * Architectural invariants:
 * - This interface has NO read / query methods. It is write-only.
 * - Implementors convert method calls into canonical DomainEvents and
 *   transport them to the background. They do not mutate local state.
 * - The sidepanel UI MUST NOT assume any state change has occurred after
 *   calling these methods. State transitions only happen once the
 *   authoritative event is received back from the background projection.
 *
 * Callers (SessionManager) depend on this interface, never on a concrete class.
 * This allows the underlying transport (Chrome IPC, MessagePort, WebSocket, etc.)
 * to be swapped without touching domain or UI code.
 */
export interface SessionCommandGateway {
  /**
   * Dispatches a command to start a new session.
   *
   * @param taskId  The task the user selected. Optional — content-script
   *                sessions started by the platform adapter do not carry a task.
   * @param platform  The process context originating the command (e.g. 'side-panel').
   */
  startSession(taskId: string | undefined, platform: string): void;

  /**
   * Dispatches a command to end the current active session.
   *
   * @param reason  Why the session is ending (matches SessionEndedPayload.reason).
   */
  endSession(reason: 'explicit' | 'tab_closed' | 'navigation' | 'timeout'): void;

  /**
   * Dispatches a command to pause the current active session.
   *
   * @param reason  Why the session is pausing (matches SessionPausedPayload.reason).
   */
  pauseSession(reason: 'explicit' | 'tab_hidden' | 'idle'): void;

  /**
   * Dispatches a command to resume a paused session.
   *
   * @param pauseDurationMs  The total milliseconds the session was paused.
   */
  resumeSession(pauseDurationMs: number): void;
}
