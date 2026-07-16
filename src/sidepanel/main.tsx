import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';
import { bootstrapSidepanelRuntime } from './runtime/bootstrap';
import { SidepanelRuntimeProvider } from './runtime/RuntimeContext';
import type { SidepanelContainer } from './runtime/container';

/**
 * Bootstrap runs at module scope — before React mounts.
 * This guarantees exactly one invocation regardless of React StrictMode's
 * double-invocation of effects. The resolved container is passed into the
 * React tree via SidepanelRuntimeProvider.
 */
const runtimePromise = bootstrapSidepanelRuntime();

/**
 * Root component.
 * Renders a loading shell immediately (zero-delay paint).
 * Transitions to the full App tree once the runtime container is resolved.
 */
function Root() {
  const [container, setContainer] = useState<SidepanelContainer | null>(null);

  useEffect(() => {
    runtimePromise.then(setContainer);
  }, []);

  if (!container) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: '#888',
          fontSize: '14px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Connecting to Cognis…
      </div>
    );
  }

  return (
    <SidepanelRuntimeProvider container={container}>
      <App />
    </SidepanelRuntimeProvider>
  );
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('[Cognis] Root element not found. Check index.html for <div id="root">.');
}

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>
);