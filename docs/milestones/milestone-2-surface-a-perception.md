# Milestone 2: Surface A Perception (Gap Detection & Ghost Text)

**Status:** Completed
**Focus:** Live Perception, Cognitive Pauses, and Non-Intrusive Ghost Text in the DOM.

## Objective
To prove that Cognis can securely observe the user's typing behaviour in real-time, detect cognitive pauses, run instantaneous gap detection using transient text, and surface context-aware ghost text suggestions—without violating the architectural rule against persisting raw prompt text.

## Core Accomplishments

1. **Transient Gap Detection Implementation:**
   - Implemented a secure `captureTransientText()` method within the `GapDetectionEngine`.
   - Wired the `TypingObserver` to synchronously dump the raw input buffer into the Gap engine mere milliseconds before emitting the generic `pause.detected` EventBus event.
   - Proved that we can decouple cognitive heuristics from DOM perception without logging raw text.

2. **Ghost Text Engine & Observer:**
   - Created `GhostTextObserver`, an EventBus-driven UI state machine that listens for `GhostTextEvents.GENERATED`.
   - Implemented idempotent CSS/DOM injection to render Ghost Text accurately aligned over the active ChatGPT prompt box, immune to React's aggressive DOM re-renders.
   - Handled `Tab` acceptance and `blur`/`typing` dismissals locally via canonical events.

3. **Content Script Stabilization:**
   - Migrated the initialization of `GapDetectionEngine`, `GhostTextEngine`, and `StateEngine` directly into the active `content-script.ts` entry point.
   - Ensured `GhostTextEvents` are bridged correctly from the content script to the background for future telemetry and skill map updates.

## Architectural Verification
- [x] **ADR-019 Upheld:** Raw text never touches the EventBus. It exists momentarily in the Gap Detection Engine and is cleared synchronously upon consumption.
- [x] **Decoupling Maintained:** The `TypingObserver` only handles sensory perception (typing/pausing). The `GhostTextObserver` only handles UI rendering. They do not know about each other.
- [x] **React Resilience:** The injection strategies handle single-page app (SPA) re-renders smoothly.

## Next Steps
With Milestone 2 verified via a live demonstration, the foundation of Surface A's real-time input pipeline is stable. We will now proceed to **Milestone 3: Submit Interception & Prompt Enrichment**, focusing on intercepting the user's final submission and manipulating the final payload sent to the LLM.
