# Milestone 8: In-Session Adaptive Intelligence

## Overview
Milestone 8 established the foundational adaptive co-pilot logic for Cognis. We introduced the first closed-loop adaptation policy that tracks user interaction with ghost text suggestions in-session, dynamically suppressing unhelpful suggestion categories. We also resolved critical DOM replacement and event lifecycle issues (P0) to ensure high-fidelity telemetry when suggestions overlap.

---

## Objectives & P0/P1 Correctness Items

### P0 Correctness Items
* **DOM Replacement Lifecycle**: Fixed the synchronous call chain when a new suggestion B overrides an active suggestion A. Emits a single `dismissed(reason='replaced')` event for A, while preserving DOM references to render B.
* **Adaptation Config Session ID**: Resolved a P2 leak where adaptation configured events lacked session ID context.

### Bounded Adaptation Features
* **GhostTextAdaptor**: Background controller that monitors event-bus subscriptions (`ACCEPTED`, `DISMISSED`) and maintains exposure and rejection statistics per `GapType`.
* **Dynamic Suppression**: Automatically publishes `adaptation.configured` with `action: 'suppress'` when user rejections cross $\ge 75\%$ over $\ge 4$ exposures.
* **Naive Enforcement**: `GhostTextEngine` inhibits generation of suggestion stems when a `GapType` is suppressed.
* **Session Boundaries**: Suppression states are cleared on session transitions (`STARTED` and `ENDED`).

---

## Implementation Details

### Bounded Feedback Loop
1. **GhostTextEvents.DISPLAYED** registers the exposure.
2. **GhostTextEvents.DISMISSED** triggers a policy evaluation. Explicit rejections (`continued_typing` | `caret_moved`) increment rejection count. Passive events (`lost_focus`) do not.
3. If the ratio crosses the $75\%$ rejection threshold, the adaptor publishes `AdaptationEvents.CONFIGURED` with `action: 'suppress'`.
4. `GhostTextEngine` intercepts the event, adding the gap type to its local `suppressedGaps` set, immediately stopping stem generation for that type.

### Replacement Lifecycle Invariants
To ensure accurate metrics, the content script's overlay manager explicitly sets the dismissal reason of the preceding suggestion to `'replaced'` when a new suggestion is generated. This is categorized by the adaptor as a non-rejection and a non-exposure event, preventing double-counting and telemetry skew.

---

## Conclusion
**Status: ✅ COMPLETE & VERIFIED**

Milestone 8 successfully proved that Cognis can adapt its intervention policy dynamically based on real-time user feedback. The system is ready to progress to Milestone 9 to support stateful, reversible evidence-based exploration.
