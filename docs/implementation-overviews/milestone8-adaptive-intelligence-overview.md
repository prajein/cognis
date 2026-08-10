# Milestone 8: In-Session Adaptive Intelligence (Overview)

## What We Built
Milestone 8 closed the adaptive feedback loop within a single session. Building upon the verified telemetry from Milestone 7, we introduced a closed-loop preference adaptor in the background runtime, which suppresses specific inline suggestions when user rejections cross a defined threshold. We also fixed a critical race condition in the DOM replacement lifecycle that corrupted telemetry when rapid suggestions overlapped.

### Key Achievements

#### 1. Closed-Loop Suppression (Adaptive Policy)
* We implemented `GhostTextAdaptor` in the background process. It tracks exposures and explicit rejections (`continued_typing` | `caret_moved`) per `GapType`.
* When explicit rejections reach $\ge 75\%$ over $\ge 4$ exposures, the adaptor publishes an `adaptation.configured` event with `action: 'suppress'`.
* `GhostTextEngine` now acts as a naive enforcer, listening for suppression updates and blocking generation of inline stems for suppressed gap types.
* Session boundaries (`SessionEvents.STARTED` / `SessionEvents.ENDED`) clear all counters and suppressions to keep the adaptation strictly session-bound.

#### 2. Telemetry and DOM Replacement Integrity (P0)
* We corrected the synchronous call chain when a new suggestion B is generated before the old suggestion A completes its lifecycle.
* Under M8, suggestion A is dismissed with reason `'replaced'`.
* This dismissal emits exactly one terminal event, but it is explicitly excluded from the adaptor's rejection/exposure calculations to prevent artificial inflation of rejections.
* We verified that the synchronous dismissal of A does not destroy the target container or input references needed to render B.

#### 3. Payload Session Integrity (P2)
* We corrected a context leak where `adaptation.configured` events were being published with undefined session IDs, ensuring downstream event persistent stores map them accurately.

---

## Technical Details

### Self-Test and Compiler Validation
We updated `GhostTextAdaptor.selftest.ts` to assert that:
- Explicit rejections correctly trigger suppression.
- Passive dismissals (like `lost_focus`) are recorded as exposures but do not increment rejection counters, diluting the rejection rate.
- Ending the session clears all suppressions, allowing previously suppressed interventions to reappear in new sessions.
- All code passes TypeScript compiler checks via `npx tsc --noEmit`.
