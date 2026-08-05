# Milestone 2: Surface A Perception (Gap Detection & Ghost Text) Implementation Plan

## The Goal
To prove that Cognis can observe the user's typing behaviour in real-time within a live AI chat session (e.g., ChatGPT), detect cognitive pauses, process raw input synchronously via the Gap Detection Engine, and present non-intrusive Ghost Text suggestions on the screen—without violating the architectural rule of persisting raw text.

## Architectural Context & Constraints
* **ADR-019 (Transient Response Text):** We cannot store raw prompt text on the EventBus. It must remain strictly transient.
* **Component Boundaries:** The Perception Observer (`TypingObserver`) should NOT contain intelligence. It should only emit lifecycle events (`prompt.typed`, `pause.detected`, `prompt.sent`). 
* **Idempotency:** Any UI injection must be idempotent to survive React re-renders without causing infinite loops or duplicate elements.

## Phase 1: Exposing the Gap Engine
The Gap Detection Engine needs access to the raw prompt text at the exact moment a `pause.detected` event occurs, but the text cannot travel over the EventBus.

**Proposed Changes:**
1. **Add `captureTransientText(text: string)` to GapDetectionEngine:** A method that allows the perception layer to synchronously inject raw text into an in-memory buffer.
2. **Buffer consumption:** When the Gap Detection Engine handles the `pause.detected` event (fired immediately after the buffer is populated), it reads the buffer, processes the gap analysis, emits a `gap.detected` event, and immediately clears the buffer.

## Phase 2: Wiring the Observers
The content script must initialize the engines and wire them up to the observers.

**Proposed Changes:**
1. **Update `PlatformManager`:** Inject the `GapDetectionEngine` as a dependency so it can pass it down to the platform-specific adapters.
2. **Update `ChatGPTAdapter`:** Pass the `GapDetectionEngine` instance to the `TypingObserver` upon instantiation.
3. **Update `TypingObserver`:** Before emitting `pause.detected`, call `gapEngine.captureTransientText()` with the current value of the input box.
4. **Instantiate Engines in `content-script.ts`:** Move the initialization of `GapDetectionEngine`, `GhostTextEngine`, and `StateEngine` into the actual active content script entry point so they listen to the local EventBus.

## Phase 3: Ghost Text UI Rendering
When `GhostTextEngine` receives `gap.detected` (along with `pause.detected`), it emits a `ghosttext.generated` event. We need a dedicated UI Observer to listen for this and render it.

**Proposed Changes:**
1. **Create `GhostTextObserver`:** A new class implementing `Observer` that subscribes to `GhostTextEvents.GENERATED`.
2. **Idempotent Injection:** When an event is received, inject an absolutely positioned `<div>` mirroring the font and padding of the ChatGPT input box, overlaying a greyed-out suggestion stem.
3. **Event Listeners:** Attach a `keydown` listener. If `Tab` is pressed, append the suggestion to the prompt, dispatch an `input` event to inform React, and emit `ghosttext.accepted`. If the user continues typing, or blurs the input box, hide the suggestion and emit `ghosttext.dismissed`.

## Verification Strategy
1. **TypeScript Build:** Ensure `npm run build` succeeds flawlessly with the new cross-layer dependencies.
2. **Live Test:** Open ChatGPT, type a prompt, wait for 2 seconds (the idle threshold), and visually confirm that the Ghost Text appears. Press `Tab` to verify seamless insertion.
