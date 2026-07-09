# Week 3: Insight & State Engines Implementation Overview

## 1. Executive Summary

This overview details the implementation and verification of the **Insight Engine** modernization and the **State Engine** architecture on the Cognis platform. 

The implementation achieves two critical milestones:
1. It aligns the **Insight Engine's Reasoning Pipeline** with CQRS principles by replacing direct database queries and event-history scanning with an immutable, pre-materialized `ReasoningContext` populated solely via `ReadModelRepository`.
2. It introduces a fully realized, rules-driven **State Engine** that monitors user interactions (velocity, revision rates, pauses) and infers cognitive load states (`stretch`, `coasting`, `overload`) using transition hysteresis to prevent state oscillation.

---

## 2. Technical Architecture & Data Flows

### 2.1 Insight Engine: CQRS-Compliant Pipeline

The `ReasoningPipeline` operates on a strict **Async-Build / Sync-Execute** flow, ensuring strategies remain side-effect-free, storage-agnostic, and purely deterministic.

```
                  ┌──────────────────────┐
                  │ ReadModelRepository  │
                  └──────────┬───────────┘
                             │ (Async Query)
                             ▼
               ┌───────────────────────────┐
               │  ReasoningContextBuilder  │
               └─────────────┬─────────────┘
                             │ (Substitute Default Read Models)
                             ▼
                ┌─────────────────────────┐
                │    ReasoningContext     │ (Immutable Snapshot)
                └────────────┬────────────┘
                             │
                             ▼
                ┌─────────────────────────┐
                │    ReasoningPipeline    │ (Sync Execute)
                └────────────┬────────────┘
                             │
                             ▼
                ┌─────────────────────────┐
                │    InsightStrategy      │ (e.g., V1AutomaticityEvaluator)
                └────────────┬────────────┘
                             │
                             ▼
                     [insight.generated]
```

### 2.2 State Engine: Decoupled Metric Pipeline

The `StateEngine` orchestrates state tracking, evaluation, and transition policies, delegating computational responsibilities to dedicated modules to preserve orchestration-only boundaries.

```
    [prompt.typed] / [pause.detected]
                   │
                   ▼
         ┌───────────────────┐
         │InteractionTracker │ (Aggregates velocity / backspaces)
         └─────────┬─────────┘
                   │
                   ▼
         ┌───────────────────┐
         │   StateSnapshot   │ (Immutable derived metrics)
         └─────────┬─────────┘
                   │
                   ▼
         ┌───────────────────┐
         │  StateEvaluator   │ (Maps rules from state_engine_rules.json)
         └─────────┬─────────┘
                   │
                   ▼
         ┌───────────────────┐
         │ TransitionPolicy  │ (Enforces cooldowns & sustained counts)
         └─────────┬─────────┘
                   │
                   ▼
          [state.changed]
```

---

## 3. Key Components & Implementation Details

### 3.1 Insight Engine Components
- **`ReasoningContextBuilder`**: Batches asynchronous reads to IndexedDB via the `ReadModelRepository`. If any read models are missing (e.g., on first startup), the builder guarantees zero null-checks downstream by substituting deterministic fallback instances:
  - `DefaultGapReadModel`
  - `DefaultIdentityReadModel`
  - `DefaultAutomaticityReadModel`
  - `DefaultSessionReadModel`
  - `DefaultResponseMetricsReadModel`
- **`ReasoningPipeline`**: Manages execution. Instantiates strategies, builds context, triggers evaluation synchronously, and publishes generated insights back to the `EventBus`.
- **`V1AutomaticityEvaluator`**: Refactored to compute skill transitions (e.g., *Cognitive -> Associative -> Autonomous*) by checking the materialized `context.responseMetrics` and `context.gapProfile` read models, completely eliminating historical event store scans.

### 3.2 State Engine Components
- **`InteractionTracker`**: Maintains raw interaction metrics (character counts, backspaces, pause lengths) and translates them into typing velocity and revision rate metrics.
- **`StateEvaluator`**: Processes the `StateSnapshot` against rules loaded via `StateRulesLoader` (backed by a JSON schema-validated configuration file, `state_engine_rules.json`).
- **`TransitionPolicy`**: Encapsulates hysteresis. A state transition is only approved if:
  1. The cooldown period (`cooldownMs`) since the last state change has elapsed.
  2. The proposed new state is sustained for a minimum number of measurements (`requiredSustainedMeasurements`), preventing jitter and flickering.
- **`StateEngine`**: composición root for the state module. Listens to platform session and typing events, triggers evaluations, and dispatches the final `state.changed` domain event when transitions are approved.

---

## 4. Testing & Verification

All tests were consolidated under `src/tests/` to keep production distribution clean and ensure local TypeScript builds pass.

### 4.1 Unit Test Coverage
1. **`ReasoningContextBuilder.selftest.ts`**:
   - Assures that missing/empty database results correctly fallback to default models.
   - Verifies properties like default session state and empty gap lists.
2. **`ReasoningPipeline.selftest.ts`**:
   - Mocks `InsightStrategy` to assert that synchronous strategy execution completes and correctly fires `insight.generated` events onto the Event Bus.
3. **`TransitionPolicy.selftest.ts`**:
   - Tests and validates the hysteresis cooldown logic.
   - Confirms that single-event load spikes do not bypass the sustained measurement requirements.
4. **`StateEngine.selftest.ts`**:
   - Runs integration verification simulating user typing bursts to verify orchestration without throwing runtime errors.

---

## 5. Architectural Compliance & Constitution

- **ADR-019 Compliant**: No raw user prompt text is monitored or persisted during state calculations or context assemblies. Only text lengths, word counts, and hashes are handled.
- **Zero-Storage Leakage in Reasoning**: Strategies execute as pure, side-effect-free functions. They are passed context and return candidates; they do not perform write operations.
- **TypeScript Conformity**: `tsc --noEmit` checks run cleanly across the repository with all `createDomainEvent` invocations strictly conforming to the `CognisEventMap` envelope definitions.
