import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../sidepanel/app';
import { EventBus } from '../../core/event-bus/EventBus';
import { createDomainEvent } from '../../core/event-bus';
import { SessionEvents, PromptEvents, CognitiveEvents, ResponseEvents, InsightEvents, EventType } from '../../core/event-bus/registry';
import { PerceptionLayer } from '../../engines/state/PerceptionLayer';
import { StateEngine } from '../../engines/state/StateEngine';
import { SessionStateMachine } from '../../engines/state/SessionStateMachine';
import { SessionId, toSessionId, toEventId, toTimestamp } from '../../core/types/session.types';

// Create event bus instance first and attach to window
const eventBus = new EventBus({
  report: (err, ctx) => console.error('[Harness Event Error]', err, ctx)
});
(window as any).cognisEventBus = eventBus;

// Instantiate engines
const perceptionLayer = new PerceptionLayer(eventBus);
const stateEngine = new StateEngine(eventBus);
const sessionStateMachine = new SessionStateMachine(eventBus);

// Start state engines
stateEngine.start();
sessionStateMachine.start();

// Current session tracking
let currentSessionId: SessionId | null = null;
let isSessionActive = false;

// Register listeners to update currentSessionId
eventBus.subscribe(SessionEvents.STARTED, (event) => {
  currentSessionId = event.sessionId;
  isSessionActive = true;
  perceptionLayer.reset(event.sessionId);
});

eventBus.subscribe(SessionEvents.ENDED, () => {
  isSessionActive = false;
});

