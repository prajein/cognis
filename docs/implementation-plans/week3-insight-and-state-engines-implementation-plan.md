# Architecture & Implementation Plan: Insight & State Engines

**Document Type:** Staff/Principal Engineer Architecture RFC
**Focus:** Insight Engine pipeline modernization & State Engine architecture
**Status:** Approved for Implementation

---

## Executive Summary

This RFC details the architectural modernization for two critical intelligence subsystems within Cognis: the **Insight Engine** and the **State Engine**. 

Historically, the `ReasoningPipeline` relied on mocked event logs, violating CQRS principles, while the `StateEngine` was a stub. This plan modernizes both paths. The Insight Engine is restructured to reason exclusively over materialized CQRS Read Models via a pure, synchronous strategy pipeline, eliminating all dependencies on the raw event log. Simultaneously, the State Engine is architected as a layered, deterministic state machine driven purely by interaction signals, employing hysteresis and explicit transition policies to prevent cognitive state flickering. 

All designs strictly enforce Local-First computation, Event Sourcing, and the zero-persistence-transport mandates of ADR-019.

---

## Engineering Philosophy

This architecture acts as an engineering constitution for these two intelligence subsystems, strictly prioritizing:

- **Evidence-First Computation:** Insights are generated strictly from materialized historical evidence, never from runtime heuristics alone.
- **Dependency Inversion:** All intelligence subsystems depend on abstractions rather than concrete storage implementations. Repository access is isolated to the Context Builder, ensuring the reasoning layer remains storage-agnostic and independently testable.
- **CQRS Separation:** Intelligence reads from models, actions publish to the EventBus. Repositories are strictly read-only for reasoning operations.
- **Deterministic Reasoning:** Identical context must produce identical insights. 
- **Immutable Data Structures:** All snapshots and contexts are strictly read-only after construction.
- **Pure Functions:** Strategies are side-effect-free, synchronous, and oblivious to storage mechanisms.
- **Dependency Injection:** Explicit component boundaries; no singletons or hidden mutable global state.
- **Composability:** Layers interact via strictly defined DTOs, enabling independent testing and scaling.
- **Local-First Principles:** All data remains entirely on-device, conforming strictly to ADR-019 privacy guarantees.

---

## 1. Insight Engine: Pure CQRS Reasoning Architecture

### 1.1 The Immutable `ReasoningContext` Abstraction
The `ReasoningContext` is a **fully materialized immutable reasoning snapshot** composed entirely from CQRS Read Models before the pipeline begins execution.

```typescript
export interface ReasoningContext {
  readonly sessionId: string;
  readonly now: number;
  
  // Fully materialized immutable read models
  readonly sessionMetrics: Readonly<SessionReadModel>;
  readonly automaticityProfile: Readonly<AutomaticityReadModel>;
  readonly gapProfile: Readonly<GapProfileReadModel>;
  readonly identityProfile: Readonly<IdentityReadModel>;
  readonly responseMetrics: Readonly<ResponseMetricsReadModel>;
}
```
**Architectural Contract:** 
- The builder never exposes repositories downstream.
- Strategies never perform queries or network I/O.
- Strategies remain completely unaware that repositories exist.

### 1.2 `ReasoningContextBuilder`: Missing Projection Handling
The `ReasoningContextBuilder` bridges the asynchronous I/O boundary, querying the `ReadModelRepository` and returning the immutable `ReasoningContext`.

**Missing Projection Behavior:**
- Missing projections are *expected* (e.g., at the start of a session or a fresh installation).
- Missing projections are *never* treated as errors.
- Strategies must *never* perform null checks.
- The builder owns all completeness guarantees. Every missing projection is seamlessly replaced with a deterministic, fully formed default read model (e.g., `DefaultIdentityReadModel`, `DefaultGapReadModel`, `DefaultAutomaticityReadModel`, `DefaultResponseMetricsReadModel`, `DefaultSessionReadModel`).

