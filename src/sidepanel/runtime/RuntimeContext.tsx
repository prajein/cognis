/**
 * Sidepanel Runtime Context
 *
 * Provides the SidepanelContainer to the React tree via context.
 * This is the only mechanism by which hooks access runtime services
 * (SessionService, EventBus). No other injection mechanism is acceptable.
 *
 * Architectural invariants:
 * - `SidepanelRuntimeProvider` wraps `App` in main.tsx — it is the outermost
 *   provider in the sidepanel tree. The container it holds is the frozen
 *   instance returned by `bootstrapSidepanelRuntime()`.
 * - `useSidepanelRuntime()` throws a descriptive error if called outside
 *   the provider (fast failure instead of silent undefined bugs).
 * - The provider itself is never rendered before the container is resolved.
 *   main.tsx shows a loading shell until bootstrap completes.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { SidepanelContainer, RuntimeState } from './container';
import { SessionEvents } from '../../core/event-bus/registry';
import { ResponseLifecycleTracker } from './ResponseLifecycleTracker';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Typed as `SidepanelContainer | null`.
 * null is the default (before bootstrap completes).
 * The provider always supplies a non-null value, so `useSidepanelRuntime()`
 * can safely throw on null rather than requiring nullable types in every hook.
 */
const SidepanelRuntimeContext = createContext<SidepanelContainer | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface SidepanelRuntimeProviderProps {
  container: SidepanelContainer;
  children: ReactNode;
}

/**
 * Wraps the React tree with the resolved SidepanelContainer.
 * Only rendered after `bootstrapSidepanelRuntime()` has resolved in main.tsx.
 */
export function SidepanelRuntimeProvider({
  container,
  children,
}: SidepanelRuntimeProviderProps) {
  const [runtimeState, setRuntimeState] = useState<RuntimeState>(container.runtimeState);

  useEffect(() => {
    const unsubscribes: Array<() => void> = [];
    const eventBus = container.eventBus;

    // Track activeSession updates via eventBus (optional implementation for later, 
    // but ensures the infrastructure is ready for session.started/ended etc.)
    // Note: To fully track active session state, we would listen to session.* events 
    // and query SessionGateway, or background would push read models.
    // For now, we assume initial snapshot handles connection, and focus on isStreaming:

    const tracker = new ResponseLifecycleTracker(eventBus, (isStreaming) => {
      setRuntimeState((prev) => ({ ...prev, isStreaming }));
    });
    tracker.start();
    unsubscribes.push(() => tracker.stop());

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [container]);

  // Merge the dynamic runtimeState into the provided container
  const contextValue: SidepanelContainer = {
    ...container,
    runtimeState
  };

  return (
    <SidepanelRuntimeContext.Provider value={contextValue}>
      {children}
    </SidepanelRuntimeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the resolved SidepanelContainer from context.
 *
 * Throws if called outside `SidepanelRuntimeProvider`. This is intentional:
 * a hook accessing runtime services before the provider is mounted is a
 * programming error, not a recoverable runtime failure.
 *
 * Usage:
 *   const { sessionService, eventBus, runtimeState } = useSidepanelRuntime();
 */
export function useSidepanelRuntime(): SidepanelContainer {
  const container = useContext(SidepanelRuntimeContext);

  if (container === null) {
    throw new Error(
      '[Cognis] useSidepanelRuntime() was called outside <SidepanelRuntimeProvider>. ' +
      'Ensure bootstrapSidepanelRuntime() has completed and the provider wraps your component tree.'
    );
  }

  return container;
}