// Setup DOM interactions after content is loaded
window.addEventListener('DOMContentLoaded', () => {
  // Mount React UI
  const rootEl = document.getElementById('sidepanelRoot');
  if (rootEl) {
    const root = createRoot(rootEl);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }

  const textarea = document.getElementById('mockTextarea') as HTMLTextAreaElement;
  const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
  const ghostPreview = document.getElementById('ghosttextPreview') as HTMLDivElement;
  const loggerStream = document.getElementById('loggerStream') as HTMLDivElement;
  const clearBtn = document.getElementById('clearLogsBtn') as HTMLButtonElement;

  // Log Clear
  clearBtn.addEventListener('click', () => {
    loggerStream.innerHTML = '';
  });

  // Wire typing updates to Perception Layer
  textarea.addEventListener('input', (e) => {
    if (!isSessionActive || !currentSessionId) {
      return;
    }
    const text = textarea.value;
    perceptionLayer.handleInput(text, currentSessionId);
  });

  // Handle send button / mock response stream
  sendBtn.addEventListener('click', () => {
    if (!isSessionActive || !currentSessionId) {
      alert("Please start a session in the control panel first!");
      return;
    }
    const text = textarea.value.trim();
    if (text === '') return;

    const mockPromptHash = 'h_' + Math.random().toString(36).substring(7);

    // 1. Publish prompt.sent event
    const sentEvent = createDomainEvent(
      'prompt.sent',
      currentSessionId,
      'mock-workspace',
      {
        promptHash: mockPromptHash,
        textLength: text.length,
        wordCount: text.split(/\s+/).length,
        wasEnriched: false
      }
    );
    eventBus.publish('prompt.sent', sentEvent);

    // Disable input while AI "generates response"
    textarea.disabled = true;
    sendBtn.disabled = true;

    // 2. Simulate streaming AI response
    let chunks = [
      "Here is a solution for your request:\n\n",
      "We will design a websocket handler in Go that handles connections concurrently.\n",
      "Using a clean select loop, we listen to channel events and properly evict dead connections.\n",
      "This prevents memory leakage and deadlocks in execution.\n",
      "Let me know if you need modifications."
    ];

    let chunkIndex = 0;
    let accumulatedLength = 0;
    
    // Publish response.started
    const responseStart = createDomainEvent(
      'response.started',
      currentSessionId,
      'mock-ai',
      { promptHash: mockPromptHash }
    );
    eventBus.publish('response.started', responseStart);

    const streamInterval = setInterval(() => {
      if (chunkIndex < chunks.length) {
        const chunkText = chunks[chunkIndex];
        accumulatedLength += chunkText.length;

        // Publish response.chunk
        const chunkEvent = createDomainEvent(
          'response.chunk',
          currentSessionId!,
          'mock-ai',
          {
            chunkText,
            chunkLength: chunkText.length,
            totalLength: accumulatedLength
          }
        );
        eventBus.publish('response.chunk', chunkEvent);
        chunkIndex++;
      } else {
        clearInterval(streamInterval);
        
        // Publish response.completed
        const responseEnd = createDomainEvent(
          'response.completed',
          currentSessionId!,
          'mock-ai',
          {
            responseLength: accumulatedLength,
            durationMs: chunks.length * 500
          }
        );
        eventBus.publish('response.completed', responseEnd);

        // Reset editor
        textarea.value = '';
        textarea.disabled = false;
        sendBtn.disabled = false;

        // Auto trigger Riya's insight and progress flow
        setTimeout(() => {
          const insightEvent = createDomainEvent(
            'insight.generated',
            currentSessionId!,
            'insight-engine',
            {
              insightId: 'ins_' + Date.now(),
              domain: 'Coding' as any,
              title: "Prefrontal Automaticity Shift",
              summary: "Focus stabilized during complex logic implementation. Keep practices brief.",
              confidence: 0.85,
              evidenceCount: 3
            }
          );
          eventBus.publish('insight.generated', insightEvent);

          setTimeout(() => {
            const automaticityEvent = createDomainEvent(
              'automaticity.updated',
              currentSessionId!,
              'automaticity-engine',
              {
                skillDomain: 'Coding',
                previousPhase: 'Associative',
                currentPhase: 'Autonomous',
                score: 0.45
              }
            );
            eventBus.publish('automaticity.updated', automaticityEvent);
          }, 600);
        }, 800);
      }
    }, 500);
  });

  // Log formatting and prepending
  const logEvent = (type: string, event: any) => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    // Add specific border colors based on event categories
    if (type.startsWith('session.')) entry.classList.add('started');
    if (type.startsWith('prompt.')) entry.classList.add('typed');
    if (type.startsWith('pause.')) entry.classList.add('pause');
    if (type.startsWith('state.')) entry.classList.add('state');
    if (type.startsWith('gap.')) entry.classList.add('gap');
    if (type.startsWith('response.')) entry.classList.add('onboard');

    const meta = document.createElement('div');
    meta.className = 'log-meta';
    
    const timeStr = new Date(event.timestamp).toLocaleTimeString();
    meta.innerHTML = `<span class="log-type">${event.type}</span><span>${timeStr} (${event.source})</span>`;
    
    const payload = document.createElement('pre');
    payload.className = 'log-payload';
    payload.textContent = JSON.stringify(event.payload, null, 2);
    
    entry.appendChild(meta);
    entry.appendChild(payload);
    
    loggerStream.insertBefore(entry, loggerStream.firstChild);
    
    // Auto-scroll logic if logger is full
    if (loggerStream.childNodes.length > 50) {
      loggerStream.removeChild(loggerStream.lastChild!);
    }
  };

  // Subscribe to all event names to display them
  const eventsToLog: EventType[] = [
    'session.started', 'session.ended', 'session.paused', 'session.resumed', 'session.onboarding_completed',
    'prompt.typed', 'prompt.sent', 'prompt.enriched', 'prompt.cancelled',
    'pause.detected', 'state.changed', 'gap.detected',
    'ghosttext.generated', 'ghosttext.displayed', 'ghosttext.accepted', 'ghosttext.dismissed',
    'response.started', 'response.chunk', 'response.completed', 'response.abandoned', 'response.analysis.completed',
    'insight.generated', 'milestone.reached', 'automaticity.updated'
  ];

  eventsToLog.forEach(evt => {
    eventBus.subscribe(evt, (event) => {
      logEvent(evt, event);
    });
  });
});
