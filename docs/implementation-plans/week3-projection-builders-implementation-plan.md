# Projection Builders — Implementation Plan

**Module**: `src/storage/projections/`
**Owner**: Naren (Architecture Governance)
**Status**: Draft — Pending Architecture Lead Approval
**Constitution Reference**: Section 1 (Event-Driven Architecture), Section 2 (Local-First)

---

## 1. Executive Summary

This implementation plan defines the **Projection Layer** for the Cognis architecture. Projections (or Read Models) bridge the gap between our append-only, immutable Event Store and the complex querying needs of the UI and Insight Engines. 

Projection Builders consume immutable Domain Events (Facts) and produce query-optimized state representations (Read Models). Crucially, projections are strictly disposable, deterministic, and rebuildable. They never modify the underlying event log, enforcing the absolute separation of writes (Event Sourcing) and reads (CQRS).

---

## 2. ADR-018: Read Model Persistence and Replay Strategy

### Context
Querying the raw event log (via `EventRepository`) is inefficient for complex state derivations like calculating a user's current identity profile or gap taxonomy mastery over time. We need structured read models.

### Decision
1. **Separation of Concerns**: Projections will be stored in a separate IndexedDB object store (`read_models`), completely isolated from the `events` store.
2. **Disposability**: Read models are ephemeral from an architectural standpoint. If a schema changes or a bug is found, the read model is truncated and rebuilt entirely from the `events` store.
3. **Idempotency**: All `handleEvent` operations within a builder must be idempotent to tolerate at-least-once delivery during live EventBus subscriptions and Replay scenarios.
4. **Replay Orchestration**: A `ProjectionManager` orchestrates rebuilds by querying the `EventRepository` using `getBySessionOrdered` or `getByTimeRange` and streaming the events sequentially to the builders.

---

## 3. Data Classification Enforcement (Ref: ADR-005)

To prevent architectural drift, this layer enforces strict classification:
- **Facts (Domain Events)**: Stored in `events`. Immutable. Source of truth.
- **Knowledge (Reference Data)**: Stored in JSON (e.g., `activation_profiles.json`). Static at runtime.
- **Projections (Read Models)**: Stored in `read_models`. Mutable by Projection Builders. Derived purely from Facts. Disposable.

---

## 4. Initial Projection Builders

We will implement the following foundational builders:

### A. Session Projection (`SessionProjectionBuilder`)
- **Purpose**: Maintains the active state of a user's session, tracking duration, pauses, and active platform.
- **Consumes**: `session.started`, `session.ended`, `session.paused`, `session.resumed`.
- **Output Schema**: `{ sessionId, platform, startTime, status, totalPauseDurationMs }`

### B. Gap Profile Projection (`GapProfileProjectionBuilder`)
- **Purpose**: Aggregates a user's cognitive gaps over time to identify chronic weak points (e.g., struggles with logical edge cases).
- **Consumes**: `gap.detected`, `ghosttext.accepted`, `ghosttext.dismissed`.
- **Output Schema**: `{ userId, gapType, frequencyCount, lastDetectedAt, acceptanceRate }`

### C. Identity Projection (`IdentityProjectionBuilder`)
- **Purpose**: Derives user preferences and behavioral identity from explicit events and implicit patterns.
- **Consumes**: `prompt.enriched`, `response.abandoned`, `insight.generated`.
- **Output Schema**: `{ userId, preferredTone, verbosityPreference, cognitiveStateAverages }`

### D. Automaticity Projection (`AutomaticityProjectionBuilder`)
- **Purpose**: Tracks skill mastery phases (Cognitive, Associative, Autonomous) based on typing cadence and gap resolution.
- **Consumes**: `automaticity.updated`, `pause.detected`, `prompt.typed`.
- **Output Schema**: `{ skillDomain, currentPhase, currentScore, historicalTrend: [] }`

---

## 5. Contracts & Interfaces