### 1.3 `ReasoningContext` Lifecycle
The context is ephemeral and exists solely for the duration of a single pipeline execution. The strictly enforced lifecycle is:

1. `ReadModelRepository` asynchronously queried by the Builder.
2. Default Read Models substituted where data is missing.
3. Immutable `ReasoningContext` assembled.
4. `ReasoningPipeline` executes synchronously.
5. Context discarded for garbage collection.

### 1.4 Pure Synchronous Pipeline Execution
Because the `ReasoningContextBuilder` absorbs all asynchronous I/O and assembles a perfect context graph, the pipeline itself remains perfectly synchronous:

```
Read Models
        │
        ▼
ReasoningContextBuilder (async validation & assembly) 
        │
        ▼
ReasoningContext (immutable snapshot)
        │
        ▼
ReasoningPipeline (sync)
        │
        ▼
InsightStrategies (pure, sync, deterministic)
        │
        ▼
Insight
```

### 1.5 Projection Evolution & Extensibility
This architecture ensures that new projections can be introduced without modifying existing Insight Strategies. As the system scales, we will introduce:
- `LearningProjection`
- `SkillGraphProjection`
- `MemoryProjection`
- `KnowledgeGraphProjection`
- `BehavioralProjection`

*Only* the `ReasoningContextBuilder` and the `ReasoningContext` type definition evolve to accommodate these. Existing strategies remain perfectly untouched, highlighting the primary architectural advantage of this separation of concerns.

---

## 2. State Engine: Layered Interaction Inference

The State Engine estimates the user's cognitive interaction state (`stretch`, `coasting`, `overload`). It strictly observes physical interaction signals, decoupled entirely from business logic events. 

### 2.1 Component Architecture

```
Interaction Signals (prompt.typed, pause.detected)
        │
        ▼
InteractionTracker
        │
        ▼
StateSnapshot
        │
        ▼
StateEvaluator
        │
        ▼
TransitionPolicy
        │
        ▼
StateDecision
        │
        ▼
StateEngine (publishes state.changed)
```

### 2.2 `StateSnapshot` (Derived Interaction Metrics)
The `StateSnapshot` represents **derived interaction metrics**, never raw DOM events or browser objects. It is an immutable analytical snapshot containing processed measurements:
- `typingVelocity` (chars/sec)
- `rollingTypingAverage`
- `revisionRate` (backspaces/edits over time)
- `rollingRevisionAverage`
- `pauseDurationMs`
- `idleDurationMs`
- `interactionDensity`
- `timestamp`

### 2.3 `TransitionPolicy` (Hysteresis & Cooldowns)
Hysteresis and transition logic are isolated into a dedicated architectural component, `TransitionPolicy`. 
This clearly separates threshold evaluation (is the user currently typing fast?) from transition approval (have they been typing fast long enough to change state?).

**Responsibilities:**
- Enforces transition cooldowns.
- Evaluates sustained evidence requirements.
- Prevents oscillation and state flickering.
- Emits a final `StateDecision` instructing the `StateEngine` to transition.

### 2.4 Configuration Architecture
Thresholds, evaluation weights, and transition cooldowns belong in configuration, not code. We introduce `state_engine_rules.json` and a strictly typed `state-rules-loader.ts`, perfectly mirroring the existing `gap_rules.json` loader conventions.

---

## 3. Performance Budgets

These are architectural target budgets, ensuring the intelligence layer never impacts the primary rendering thread or interaction latency.

| Subsystem | Latency Budget | Target Behavior |
|-----------|----------------|-----------------|
| `ReasoningContextBuilder` | **<10 ms** | 1-2 IndexedDB queries (batched), async |
| `ReasoningPipeline` | **<5 ms** | In-memory synchronous loop |
| `InsightStrategy.execute()`| **<1 ms** (per) | Pure evaluation |
| `StateSnapshot` Generation | **<0.5 ms** | O(1) derived metric calculation |
| `StateEvaluator` | **<1 ms** | Sync rule processing |

