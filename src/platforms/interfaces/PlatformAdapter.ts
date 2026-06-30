/**
 * Platform Adapter Interface
 *
 * Defines the strict lifecycle contract for all host platform adapters.
 * Platform adapters are the ONLY components permitted to touch DOM APIs
 * or MutationObservers. They extract transient text and pass it to
 * the pure domain engines in-memory.
 */
export interface PlatformAdapter {
  /**
   * Starts DOM observation and binds necessary event listeners.
   */
  start(): void;

  /**
   * Stops all observation and cleans up listeners.
   */
  stop(): void;
}
