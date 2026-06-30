# IndexedDB Event Store — Architecture Walkthrough

**Module**: `src/storage/`
**Owner**: Suchit (Storage Layer) + Naren (Architecture Governance)
**Implementation Date**: 2026-06-26
**Status**: Implemented and Verified
**Reference**: [IndexedDB Event Store Implementation Plan](../implementation-plans/week1-indexeddb-event-store-implementation-plan.md)

---

## 1. Executive Summary

The IndexedDB Event Store has been successfully implemented, establishing the durable "memory" of the Cognis cognitive operating system. This layer strictly enforces append-only event sourcing semantics, bridging the synchronous, in-memory `EventBus` to persistent browser storage (`IndexedDB`) without introducing latency to domain engines or coupling them to storage APIs.

## 2. Files Created and Modified

### Storage Layer (Implemented as planned)
- **[NEW]** `src/storage/types.ts`: Defines `EventStoreContract`. This is the pure TypeScript interface enforcing append-only semantics (no `put`, `update`, or `delete`).
- **[NEW]** `src/storage/migrations/v1.ts`: Implements the `v1Migration` object containing the `version: 1` schema definition for `cognis_v1`, explicitly defining `events`, `user_profiles`, and `read_models` stores, along with primary keypaths and indices.
- **[NEW]** `src/storage/indexeddb/CognisDatabase.ts`: Implements a Promise-based IndexedDB connection manager. Contains migration runner logic (`onupgradeneeded`), connection pooling (`attemptOpen`), block handling (`onblocked`), corruption recovery (`deleteDatabase`), and transaction safety wrappers. Contains strictly zero business logic.
- **[NEW]** `src/storage/indexeddb/EventStoreSubscriber.ts`: Bridges `EventBusContract` and `EventStoreContract`. Initializes by subscribing to **all** namespaces exported in `src/core/event-bus/registry.ts`. Hands events off to the repository asynchronously (fire-and-forget) to respect the <5ms latency budget, while isolating and routing storage errors to an `ErrorReporter`.
- **[MODIFY]** `src/storage/repositories/EventRepository.ts`: Overwrote the placeholder. Fully implements `EventStoreContract` over `CognisDatabase`. Strictly utilizes `tx.objectStore(...).add()` to guarantee immutability (duplicates throw constraint errors instead of overwriting) and uses IndexedDB range queries (`IDBKeyRange`) to fulfill contract bounds.
- **[MODIFY]** `src/storage/indexeddb/index.ts`: Updated to export `CognisDatabase` and `EventStoreSubscriber`, replacing the `TODO` placeholder.

### Foundation Layers (Unmodified)
- **Zero changes** to `src/core/event-bus/EventBus.ts`.
- **Zero changes** to `src/core/event-bus/contracts.ts` (Domain Contracts).
- **Zero changes** to `src/core/event-bus/registry.ts`.
- **Zero changes** to `src/core/types/session.types.ts`.
- All interactions execute strictly via the established interfaces (`EventBusContract`, `DomainEvent<T>`).

## 3. Architectural Decisions & Mappings

| Architecture Requirement | Implementation Result |
| --- | --- |
| **Separation of Concerns** (Constitution Section 3) | Queries belong to `EventRepository`, connections belong to `CognisDatabase`, routing belongs to `EventStoreSubscriber`. Domain engines do not know IndexedDB exists. |
| **Append-Only Immutability** (Constitution Section 2) | `EventRepository.append` strictly uses `IDBObjectStore.add()`. No `update()` or `delete()` methods exist on `EventStoreContract`. |
| **Non-blocking EventBus** | `EventStoreSubscriber` consumes `eventBus.subscribe()` synchronously but invokes `eventRepository.append()` as an un-awaited Promise. Storage latency cannot block engine dispatch. |
| **Canonical Identifiers** | All schemas respect `EventId`, `SessionId`, and `Timestamp` branded types. Because they brand over primitives (strings/numbers), they serialize to IndexedDB flawlessly without adapter classes. |
| **Schema Evolution** | `CognisDatabase.ts` accepts an array of `Migration` objects. `v1.ts` is decoupled from the runner, supporting future `v2.ts` extensions seamlessly. |

## 4. Preservation of Invariants

- **EventBus Isolation**: The `EventBus` remains a pure memory-transport layer. It does not import `indexedDB` or any storage modules.
- **Failure Containment**: If IndexedDB exhausts quota or blocks the connection, `EventStoreSubscriber` traps the exception and routes it to `ErrorReporter`. The `EventBus` never throws.
- **Strong Typing**: `CognisEventMap` and `DomainEvent<T>` envelopes dictate the shape of what goes into storage. Event structure compliance is enforced at compile time.

## 5. Verification Steps Executed

- `npx tsc --noEmit` passed cleanly.
  - *Note: Resolved an initial import isolation constraint by successfully routing the `EventBusContract` import to `src/core/event-bus/types` rather than importing directly from the `EventBus` implementation file.*
- Contract satisfaction confirmed: `EventRepository` successfully satisfies all `EventStoreContract` signatures without `any` casting.

## 6. Definition of Done Checklist

- [x] Connection manager implements Promise-wrapper and handles `onupgradeneeded` safely.
- [x] Schema v1 is implemented matching Section 4 of the plan.
- [x] `EventRepository` strictly uses `.add()` (never `.put()`).
- [x] Subscriber bridges the `EventBus` without blocking synchronous dispatch loops.
- [x] All foundation contracts (`EventBus`, `DomainEvent`, `Branded Types`) remain untouched.
- [x] Strict TypeScript compilation (`npx tsc --noEmit`) passes.