### 5.1. The Builder Interface
```typescript
export interface ProjectionBuilder {
  /** Unique identifier & version (e.g., 'session-v1') */
  readonly projectionId: string;

  /** List of event types this builder consumes. */
  readonly consumedEvents: ReadonlyArray<EventType>;

  /** Handles a single event live (must be idempotent). */
  handleEvent(event: DomainEvent<any>): Promise<void>;

  /** Clears the read model (used prior to a rebuild). */
  clear(): Promise<void>;
}
```

### 5.2. The Orchestrator
```typescript
export class ProjectionManager {
  /** Subscribes builders to the EventBus for live updates. */
  public startLiveSubscriptions(): void;

  /** 
   * Truncates read models and rebuilds them sequentially by streaming 
   * ordered events from the EventRepository. 
   */
  public async rebuildAll(sessionId?: string): Promise<void>;
}
```

---

## 6. Execution & Concurrency Model

### Live Execution (EventBus)
When an event occurs, the `EventBus` broadcasts it. The `EventStoreSubscriber` persists it to the `events` store. Simultaneously, the `ProjectionManager` routes the event to interested builders.
- **Failure Isolation**: If `GapProfileProjectionBuilder` throws an error during `handleEvent`, the `ProjectionManager` traps the error via `ConsoleErrorReporter`. The failure *does not* prevent the event from being stored, nor does it crash the EventBus or other projections.

### Replay Execution (EventRepository)
During a rebuild, the `ProjectionManager`:
1. Calls `clear()` on all builders.
2. Queries the `EventRepository` (e.g., `getBySessionOrdered`).
3. Feeds events sequentially into the builders.
- **Ordering Guarantees**: Events are strictly ordered by `timestamp` ascending.
- **Batching**: Future implementations may introduce a `handleEventsBatch()` to optimize IndexedDB transaction overhead during massive rebuilds.

---

## 7. Repository Layout Impact

```text
src/storage/
├── indexeddb/
│   ├── CognisDatabase.ts      // (Modified to include 'read_models' store)
│   └── EventStoreSubscriber.ts
├── repositories/
│   ├── EventRepository.ts
│   └── ReadModelRepository.ts // (NEW: Generic CRUD for projections)
└── projections/               // (NEW DIRECTORY)
    ├── interfaces.ts          // ProjectionBuilder contract
    ├── ProjectionManager.ts   // Orchestrator
    └── builders/
        ├── SessionProjectionBuilder.ts
        ├── GapProfileProjectionBuilder.ts
        ├── IdentityProjectionBuilder.ts
        └── AutomaticityProjectionBuilder.ts
```

---

## 8. Failure Isolation & Replay Correctness

1. **Transaction Boundaries**: Projections write to IndexedDB using separate, short-lived transactions to avoid locking the database during live operation.
2. **Idempotency**: Builders use `put` operations based on derived primary keys (e.g., `sessionId` or `gapType`) rather than `add`, ensuring that replaying the exact same event twice yields the exact same read model state without throwing constraint errors.
3. **Replay Determinism**: Builders are completely deterministic. They hold no internal state other than what is derived from the event payload. 

---

## 9. Testing Strategy

1. **Unit Tests (`*ProjectionBuilder.spec.ts`)**: 
   - Inject an array of mock domain events and verify the resulting read model state matches expectations.
   - Verify idempotency by feeding the same array twice and ensuring the state does not duplicate or corrupt.
2. **Integration Tests (`ProjectionManager.spec.ts`)**:
   - Verify that an error thrown by one builder does not halt the `ProjectionManager` loop.
3. **Architecture Validation**:
   - Verify `src/storage/projections` imports no DOM APIs, no network APIs, and no Reference Data write APIs.

---

## 10. Definition of Done
- [ ] `read_models` object store migration implemented in `CognisDatabase`.
- [ ] `ProjectionBuilder` interface and `ProjectionManager` implemented.
- [ ] Initial builders (Session, Gap, Identity, Automaticity) implemented with idempotency guarantees.
- [ ] Live subscription wiring via EventBus.
- [ ] Rebuild pipeline via `EventRepository`.
- [ ] Comprehensive unit test coverage proving replay determinism.
- [ ] Zero compilation errors (`tsc --noEmit`).
