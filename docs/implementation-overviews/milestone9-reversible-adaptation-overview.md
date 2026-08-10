# Milestone 9: Reversible Evidence-Based Adaptation (Overview)

## What We Built
Milestone 9 introduced reversible decision-making into the Cognis adaptation loop. Replacing the static suppression rule from Milestone 8, we implemented a session-scoped preference state machine that balances user preference suppression with controlled exploration (probing). The system evaluates real-world user responses to probe interventions to decide whether to restore active behavior or re-suppress and escalate the exploration cooldown.

### Key Achievements

#### 1. Lazy-Initialized Preference State Machine
* Preference state is modeled as `ACTIVE | SUPPRESSED | PROBING` and created dynamically per `GapType` upon first encounter.
* Initial suppression happens when explicit rejections reach $\ge 75\%$ over $\ge 4$ exposures in-session.

#### 2. Exploration (Probing) Policy
* A suppressed gap type tracks passive detections (`gap.detected`).
* When detections hit the `nextProbeThreshold` (initially 5), the state transitions to `PROBING`, temporarily allowing a single suggestion through.

#### 3. Strict Probe Attribution & Evidence Integrity
* Upon display of the probe, the adaptor registers and locks onto `activeProbeInterventionId`.
* **Accepted Probe**: Reverts to `ACTIVE`, resets thresholds.
* **Rejected Probe**: Reverts to `SUPPRESSED`, doubles `nextProbeThreshold`.
* **Passive Dismissal**: Passive dismissals (such as `lost_focus`) do not fabricate state changes. They reset the active probe ID, maintaining the `PROBING` state for a future intervention attempt.
* Out-of-order or delayed events from old interventions are rejected, ensuring clean attribution.

---

## Technical Details

### Verification
* Updated `GhostTextAdaptor.selftest.ts` to assert the state cycles, probe attribution safety against old events, passive dismissal safety, and threshold multiplication.
* Compiler type safety verified successfully via `npx tsc --noEmit`.
