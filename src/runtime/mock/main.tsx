import React from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapMockRuntime } from './bootstrap';
import { SidepanelRuntimeProvider } from '../../sidepanel/runtime/RuntimeContext';
import { App } from '../../sidepanel/app';
import { demoScenario } from './scenarios/demoScenario';

async function mount() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  const root = createRoot(rootElement);

  try {
    // 1. Bootstrap the Mock Runtime (local execution of all components)
    const { container, player } = await bootstrapMockRuntime();

    // 2. Render identically to production SurfaceB
    root.render(
      <React.StrictMode>
        <SidepanelRuntimeProvider container={container}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {/* Provide a header for demo execution */}
            <div style={{ padding: '16px', borderBottom: '1px solid #ccc', display: 'flex', gap: '16px', alignItems: 'center', background: '#f5f5f5' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#333' }}>Mock Runtime Test</h2>
              <button 
                onClick={() => player.play(demoScenario)}
                style={{ 
                  padding: '8px 16px', 
                  background: '#0066cc', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ▶ Play 60s Demo
              </button>
            </div>
            {/* The actual product UI */}
            <App />
          </div>
        </SidepanelRuntimeProvider>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Failed to bootstrap Mock Runtime:', error);
    root.render(
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Runtime Error</h2>
        <pre>{error instanceof Error ? error.message : String(error)}</pre>
      </div>
    );
  }
}

mount();
