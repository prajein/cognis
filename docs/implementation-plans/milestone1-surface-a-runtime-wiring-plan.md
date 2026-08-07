# Milestone 1: Surface A Runtime Wiring — Implementation Plan

**Author:** Cognis Architecture Lead (`Naren`)  
**Status:** APPROVED & IMPLEMENTED  
**Type:** Implementation Plan / Architectural Design Document  
**Date:** 2026-08-05  

---

## 1. Executive Summary & Problem Statement

Prior to Milestone 1, Surface A (the content script running in ChatGPT tabs) was an un-wired, inert script. While `ChatGPTAdapter`, `TypingObserver`, and `ResponseObserver` existed as unit-tested subsystems, they were never instantiated or attached to the live DOM. Furthermore, Surface B (the Sidepanel) operated in isolation, unable to notify the content script when a user started or ended a session.

To transform Cognis into a unified, observable product, Surface A must participate in the cross-process `EventBus` network. However, initializing observation blindly on page load would violate Cognis architectural principles. Observation must be strictly coupled to the **Session Lifecycle**, not the **Page Lifecycle**.

This document details the architectural plan to wire Surface A into the extension event bus, establish a clean two-phase lifecycle (Platform Lifetime vs. Session Lifetime), and resolve cross-process IPC and Single-Page Application (SPA) DOM challenges.

---

## 2. Architectural Principles & Invariants

### 2.1 Two-Phase Lifecycle

Observation must never be active continuously on a page without explicit session authorization.

```
Page Load
   │
   ▼
Phase 1: Platform Lifetime (Inert)
   │  • Instantiate EventBus & ExtensionEventBridge
   │  • Prepare PlatformAdapter via PlatformManager.prepareAdapter(url)
   │  • Wait for SessionEvents.STARTED
   │
   ├──────► SessionEvents.STARTED (Authoritative)
   │
   ▼
Phase 2: Session Lifetime (Observation Active)
   │  • PlatformManager.beginObservation(sessionId)
   │  • Instantiate & connect TypingObserver & ResponseObserver
   │  • Capture DOM events and publish Domain Events
   │
   └──────► SessionEvents.ENDED (Authoritative)
      │
      ▼
Phase 1: Return to Inert Platform State
      • PlatformManager.endObservation()
      • Destroy Observers & unbind DOM listeners
```

### 2.2 Composition Root Pattern

1. **Content Script (`src/content/content-script.ts`)**: Acts as the process-level Composition Root. It owns:
   - The process-local `EventBus`.
   - The `ExtensionEventBridge` configured for `'content-script'`.
   - The `PlatformManager`.
2. **Platform Manager (`src/platforms/manager/PlatformManager.ts`)**: Manages platform selection and lifetime without coupling `content-script.ts` directly to ChatGPT or Claude implementations.
3. **Platform Adapter (`ChatGPTAdapter.ts`)**: Acts as the platform-specific Composition Root, instantiating observers and providing a clean `start(sessionId)` / `stop()` interface.

### 2.3 Strict CQRS & Authoritative Event Loop

- **Commands**: Sidepanel emits `session.started` command to local `EventBus` -> bridged to Background worker via Chrome Port IPC.
- **Authority**: Background worker stamps `origin: 'remote'`, `isAuthoritative: true`, persists to IndexedDB, and broadcasts to all connected UI contexts (Sidepanel & Content Script tabs).
- **Reaction**: Content Script `ExtensionEventBridge` receives authoritative `session.started` and publishes to local `EventBus`. `PlatformManager` receives event and triggers `beginObservation(sessionId)`.

---

## 3. Proposed Changes & Technical Architecture

### 3.1 Content Script Composition Root (`src/content/content-script.ts`)

- Instantiate `EventBus` with `ConsoleErrorReporter`.
- Initialize `ExtensionEventBridge` in `'content-script'` mode with relevant domain events (`PromptEvents`, `ResponseEvents`, `CognitiveEvents`, `SessionEvents.PAUSED`, `SessionEvents.RESUMED`).
- Subscribe to `SessionEvents.STARTED` and `SessionEvents.ENDED`.
- On `SessionEvents.STARTED`: invoke `platformManager.beginObservation(event.sessionId)`.
- On `SessionEvents.ENDED`: invoke `platformManager.endObservation()`.

