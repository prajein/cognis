# Week 3 Storage Hardening & Projections — Architecture Walkthrough

**Module**: `src/storage/`
**Owner**: Architecture Lead
**Implementation Date**: 2026-06-30
**Status**: Implemented and Verified
**Reference**: [Storage Hardening & Projections Plan](../implementation-plans/week3-storage-hardening-and-projections-plan.md)

---

## 1. Executive Summary

The storage layer has been successfully hardened to support strict local-first data privacy guarantees and deterministic response quality analytics. 

By implementing an Anti-Corruption Layer (ACL) through a versioned `DefaultPersistenceMapper`, the system ensures compliance with **ADR-019 (Transient Transport Data Policy)** without leaking streaming text to the physical database. Furthermore, a dedicated `ResponseMetricsProjectionBuilder` calculates multi-dimensional quality scores utilizing drift-proof moving sum structures, and the IndexedDB layer is protected against concurrent write errors and database quota exhaustion.

---

## 2. Files Created and Modified

### Database Infrastructure & Mapping
- **[NEW]** `src/storage/indexeddb/PersistenceMapper.ts`: Encapsulates the versioned `DefaultPersistenceMapper` and defines the `PersistenceEventV1DTO` layout, enforcing pure functional sanitization policies without object mutations.
- **[MODIFY]** `src/storage/indexeddb/EventStoreSubscriber.ts`: Integrated the `DefaultPersistenceMapper` to isolate domain events from the IndexedDB serialization boundaries.
- **[MODIFY]** `src/storage/repositories/EventRepository.ts`: Enforces non-destructive QuotaExceeded policies by throwing/rejecting event appends immediately, preserving the Event Store as the source of truth.

### Projection Layer
- **[NEW]** `src/storage/projections/builders/ResponseMetricsProjectionBuilder.ts`: Evaluates `response.analysis.completed` events, maintaining sums of metrics to prevent floating-point drift.
- **[MODIFY]** `src/storage/repositories/ReadModelRepository.ts`: Added the `update<T>` method to encapsulate read-modify-write sequences within a single IndexedDB `readwrite` transaction.
- **[MODIFY]** `src/background/index.ts`: Wired up all 5 projection builders (`Session`, `Gap`, `Identity`, `Automaticity`, and `ResponseMetrics`) to the `ProjectionManager` inside the background bootstrap root.

---

## 3. Architectural Decisions & Mappings

| Architecture Requirement | Implementation Result |
| --- | --- |
| **Transient Data Isolation (ADR-019)** | `DefaultPersistenceMapper` intercepts events. It strips transport fields (e.g., `chunkText`) cleanly using functional filters, producing a `PersistenceEventV1DTO`. |
| **Drift-Free Analytics** | `ResponseMetricsProjectionBuilder` stores metric sums (`qualitySum`, `reasoningSum`, `structureSum`) and a `totalResponses` count. Precalculated averages are eliminated. |
| **Safe Concurrency** | The repository's `update` method runs a single database transaction, resolving race conditions from rapid concurrent updates. |
| **Preserve Source of Truth** | Automated event purging is explicitly prohibited. `QuotaExceededError` triggers database halts, preserving historical replays. |

---

## 4. Preservation of Invariants

- **Immutability**: DomainEvents remain unaltered inside the memory space. The `DefaultPersistenceMapper` yields independent persistence DTO mappings rather than in-place properties deletion.
- **Idempotency**: Projections do not deduplicate events internally. Rather, replay determinism relies on the sequential rebuilding and atomic transactional mapping from the orchestrator.

---

## 5. Verification Steps Executed

- Executed `tsc --noEmit` and confirmed zero static compilation errors.
- Verified transaction boundaries through atomic `update` sequences.
- Confirmed that `onblocked` and `onversionchange` database hooks successfully close older connection instances during updates, preventing connection deadlocks.
