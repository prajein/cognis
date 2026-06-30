# Week 2 Projection Builders — Architecture Walkthrough

**Module**: `src/storage/projections/`
**Owner**: Naren (Architecture Governance)
**Implementation Date**: 2026-06-30
**Status**: Implemented and Verified
**Reference**: [Projection Builders Implementation Plan](../implementation-plans/week3-projection-builders-implementation-plan.md)

---

## 1. Executive Summary

The Projection Layer has been successfully implemented, completing a core milestone in Cognis' CQRS architecture. This layer isolates mutable, query-optimized read models from the append-only event store. 

By consuming domain events asynchronously and replaying them deterministically, Projection Builders generate real-time read models (Session state, Gap profiles, automaticity trends, and user Identity profiles) that are easily consumable by the presentation layers.

## 2. Files Created and Modified

### Database Schema Migration
- **[NEW]** `src/storage/migrations/v3.ts`: Bumps the IndexedDB schema version to 3 and initializes the `read_models` object store.
- **[MODIFY]** `src/background/index.ts`: Registers `v3Migration` to the upgrade pipeline.

### Projections Infrastructure
- **[NEW]** `src/storage/projections/interfaces.ts`: Defines the `ProjectionBuilder` interface, mandating deterministic execution and idempotency.
- **[NEW]** `src/storage/projections/ProjectionManager.ts`: The central orchestrator that subscribes builders to the EventBus, streams ordered historical event replays, and traps builder exceptions to isolate failures.
- **[NEW]** `src/storage/repositories/ReadModelRepository.ts`: Provides decoupled database CRUD actions (`get`, `put`, `delete`) inside transactional boundaries for read models.

### Concrete Builders
- **[NEW]** `src/storage/projections/builders/SessionProjectionBuilder.ts`: Tracks active/paused statuses, pause accumulations, and session lifespans.
- **[NEW]** `src/storage/projections/builders/GapProfileProjectionBuilder.ts`: Aggregates the frequency and last detection timestamp of user cognitive gaps.
- **[NEW]** `src/storage/projections/builders/IdentityProjectionBuilder.ts`: Accumulates generated behavioral insights to construct a queryable identity structure.
- **[NEW]** `src/storage/projections/builders/AutomaticityProjectionBuilder.ts`: Records skill automaticity shifts over time, mapping mastery transitions.

---

## 3. Architectural Decisions & Mappings

| Architecture Requirement | Implementation Result |
| --- | --- |
| **Separation of Write & Read Models (CQRS)** | Events are written to the `events` store. Read models are written to the isolated `read_models` store. Neither interacts directly. |
| **Disposability** (Constitution Section 3) | If a read model schema evolves, the table is cleared and rebuilt entirely from the event store. Events are the only persistent state of record. |
| **Idempotency** | Builders use upsert operations (`put`) and unique key-matching to tolerate at-least-once event delivery patterns. |
| **Isolative Error Handling** | Failures in individual builders are reported to `ErrorReporter` but never halt the EventBus or interrupt other builders. |

---

## 4. Preservation of Invariants

- **Sequential Ordering**: Historical replays stream sequentially, sorted by timestamp ascending, to prevent race conditions or invalid chronological transitions.
- **Determinism**: Projections use zero external dependencies, clock readings, or system variables. Replaying the event stream twice is guaranteed to produce the exact same read model representation.

---

## 5. Verification Steps Executed

- Compilation succeeded with `npx tsc --noEmit` and confirmed zero static errors.
- Verified that re-running identical event batches behaves idempotently without duplicating key rows or history maps.
- Verified that transaction bounds are isolated at the single database transaction block level.

---

## 6. Definition of Done Checklist

- [x] IndexedDB upgraded to v3 and `read_models` table initialized.
- [x] `ProjectionBuilder` and `ProjectionManager` fully implemented.
- [x] Session, Gap, Identity, and Automaticity builders created.
- [x] Event replay ordering guaranteed via timestamp indices.
- [x] Error boundaries established at the builder execution layer.
- [x] Strict TypeScript compilation passes.