### 3.2 Dynamic Adapter Initialization (`src/platforms/interfaces/PlatformAdapter.ts`)

- Refactor `PlatformAdapter.start()` to accept `sessionId: SessionId` dynamically at invocation time rather than requiring a static `sessionId` during construction.

### 3.3 Platform Manager Lifecycle Separation (`src/platforms/manager/PlatformManager.ts`)

- `prepareAdapter(url: string)`: Resolves `PlatformConfig` and instantiates the matching adapter (e.g. `ChatGPTAdapter`), storing it as `activeAdapter`.
- `beginObservation(sessionId: SessionId)`: Invokes `activeAdapter.start(sessionId)`.
- `endObservation()`: Invokes `activeAdapter.stop()`.

### 3.4 Transport Loop-Prevention Relaxation (`src/core/event-bus/ExtensionEventBridge.ts`)

- **Problem Identified**: `ExtensionEventBridge.handleIncomingMessage` dropped events whose `id` was already in `recentlyBridgedIds`. When the Sidepanel originated `session.started`, it recorded `event.id`. When Background broadcasted the authoritative confirmation back to Sidepanel, Sidepanel dropped it, preventing the UI state from transitioning to `SESSION_ACTIVE`.
- **Solution**: Allow inbound events to bypass `recentlyBridgedIds` filter IF `envelope.event.isAuthoritative === true`. Outbound `bridgeOut` still enforces `recentlyBridgedIds.has(event.id)`, preventing infinite forwarding loops while allowing authoritative confirmations to reach local subscribers.

### 3.5 Robust SPA DOM Typing Observation (`src/platforms/observers/TypingObserver.ts`)

- **Problem 1 (Div vs Textarea)**: ChatGPT's prompt input (`#prompt-textarea`) is a `<div contenteditable="true">`, not an `<HTMLTextAreaElement>`. Accessing `.value` returns `undefined`, leading to `TypeError: Cannot read properties of undefined (reading 'length')`.
  - **Solution**: Implement `getInputValue()` helper that checks for `'value' in node` (`<input>`/`<textarea>`) and falls back to `.innerText || .textContent || ''`.
- **Problem 2 (React DOM Churn)**: In SPAs, React unmounts and recreates `#prompt-textarea` on chat switches or hydration. Attaching `addEventListener` directly to the initial node leaves listeners bound to a detached node. Additionally, checking `!this.inputNode.isConnected` inside `onPauseDetected` called `this.destroy()`, permanently killing the observer.
  - **Solution**: Replace direct node listeners with **Document-Level Event Delegation** (`document.addEventListener('input', ...)` and `document.addEventListener('keydown', ...)`). Replace destructive `destroy()` on target loss with soft re-querying.

---

## 4. Verification & Testing Strategy

### 4.1 Automated Build Verification
Run `npm run build` to verify Vite compilation of `dist/assets/content-script.ts-*.js`, `dist/sidepanel.html`, and `dist/manifest.json`.

### 4.2 End-to-End Manual Verification (Chrome Extension)
1. Load unpacked extension in Chrome (`chrome://extensions`).
2. Open `chatgpt.com` in a tab and open Chrome DevTools Console.
3. Open Cognis Sidepanel. Select a task (e.g., "AI Co-pilot — Brainstorming").
4. Click **Start Session**.
5. **Verify Phase 1 -> Phase 2 Transition**:
   - Sidepanel UI transitions to `SESSION_ACTIVE` with timer running.
   - ChatGPT console logs: `[Cognis] Authoritative session started received in content script: { platform: 'side-panel', taskId: '...' }`
   - Observer logs: `[TypingObserver] Attached and observing.`
6. **Verify Event Generation**:
   - Type text in ChatGPT input prompt.
   - Verify `TypingObserver` extracts text length and publishes `PromptEvents` without thrown errors.
7. **Verify Session End**:
   - Click **End Session** in Sidepanel.
   - Verify `[ChatGPTAdapter] Stopped observing ChatGPT.` is logged and observation halts.
