# Milestone 7: Measurement Loop & Attribution Hardening

## Overview
Milestone 7 focused on establishing a mathematically honest, rigorously attributed, and scientifically valid measurement loop. We resolved critical correctness issues (C1–C7) in correlation, state inference, gap-aware enrichment, and response quality aggregation. This milestone ensures that Cognis records high-integrity telemetry for user interactions and model response quality.

## Objectives & P0/P1 Correctness Items

### P0 Correctness Items
* **C1: Duplicate Response Analysis Elimination**: Restrict the system to a single active response generation per session. Resolve duplicate processing and prevent multiple triggers from corrupting telemetry.
* **C3: Fabricated Automaticity Disablement**: Disable the unvalidated `V1AutomaticityEvaluator` and any speculative heuristics that lack longitudinal scientific evidence.
* **C4: State Confidence & Steady-State Safety**: Introduce the `unknown` state with `0.0` confidence to safely categorize baseline typing, preventing steady-state typing from masquerading as `stretch` and falsely triggering interventions.
* **C5: Gap-Aware Enrichment**: Restructure the enrichment layer to strictly respect the `activeGaps: Set<GapType>` detected from the latest prompt analysis. Stale gaps are immediately invalidated on typing.
* **C6: Prompt-to-Response Correlation**: Establish explicit lineage mapping (`prompt.sent.id` -> `response.started.promptEventId` -> `response.analysis.completed.promptEventId`). Ensure that session-boundary resets purge cached correlation metadata to prevent cross-contamination.
* **C7: Response-Quality Assumption Calibration**: Correct the aggregation logic in `QualityAnalyzer` to penalize assumption density (`((1 - assumptionResult.score) * 0.15)`) instead of rewarding it, and verify with a monotonic invariant test.

### P1 Detail Items
* **C2: Ghost-Text Dismissal Attribution**: Add the `gapType` metadata to ghost-text dismissal events (`GhostTextEvents.DISMISSED`) so that user rejection counts can be accurately attributed by gap category in downstream projections.

---

## Implementation Details

### Correlation Lineage & Session Reset
We established end-to-end lineage mapping by capturing `promptEventId` and `wasEnriched` at the interception layer and flowing them downstream:
1. `prompt.sent` carries the generated `eventId` and `wasEnriched` boolean.
2. `ResponseObserver` captures these values and links them to the subsequent `response.started` event.
3. The `ResponseObserver` state is actively cleared on `session.started` and session resets, preventing legacy prompt metadata from leaking into future sessions.

### Invariant Quality Scoring
We corrected the semantic bug in `QualityAnalyzer.ts`. Previously, assumption density (where `1.0` means a heavily hallucinated response) was added as a positive quality contribution. We updated this calculation to use `(1 - assumptionResult.score)` so that high assumption density reduces the total quality score. 

A new self-test (`QualityAnalyzer.selftest.ts`) asserts this monotonic invariant: holding other scores constant, increasing assumption density must never increase the composite quality score.

---

## Conclusion
**Status: ✅ COMPLETE & VERIFIED**

The M7 exit audit has verified that the causal measurement chain (`user typing -> state inference -> gap detection -> ghost text -> enrichment -> submit -> response -> analysis -> projections`) is mathematically correct, single-producer owned, and properly attributed. We are ready to transition to Milestone 8 to build adaptive co-pilot logic.
