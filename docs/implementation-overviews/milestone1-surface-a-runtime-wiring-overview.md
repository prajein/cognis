# Milestone 1: Surface A Runtime Wiring — Implementation Overview

**Module**: `src/content/`, `src/platforms/`, `src/core/event-bus/`  
**Author**: Architecture Lead (`Naren`)  
**Implementation Date**: 2026-08-05  
**Status**: Implemented & Runtime Verified  
**Reference Plan**: [Milestone 1 Plan](../implementation-plans/milestone1-surface-a-runtime-wiring-plan.md)  

---

## 1. Executive Summary

We have successfully completed **Milestone 1: Surface A Runtime Wiring**, transforming Surface A (ChatGPT content script) into an active, event-driven participant in the Cognis runtime network. 

Surface A now seamlessly transitions between **Platform Ready** (inert DOM matching) and **Observation Active** (capturing live typing snapshots and response streams) based on authoritative `session.started` and `session.ended` domain events emitted from the Sidepanel and broadcasted by the Background Service Worker.

---

## 2. Files Created and Modified

### Surface A Composition Root & Platform Management
- **[MODIFY] [content-script.ts](file:///Users/ntbnaren7/Dev/cognis/src/content/content-script.ts)**: Replaced placeholder console log with a full Composition Root. Instantiates `EventBus`, `ExtensionEventBridge`, and `PlatformManager`. Subscribes to `SessionEvents.STARTED` and `SessionEvents.ENDED` to dynamically trigger `platformManager.beginObservation()` and `platformManager.endObservation()`.
- **[MODIFY] [PlatformManager.ts](file:///Users/ntbnaren7/Dev/cognis/src/platforms/manager/PlatformManager.ts)**: Separated platform resolution from session observation. Introduced `prepareAdapter()`, `beginObservation()`, and `endObservation()`.
- **[MODIFY] [PlatformAdapter.ts](file:///Users/ntbnaren7/Dev/cognis/src/platforms/interfaces/PlatformAdapter.ts)**: Updated `start(sessionId: SessionId)` interface to accept active session dynamically at invocation time.
- **[MODIFY] [ChatGPTAdapter.ts](file:///Users/ntbnaren7/Dev/cognis/src/platforms/chatgpt/ChatGPTAdapter.ts)**: Updated `start(sessionId: SessionId)` implementation to construct and connect `TypingObserver` and `ResponseObserver` with the dynamic session ID.

### Transport Layer & Echo Cancellation
- **[MODIFY] [ExtensionEventBridge.ts](file:///Users/ntbnaren7/Dev/cognis/src/core/event-bus/ExtensionEventBridge.ts)**: Updated `handleIncomingMessage` to allow inbound authoritative confirmations (`isAuthoritative === true`) to bypass the `recentlyBridgedIds` filter, enabling local subscribers in the origin context (e.g. Sidepanel UI) to receive confirmation of their own commands.

### DOM Observers & SPA Resilience
- **[MODIFY] [TypingObserver.ts](file:///Users/ntbnaren7/Dev/cognis/src/platforms/observers/TypingObserver.ts)**:
  1. Replaced `HTMLTextAreaElement` direct `.value` access with `getInputValue()` helper supporting `<div contenteditable="true">` (`.innerText` / `.textContent`).
  2. Implemented **Document-Level Event Delegation** (`document.addEventListener('input', ...)` and `document.addEventListener('keydown', ...)`), ensuring immunity to React DOM unmounting/hydration.
  3. Replaced destructive target-loss `this.destroy()` with soft re-querying.

---

## 3. Architecture & Data Flow

```
+---------------------------------------------------------------------------------------+
| SIDEPANEL PROCESS                                                                     |
|  User clicks "Start Session" ──► SessionGateway.startSession()                         |
|                                        │                                              |
|                                  SessionEvents.STARTED (Command)                      |
|                                        │                                              |
|                                        ▼                                              |
|                              ExtensionEventBridge                                     |
+----------------------------------------│----------------------------------------------+
                                         │ (Chrome Port IPC)
                                         ▼
+---------------------------------------------------------------------------------------+
| BACKGROUND SERVICE WORKER                                                             |
|                              ExtensionEventBridge                                     |
|                                        │                                              |
|                                        ▼                                              |
|                             Stamp `isAuthoritative: true`                             |
|                             Persist to IndexedDB EventStore                           |
|                                        │                                              |
|                   ┌────────────────────┴────────────────────┐                         |
|                   │ (Port Message)                          │ (chrome.tabs.sendMessage)|
|                   ▼                                         ▼                         |
|          Sidepanel UI Update                     Content Script Tab                   |
|       (State -> SESSION_ACTIVE)                  (Surface A Composition Root)         |
+-------------------------------------------------------------│-------------------------+
                                                              │
                                                              ▼
                                               PlatformManager.beginObservation()
                                                              │
                                                              ▼
                                                     ChatGPTAdapter.start()
                                                              │
                                                              ▼
                                                   TypingObserver.connect()
                                                   ResponseObserver.connect()
```

---

## 4. Architectural Invariants Preserved

| Invariant | Implementation Proof |
| --- | --- |
| **Clean Separation of Concerns** | `content-script.ts` does not contain DOM querying or platform-specific logic. It delegates platform resolution to `PlatformManager`. |
| **Single Composition Root** | `content-script.ts` is the sole entry point instantiating process-level singletons (`EventBus`, `ExtensionEventBridge`). |
| **Strict Event-Driven Observation** | `ChatGPTAdapter` observers are inert until `SessionEvents.STARTED` arrives with `isAuthoritative: true`. |
| **SPA Resilience** | Observers use event delegation on `document` and do not break when React re-renders or replaces input nodes. |
| **CQRS Boundary** | Command execution flows asynchronously through Background Worker authority before UI or Content Script state transitions. |

---

## 5. Verification Results

### Build Verification
- Executed `npm run build`.
- Vite generated output bundles:
  - `dist/assets/content-script.ts-1Uq_Nh4b.js`
  - `dist/assets/sidepanel.html-B_oUcF4M.js`
  - `dist/service-worker-loader.js`

### Browser Runtime Verification
- **Session Trigger**: Clicking "Start Session" in Sidepanel transitioned UI state from `TASK_SELECTED` -> `SESSION_ACTIVE` (Timer started ticking).
- **IPC Routing**: `[Cognis] Authoritative session started received in content script` logged in ChatGPT DevTools.
- **Observation Activation**: `[TypingObserver] Attached and observing.` logged in ChatGPT DevTools.
- **Live Typing**: Typing text in ChatGPT prompt input triggered `onInput` text extraction and published `PromptEvents` without errors.
- **Session Termination**: Clicking "End Session" in Sidepanel logged `[ChatGPTAdapter] Stopped observing ChatGPT.` and halted observers.
