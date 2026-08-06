# Week 2 — State Inference Implementation Plan

**Module**: `src/platforms/observers/`, `src/engines/state/`, `src/core/config/`  
**Owner**: Suchit (State Engine) / Naren (Architecture Governance)  
**Sprint**: Week 2 — Perception + Behavioural State Inference  
**Status**: Approved & Ready for Implementation  
**Constitution Reference**: Section 2 (Event Driven, Hardware Agnostic), Section 3 (Domain Engines), Section 5 (Type Safety), Section 9 (Arc Readiness), Section 10 (Repository Governance)

---

## 1. Executive Summary

This plan details the technical implementation for extending the Cognis State Engine to support baseline-relative Words Per Minute (WPM) state classification and cognitive pause threshold alignment as required by Week 2 sprint specifications.

The implementation preserves all existing event contracts, module boundaries, ownership scopes, and EventBus patterns. It introduces **zero new domain events**, **zero new producer classes**, and **zero breaking changes to public payload interfaces**.

---

## 2. File Impact Breakdown

### A. Files to Modify

| File | Owner | Modifying Reason |
| --- | --- | --- |
| [src/platforms/observers/TypingObserver.ts](file:///Users/msr/Study%20and%20Practise/Hyle/Cognis/cognis/src/platforms/observers/TypingObserver.ts) | Naren | Update `IDLE_THRESHOLD_MS` constant from `2000` to `1200` to meet sprint requirement C-01. |
| [src/engines/state/InteractionTracker.ts](file:///Users/msr/Study%20and%20Practise/Hyle/Cognis/cognis/src/engines/state/InteractionTracker.ts) | Suchit | Extend metric accumulation: track word counts, compute WPM derived metric, and track session-scoped EMA baseline (`emaWpm`). |
| [src/engines/state/StateSnapshot.ts](file:///Users/msr/Study%20and%20Practise/Hyle/Cognis/cognis/src/engines/state/StateSnapshot.ts) | Suchit | Extend snapshot DTO interface with `wordsPerMinute: number` and `baselineWpm: number`. |
| [src/engines/state/StateEvaluator.ts](file:///Users/msr/Study%20and%20Practise/Hyle/Cognis/cognis/src/engines/state/StateEvaluator.ts) | Suchit | Replace static velocity rules with baseline-relative WPM rules (Coasting, Overload, Stretch) and cold-start fallback. |
| [src/engines/state/StateEngine.ts](file:///Users/msr/Study%20and%20Practise/Hyle/Cognis/cognis/src/engines/state/StateEngine.ts) | Suchit | Route `wordCount` and `textLength` from event payload to tracker; fix `previousState` tracking via policy; fix `DomainEvent<any>` typing; inject optional `Clock`. |
| [src/engines/state/TransitionPolicy.ts](file:///Users/msr/Study%20and%20Practise/Hyle/Cognis/cognis/src/engines/state/TransitionPolicy.ts) | Suchit | Expose `currentState` getter so `StateEngine` can populate `previousState` accurately on transitions. |
| [src/core/config/state_engine_rules.json](file:///Users/msr/Study%20and%20Practise/Hyle/Cognis/cognis/src/core/config/state_engine_rules.json) | Naren | Add additive `baseline` section containing `emaAlpha`, `minSamplesBeforeBaseline`, and WPM percentage thresholds. |
| [src/core/config/state-rules-loader.ts](file:///Users/msr/Study%20and%20Practise/Hyle/Cognis/cognis/src/core/config/state-rules-loader.ts) | Naren | Extend `StateEngineRules` interface to mirror new `baseline` configuration fields. |
| [src/core/config/state_engine_rules.schema.json](file:///Users/msr/Study%20and%20Practise/Hyle/Cognis/cognis/src/core/config/state_engine_rules.schema.json) | Naren | Update JSON Schema validation properties to mandate `baseline` config section structure. |

### B. Files to Create

| File | Purpose |
| --- | --- |
| `src/tests/engines/state/StateEngine.selftest.ts` | Framework-free self-test validating WPM derivation, EMA baseline convergence, cold-start fallback, pause threshold evaluation, and state transition rules. |
| `docs/implementation-plans/week2-state-inference-implementation-plan.md` | Architectural implementation plan (this document). |
| `docs/implementation-overviews/week2-state-inference-overview.md` | Post-implementation walkthrough and verification overview. |

### C. Files Reviewed and Intentionally Left Unchanged

| File | Reason |
| --- | --- |
| `src/core/event-bus/*` | EventBus, contracts, and registry are complete and frozen. Payload contracts are unchanged. |
| `src/engines/gap/*` | GapDetectionEngine consumes `state.changed` automatically. Zero changes required. |
| `src/engines/ghosttext/*` | GhostTextEngine consumes gap and pause events. Zero changes required. |
| `src/mock/harness/*` | MockHarness already produces `prompt.typed` and `pause.detected`. Zero changes required. |
| `src/storage/*` | Projections and storage layer consume `state.changed` events without schema modifications. |
| `src/sidepanel/*` | Brain Map assets and rendering pipeline are complete. |

---

## 3. Runtime Architecture & Pipeline Flow

```
Keystroke / DOM Input
       │
       ▼
TypingObserver (IDLE_THRESHOLD_MS = 1200ms)
       │
       ├─► prompt.typed { textLength, wordCount, currentTextHash, revisionDepth }
       └─► pause.detected { durationMs, textLength }
       │
       ▼
EventBus (synchronous dispatch)
       │
       ▼
StateEngine
       ├─► InteractionTracker.trackTyping(wordCount, textLength, isRevision, now)
       │      ├─ Computes current WPM = (wordsDelta / timeDeltaSeconds) * 60
       │      └─ Updates EMA baseline = alpha * currentWpm + (1 - alpha) * prevEma
       │
       ├─► InteractionTracker.generateSnapshot(now)
       │      └─ Returns StateSnapshot { wordsPerMinute, baselineWpm, revisionRate, pauseDurationMs, ... }
       │
       ├─► StateEvaluator.evaluate(snapshot)
       │      ├─ If sampleCount >= minSamples:
       │      │     • Coasting: WPM > baseline * 1.20 AND revisionRate < coastingThreshold
       │      │     • Overload: WPM < baseline * 0.70 AND revisionRate > overloadThreshold
       │      │     • Stretch: WPM near baseline AND low revisionRate AND pauseDurationMs > stretchThreshold
       │      └─ Else (Cold-start): Fallback to static velocity thresholds
       │
       ├─► TransitionPolicy.approveTransition(proposedState, now)
       │      └─ Enforces 5s cooldown and 3 sustained measurements
       │
       └─► eventBus.publish(CognitiveEvents.STATE_CHANGED, { previousState, currentState, confidence })
```

---

## 4. Verification & Testing Plan

### Automated Self-Test
- **Suite**: `src/tests/engines/state/StateEngine.selftest.ts`
- **Assertions**:
  1. `TypingObserver` threshold constant verification (1200ms).
  2. WPM calculation correctness over deterministic timestamps.
  3. EMA baseline convergence over successive typing events.
  4. Cold-start fallback path execution when sample count is low.
  5. Coasting classification (+20% WPM above baseline).
  6. Overload classification (-30% WPM with high revision rate).
  7. Stretch classification (near baseline, low revision rate, long pause).
  8. `TransitionPolicy` hysteresis enforcement (cooldown + sustained measurements).
  9. Accurately populated `previousState` in `state.changed` payload.
  10. Session lifecycle reset (`session.started` clears tracker and baseline).

### Static Type Check
- Command: `npx tsc --noEmit`
- Requirement: Zero compilation errors under strict TypeScript configuration.

---

## 5. Definition of Done Checklist

- [ ] Pause threshold in `TypingObserver` set to 1200ms.
- [ ] `InteractionTracker` computes WPM and EMA baseline without creating new classes.
- [ ] `StateEvaluator` implements baseline-relative rules and cold-start fallback.
- [ ] `StateEngine` accurately forwards wordCount, textLength, previousState, and handles DI.
- [ ] `state_engine_rules.json` and loader/schema extended additively.
- [ ] `StateEngine.selftest.ts` written and passing all assertions.
- [ ] Post-implementation overview document created.
- [ ] `npx tsc --noEmit` clean.
- [ ] Single clean git commit on `feature/week2-state-inference`.
- [ ] Dry-run merge check with `main` passes cleanly without conflicts.
