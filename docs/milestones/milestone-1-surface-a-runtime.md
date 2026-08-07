# Milestone 1 — Surface A Runtime Wiring

**Status:** ✅ Completed  
**Owner:** Team Cognis (Architecture Lead: `Naren`)  
**Sprint:** Software-first Build Sprint — Milestone 1  
**Started:** 2026-08-04  
**Completed:** 2026-08-05  

---

## Objective

Transition Surface A (the ChatGPT browser tab) from an inert, disconnected script into an active, event-driven runtime participant in the Cognis ecosystem. Establish cross-process IPC communication between Sidepanel, Background Worker, and Content Script, ensuring that DOM observation is strictly coupled to authoritative session lifecycle events.

---

## Deliverables

- **Surface A Composition Root**: Full initialization of `EventBus`, `ExtensionEventBridge`, and `PlatformManager` in `src/content/content-script.ts`.
- **Two-Phase Lifecycle Architecture**: Separation of `Platform Lifetime` (inert matching on page load) from `Session Lifetime` (active DOM observation during a session).
- **Cross-Process IPC & Transport Fix**: ExtensionEventBridge echo-cancellation relaxation allowing authoritative events (`isAuthoritative === true`) to confirm state changes in origin processes.
- **SPA-Resilient DOM Observers**: Refactored `TypingObserver` supporting `<div contenteditable="true">` elements and document-level event delegation to handle React DOM unmounting/hydration.
- **End-to-End Runtime Validation**: Verified live session start, typing snapshot event publishing, and session termination in Chrome.

---

## Implementation Details

1. **Content Script Composition Root (`src/content/content-script.ts`)**:
   - Configured `EventBus` and `ExtensionEventBridge` in `'content-script'` context.
   - Wired listeners for `SessionEvents.STARTED` and `SessionEvents.ENDED`.
   - On `SessionEvents.STARTED`, triggers `platformManager.beginObservation(event.sessionId)`.
   - On `SessionEvents.ENDED`, triggers `platformManager.endObservation()`.

2. **Platform Manager & Adapter Refactoring**:
   - Updated `PlatformAdapter.ts` interface so `start(sessionId)` receives `sessionId` dynamically at invocation time.
   - Refactored `PlatformManager.ts` to expose `prepareAdapter(url)`, `beginObservation(sessionId)`, and `endObservation()`.
   - Updated `ChatGPTAdapter.ts` to instantiate `TypingObserver` and `ResponseObserver` upon `start()`.

3. **IPC Bridge & Loop Prevention**:
   - Resolved a critical issue in `ExtensionEventBridge.ts` where Sidepanel dropped background-broadcasted authoritative events because their IDs matched recently bridged outbound command IDs.
   - Updated `handleIncomingMessage` to bypass the `recentlyBridgedIds` filter for authoritative events (`envelope.event.isAuthoritative === true`), allowing the Sidepanel UI to transition to `SESSION_ACTIVE`.

4. **Observer Stabilization (`TypingObserver.ts`)**:
   - Fixed `TypeError: Cannot read properties of undefined (reading 'length')` by introducing `getInputValue()`, supporting contenteditable divs used by ChatGPT's `#prompt-textarea`.
   - Replaced direct node event listeners with **Document-Level Event Delegation** (`document.addEventListener('input', ...)` / `document.addEventListener('keydown', ...)`), protecting observers from React DOM churn when elements are re-rendered or swapped.

---

## Validation Results

### Build Validation
- ✅ `npm run build` completed successfully.
- ✅ Content script bundled cleanly under `dist/assets/content-script.ts-*.js`.

### Runtime Validation (Verified in Chrome)
- ✅ Extension loaded unpacked in Chrome.
- ✅ Content script initialized on `chatgpt.com` (`[Cognis] Content script initialized. Platform Ready.`).
- ✅ Sidepanel task selection and session start sent `session.started` command to Background Worker.
- ✅ Background Worker persisted event and broadcasted authoritative `session.started` back to Sidepanel and Content Script.
- ✅ Sidepanel UI state updated to `SESSION_ACTIVE` with timer running.
- ✅ Content Script received authoritative event and logged `[Cognis] Authoritative session started received in content script`.
- ✅ `ChatGPTAdapter` connected `TypingObserver` (`[TypingObserver] Attached and observing.`).
- ✅ Typing in ChatGPT prompt input triggered `onInput` and generated `PromptEvents` without errors.
- ✅ Clicking "End Session" in Sidepanel sent `session.ended` and stopped observation (`[ChatGPTAdapter] Stopped observing ChatGPT.`).

---

## Scope Boundaries

The following capabilities are intentionally deferred to subsequent milestones:
- Automatic Ghost Text stem injection into ChatGPT DOM.
- AI Co-pilot prompt enrichment overlays.
- Real-time Visualizer brain-map animation updates from live typing metrics.
- Advanced insight generation execution inside Background Worker.

---

## Exit Criteria

Milestone 1 is complete when:
- Content script receives authoritative session events from Sidepanel via Background.
- Platform observers connect and disconnect dynamically without page refresh.
- Keystrokes generate valid Domain Events without throwing JavaScript errors.
- End-to-end flow is manually validated in the browser.

---

## Milestone Outcome

> ✅ Cognis Surface A is officially wired into the event bus network and actively observes ChatGPT user input during live sessions.

---

## Next Milestone

**Milestone 2 — Surface A Co-pilot Ghost Text & Intelligence Layer**  
Wiring prompt enrichment engines and rendering ghost-text stems into the ChatGPT prompt input interface.