---

## 4. Implementation Breakdown

### Phase 1: Insight Engine Modernization
1. **Update Interfaces:** Redefine `ReasoningContext` in `src/engines/insights/interfaces.ts`. Ensure `InsightStrategy` remains strictly synchronous.
2. **Implement Builder:** Create `src/engines/insights/pipeline/ReasoningContextBuilder.ts` to implement safe empty defaults (e.g., `DefaultGapReadModel`).
3. **Update Pipeline:** Modify `ReasoningPipeline.ts` to accept the `ReasoningContextBuilder` and orchestrate the async build → sync execution flow.
4. **Refactor Strategies:** Update `V1AutomaticityEvaluator.ts` to read directly from `context.automaticityProfile` seamlessly.

### Phase 2: State Engine Implementation
1. **Config Loader:** Create `src/core/config/state_engine_rules.json`, `state_engine_rules.schema.json`, and `state-rules-loader.ts`.
2. **Domain Models:** Define `StateSnapshot` and metric models.
3. **Core Components:** Implement `InteractionTracker.ts`, `StateEvaluator.ts`, `TransitionPolicy.ts`, and `StateEngine.ts` inside `src/engines/state/`.
4. **Event Wiring:** Ensure the engine subscribes strictly to interaction signals (`prompt.typed`, `pause.detected`).

---

## 5. Verification Strategy

The custom self-test framework will be expanded to validate determinism, replay safety, and boundary enforcement.

### 5.1 Insight Engine Verification
- **`ReasoningContextBuilder.selftest.ts`**:
  - Validates **default read model generation**: missing projections correctly resolve to `Default*ReadModel` structures.
  - Validates **immutable snapshot creation**: attempting to mutate the returned context strictly fails.
- **`ReasoningPipeline.selftest.ts`**:
  - Validates **deterministic outputs**: same context yields same insights.
  - Validates **no repository access**: ensures mock strategies cannot touch storage.
  - Verifies benchmark repeatability within the 5ms budget.

### 5.2 State Engine Verification
- **`TransitionPolicy.selftest.ts`**:
  - Validates **hysteresis correctness**: isolated spikes do not trigger transitions.
  - Validates **cooldown enforcement**: transitions immediately following previous transitions are rejected.
  - Validates **oscillation prevention**: alternating high/low measurements yield a stable state.
- **`StateEngine.selftest.ts`**:
  - Validates **duplicate suppression**: no `state.changed` emitted if the approved state equals the current state.
  - Validates **deterministic state transitions**: end-to-end flow from tracker to event publication.

---

## 6. Definition of Done

This implementation is complete only when:
- [ ] No mocked reasoning data remains in the codebase.
- [ ] Runtime reasoning uses `ReadModelRepository` strictly via the Context Builder.
- [ ] Strategies remain perfectly synchronous and pure.
- [ ] `StateEngine` publishes deterministic transitions.
- [ ] `TransitionPolicy` is implemented and independently tested.
- [ ] Hysteresis is validated under oscillation conditions.
- [ ] Missing projections are handled via deterministic `Default*ReadModel` fallbacks (0 null checks).
- [ ] All new components are fully self-tested.
- [ ] `tsc --noEmit` passes cleanly.
- [ ] CQRS boundaries are verified across all components.
- [ ] Compliance with Engineering Constitution and ADR-019 is confirmed.

---

## 7. Non-Goals

To keep the implementation scope tightly controlled, this RFC explicitly will **NOT**:
- Redesign the `EventBus` or IPC bridge.
- Redesign the `EventRepository` or the underlying `CognisDatabase`.
- Redesign the `ProjectionManager`.
- Redesign Storage schemas or migrations.
- Redesign the `ResponseIntelligenceEngine` or analyzers.
- Introduce Machine Learning models for state evaluation.
- Build UI or modify the Side Panel.
- Redesign or fix existing Platform Adapters.
