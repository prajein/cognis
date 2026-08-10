# Milestone 7: Measurement Loop & Attribution Hardening (Overview)

## What We Built
Milestone 7 hardened the measurement infrastructure of Cognis. Rather than adding new features, it unified the telemetric causal chain from the user's keystrokes through gap detection, ghost text interaction, prompt submission, response analysis, and projection builds. We eliminated semantic inversions, corrected attribution gaps, and established session boundary guards.

### Key Achievements

#### 1. Linear Correlation Lineage (P0)
* We established end-to-end lineage mapping (`prompt.sent.event.id -> response.started.promptEventId -> response.analysis.completed.promptEventId`).
* We verified that `wasEnriched` accurately flows from the submit interception layer down to the response metrics.
* We hardened the `ResponseObserver` to clear its internal tracking cache on session boundary events, preventing cross-session correlation contamination.

#### 2. Calibrated Quality Aggregation (P0)
* We corrected an inversion bug where the `QualityAnalyzer` aggregate score was artificially inflated by high assumption density. The score aggregation now correctly computes `+ ((1 - assumptionResult.score) * 0.15)`.
* We audited `GapCompletionAnalyzer` and verified it already measures resolution quality (higher = fewer gaps), making it directionally correct.

#### 3. Steady-State Safety & Safe-Defaults (P0)
* We introduced the `unknown` state with `0.0` confidence to safely handle typing that does not match specific cognitive markers, protecting downstream systems from false-positive interventions.
* We eliminated duplicate response processing in `ResponseObserver` by enforcing single active generation invariants per session.
* We removed unvalidated automaticity heuristics (`V1AutomaticityEvaluator`).

#### 4. Rejection Attribution (P1)
* We appended the `gapType` metadata to the `GhostTextEvents.DISMISSED` event, allowing `GapProfileProjectionBuilder` to accurately count user rejections by gap category.

---

## Technical Details

### Quality Analyzer Self-Test
We built a dedicated test suite (`QualityAnalyzer.selftest.ts`) verifying the behavior of the quality score aggregation. The test mocks structure, reasoning, completeness, and gap completion to fixed values, and validates that as assumption density increases, the composite quality score strictly decreases or remains constant.

### Schema Validation
We verified that all new and updated event structures conform strictly to the platform's JSON schemas and that all tests compile under `npx tsc --noEmit`.
