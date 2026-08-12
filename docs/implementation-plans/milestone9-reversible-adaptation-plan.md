# Milestone 9: Reversible Evidence-Based Adaptation (Implementation Plan)

## Goal
Transition the `GhostTextAdaptor` suppression logic from a hardcoded one-way threshold into an evidence-backed, reversible preference state machine. Introduce controlled exploration (probing) to test user preference shift and strictly attribute probe outcomes to specific interventions.

---

## Scope of Correctness Items

### Reversible Preference State
1. **Lazy Initialization**: Initialize per-`GapType` preference records only when a gap is first encountered.
2. **PreferenceState**: Model the preference as `ACTIVE | SUPPRESSED | PROBING`.
3. **Reversibility**: Allow a suppressed gap type to restore to `ACTIVE` if a probe is accepted, or re-suppress and escalate exploration intervals if rejected.

### Controlled Exploration (Probing)
1. **Exploration Counter**: Count occurrences of `gap.detected` when suppressed to drive exploration pacing.
2. **Exploration Threshold**: Set initial threshold to 5 suppressed detections; escalate (double) this threshold on probe explicit rejection to reduce noise.

### Attribution and Strict Boundaries
1. **Attribution ID**: Capture and lock onto the `interventionId` for the probe upon `GhostTextEvents.DISPLAYED`. Wait exclusively for its terminal outcome.
2. **Bypass Passive Events**: Treat passive dismissals (`lost_focus`) as non-evidence, clearing the active probe ID and allowing another probe without altering preference state.
3. **Naive Engine Boundary**: Keep the `GhostTextEngine` stupid. It should only evaluate suppression via existing configure commands.

---

## Approach

### 1. In-Session State machine
* Manage state changes strictly inside `GhostTextAdaptor`.
* Transition to `PROBING` when `suppressedDetections >= nextProbeThreshold`, publishing a restore event to the engine.
* Once the next display event registers, lock onto `activeProbeInterventionId`.
* On `GhostTextEvents.ACCEPTED` matching the ID -> transition to `ACTIVE`, reset counters.
* On `GhostTextEvents.DISMISSED` matching the ID and containing explicit rejection (`continued_typing` | `caret_moved`) -> transition to `SUPPRESSED`, double the exploration threshold, publish suppression.

---

## Verification Strategy
* **Automated Selftest**: Rewrite `GhostTextAdaptor.selftest.ts` to assert transition cycles, threshold escalations, and strict attribution bounds.
* **Compilation**: Validate type safety with `npx tsc --noEmit`.
