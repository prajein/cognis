# Week 2 State Inference — Architecture Walkthrough & Overview

**Module**: `src/platforms/observers/`, `src/engines/state/`, `src/core/config/`  
**Owner**: Suchit (State Engine) / Naren (Architecture Governance)  
**Sprint**: Week 2 — Perception + Behavioural State Inference  
**Status**: Implemented and Verified  
**Reference**: [Week 2 State Inference Implementation Plan](../implementation-plans/week2-state-inference-implementation-plan.md)  
**Constitution Reference**: Sections 2 (Event Driven, Hardware Agnostic), 3 (Domain Engines), 5 (Type Safety), 9 (Arc Readiness), 10 (Repository Governance)

---

## 1. Executive Summary

Week 2 extends the Cognis State Engine to infer behavioural cognitive load (`stretch`, `coasting`, `overload`) using **baseline-relative Words Per Minute (WPM)** dynamics alongside revision and pause telemetry, while lowering the perception layer cognitive pause detection threshold from 2000ms to 1200ms.

This implementation satisfies all Week 2 Sprint requirements without breaking existing event contracts, adding new domain events, altering payload interfaces, or creating redundant tracker abstractions. The solution is 100% platform-agnostic, event-driven, hardware-ready, and verified by an automated self-test suite.

---

## 2. Files Created and Modified

### Platform Perception Layer
- **[MODIFY]** `src/platforms/observers/TypingObserver.ts`: Lowered `IDLE_THRESHOLD_MS` constant from `2000` to `1200` to satisfy cognitive pause threshold requirement C-01.

### Domain Engine & Metrics Accumulation
- **[MODIFY]** `src/engines/state/InteractionTracker.ts`: Extended metric accumulation to compute instantaneous/cumulative WPM and maintain a session-scoped Exponential Moving Average (EMA) baseline (`emaWpm`).
- **[MODIFY]** `src/engines/state/StateSnapshot.ts`: Extended the DTO interface to expose `wordsPerMinute`, `baselineWpm`, and `sampleCount`.
- **[MODIFY]** `src/engines/state/StateEvaluator.ts`: Updated state inference evaluation to incorporate cognitive pauses (`pauseDurationMs`). Evaluates Stretch when WPM is near baseline, revision rate is low, and cognitive pause duration satisfies `pauseThresholds.stretch` (1200ms).
- **[MODIFY]** `src/engines/state/TransitionPolicy.ts`: Added `getCurrentState()` getter and `reset()` method to support accurate transition reporting and clean session resets.
- **[MODIFY]** `src/engines/state/StateEngine.ts`: Routed `wordCount` and `textLength` from `prompt.typed` payloads; updated `handleSessionStarted` typing; populated accurate `previousState`; injected optional `Clock` and `EventIdFactory` DI for testability.

### Core Configuration
- **[MODIFY]** `src/core/config/state_engine_rules.json`: Added `baseline` configuration block specifying `emaAlpha: 0.3`, `minSamplesBeforeBaseline: 5`, and percentage deviation thresholds; updated `thresholds.pauseDurationMs.stretch` to `1200` to align with the perception layer.
- **[MODIFY]** `src/core/config/state-rules-loader.ts`: Extended `StateEngineRules` TypeScript interface with `StateBaselineConfig`.
- **[MODIFY]** `src/core/config/state_engine_rules.schema.json`: Updated JSON Schema to validate the `baseline` configuration object.

### Verification & Testing
- **[MODIFY]** `src/tests/engines/state/StateEngine.selftest.ts`: Replaced placeholder test with a comprehensive, framework-free self-test validating WPM derivation, EMA baseline convergence, baseline-relative transitions, cognitive pause stretch transitions, hysteresis, and lifecycle resets.
- **[NEW]** `docs/implementation-overviews/week2-state-inference-overview.md`: Architectural overview (this document).

---

## 3. Key Architectural Decisions & Mapping

| Sprint Requirement | Architecture & Implementation Result |
| --- | --- |
| **C-01 / F-06: Pause Threshold 1200ms** | Updated `IDLE_THRESHOLD_MS` in `TypingObserver.ts` and `thresholds.pauseDurationMs.stretch` in `state_engine_rules.json` to `1200`. |
| **F-02: WPM Derivation** | Derived inside `InteractionTracker.trackTyping()` by dividing word-count deltas by elapsed time intervals. Raw prompt text is never stored or processed. |
| **F-07: Coasting (~+20% WPM above baseline)** | `StateEvaluator` classifies Coasting when `WPM >= baseline * (1 + 0.20)` AND `revisionRate < coastingThreshold`. |
| **F-08: Overload (~-30% WPM + heavy deletion)** | `StateEvaluator` classifies Overload when `WPM <= baseline * (1 - 0.30)` AND `revisionRate >= overloadThreshold`. |
| **F-09: Stretch (Productive Zone & Cognitive Pause)** | `StateEvaluator` classifies Stretch when WPM is near baseline (`stretchTolerancePercent`), revision rate is low (`< stretchThreshold`), AND pause duration `snapshot.pauseDurationMs >= pauseThresholds.stretch` (1200ms). |
| **Cold-Start Fallback** | When `sampleCount < minSamplesBeforeBaseline` (5 samples), `StateEvaluator` falls back gracefully to static velocity thresholds. |

---

## 4. Preservation of Invariants

1. **Event Sourced Integrity**: Events remain immutable facts. WPM and baseline are transient derived metrics computed on demand within `InteractionTracker` and discarded after snapshot generation.
2. **Local-First & Privacy**: No raw text is ever saved or transmitted. `prompt.typed` events carry only word counts, character lengths, and `cyrb53` hashes.
3. **Arc Readiness**: `state.changed` remains a frozen contract (`{ previousState, currentState, confidence }`). Future Arc BLE hardware state providers emit the exact same payload without changing downstream consumers.
4. **Zero Producer Redundancy**: No additional tracker classes (`BaselineTracker`, `WpmTracker`) were created. All metric tracking remains encapsulated inside `InteractionTracker`.

---

## 5. Verification Results

- **TypeScript Compilation**: Executed `npx tsc --noEmit` — clean with zero type errors.
- **Self-Test Suite**: `StateEngine.selftest.ts` passes 100% of assertions across baseline convergence, coasting/overload transitions, and session resets.
- **Regression Net**: Ran existing `GapPipeline` and `SurfaceAPipeline` self-test suites — all green.

---

## 6. Definition of Done Checklist

- [x] Pause threshold set to 1200ms in `TypingObserver.ts`.
- [x] WPM and EMA baseline computed inside `InteractionTracker.ts`.
- [x] Baseline-relative evaluation rules implemented in `StateEvaluator.ts`.
- [x] `StateEngine.ts` wiring issues fixed and clock DI added.
- [x] Configuration files extended additively with schema validation.
- [x] Self-test written and passing.
- [x] Documentation written.
- [x] `npx tsc --noEmit` passes clean.
- [x] Clean commit created on `feature/week2-state-inference`.
