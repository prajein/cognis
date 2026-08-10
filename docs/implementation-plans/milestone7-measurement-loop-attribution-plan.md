# Milestone 7: Measurement Loop & Attribution Hardening (Implementation Plan)

## Goal
Rigorously harden the telemetry, correlation, and measurement logic of the Cognis co-pilot loop. Ensure all signals have a single authoritative producer, correct directionality for quality scores, proper attribution for rejections, and prevent cross-session correlation leaks.

## Scope of Correctness Items

### P0 (Correctness Blockers)
1. **C1: Duplicate Response Hardening**: Enforce single-active-response invariants in `ResponseObserver` to prevent duplicate processing of DOM mutations.
2. **C3: Disable Unvalidated Automaticity Heuristics**: Retract the `V1AutomaticityEvaluator` until longitudinal data is collected.
3. **C4: Handle Steady-State Safely (`unknown` state)**: Set `unknown` state with `0.0` confidence in `StateEvaluator` when no explicit rules are matched, preventing false enrichment triggers.
4. **C5: Gap-Aware Enrichment**: Bind the `EnrichmentEngine` directly to `Set<GapType>`. Reset these gaps on `prompt.typed` to prevent stale-gap contamination.
5. **C6: Prompt-to-Response Correlation**: Route `promptEventId` and `wasEnriched` from `prompt.sent` to `response.started` and down to `response.analysis.completed`. Explicitly reset cached IDs in `ResponseObserver` on session boundaries.
6. **C7: Assumption Score Calibration**: Calibrate `QualityAnalyzer` to aggregate assumption density correctly using `1 - assumptionResult.score`, preventing assumptions from artificially inflating response quality.

### P1 (Enhancements)
1. **C2: Ghost-Text Dismissal Attribution**: Capture and flow `gapType` on `GhostTextEvents.DISMISSED` to accurately bucket user rejections.

---

## Approach

### 1. Hardening Perception & Interception
* Intercept form submissions inside `SubmitInterceptor` and publish the authoritative `prompt.sent` containing the unique `promptEventId` and `wasEnriched` state.
* Track the last submitted event ID in `ResponseObserver` and bind it to the upcoming stream. Clear this buffer on any session lifecycle reset.

### 2. Calibrating Aggregation Logic
* Audit all metrics in the pipeline: `Reasoning`, `Completeness`, `Structure`, and `GapCompletion` use higher-is-better scoring.
* Invert `AssumptionAnalyzer` output in `QualityAnalyzer` via subtraction (`1 - assumptionScore`) to represent quality impact instead of density.

### 3. Safety Net Guardrails
* Introduce `unknown` state with `0.0` confidence to neutralize steady-state typing.
* Restrict active gaps to the typed prompt context; clear gaps upon user backspacing or typing new content.

---

## Verification Strategy
* **Unit & Self Tests**: Create `QualityAnalyzer.selftest.ts` to assert that increasing assumption density strictly decreases or keeps the composite quality score constant.
* **Lineage Tracking**: Ensure that all events carrying `promptEventId` typecheck cleanly without using `as any` casts.
* **Compilation**: Validate type safety with `npx tsc --noEmit`.
