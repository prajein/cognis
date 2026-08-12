# Milestone 8: In-Session Adaptive Intelligence (Implementation Plan)

## Goal
Implement a closed-loop adaptive feedback mechanism in the background process (`GhostTextAdaptor`) that dynamically suppresses specific types of inline interventions (`GapType`) based on user rejections in the active session. Correct the underlying DOM replacement lifecycle (P0) to ensure telemetry and rendering remain clean when rapid suggestions override one another.

---

## Scope of Correctness Items

### P0 (Correctness Blockers)
1. **Replacement DOM Lifecycle**: Ensure that when suggestion A is replaced by suggestion B, suggestion A emits exactly one terminal `dismissed(reason='replaced')` event. Ensure this event does not count as a rejection or exposure, and that it does not destroy B's DOM node or clear B's active rendering.
2. **Adaptation Configuration Session ID Integrity (P2)**: Ensure `AdaptationEvents.CONFIGURED` payloads carry the current, correct `sessionId` instead of undefined or stale values, preserving correct session context downstream.

### Bounded Adaptation (Closed-Loop)
1. **Intervention Identity**: Assign a unique `interventionId` to each displayed ghost text.
2. **In-Session Rejection Tracking**: Track the ratio of explicit rejections (`continued_typing` | `caret_moved`) relative to total exposures per `GapType`.
3. **Adaptive Suppression Policy**: If exposures $\ge 4$ and explicit rejections make up $\ge 75\%$, publish `adaptation.configured` with `action: 'suppress'` to block future suggestions of that gap type.
4. **Session Boundary Reset**: Reset all suppressions and counter states on session start/end.

---

## Approach

### 1. In-Session Adaptor (`GhostTextAdaptor`)
* Listen to `GhostTextEvents.ACCEPTED`, `GhostTextEvents.DISMISSED`, `SessionEvents.STARTED`, and `SessionEvents.ENDED`.
* Maintain in-memory exposure and rejection statistics per `GapType`.
* Filter out `'replaced'` dismissals from the statistics to prevent telemetry pollution.
* Emit `adaptation.configured` containing the target module (`ghosttext`), `gapType`, `action` (`suppress`), and detailed `reasoning`.

### 2. Naive Enforcement (`GhostTextEngine`)
* Update `GhostTextEngine` to monitor `AdaptationEvents.CONFIGURED` and maintain a `suppressedGaps` set.
* Inhibit generation of new inline suggestion stems when a detected gap is suppressed.
* Reset suppression state on session boundaries.

### 3. DOM Replacement Mechanics
* Hardcode the content script's overlay manager to differentiate replacement events.
* Ensure the synchronous call chain: `onGhostTextGenerated(B) -> dismissGhostText('replaced') -> clearOverlay() -> render B` does not destroy the reference to B's target element or input context.

---

## Verification Strategy
* **Automated Regression Suite**: Rewrite `GhostTextAdaptor.selftest.ts` to assert the 4-exposure/75% rejection rate suppression, session resets, and passive dismissal bypasses.
* **Typing Simulation**: Simulate rapid double-typing in the content script adapter to ensure no overlapping nodes or double-dismissals occur.
* **Compilation**: Validate type safety with `npx tsc --noEmit`.
