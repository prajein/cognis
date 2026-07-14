# RFC 1: Cognis Storage Migration Hardening & Schema Alignment (`v3Migration`)

**Author:** Cognis Architecture Lead (`Naren`)  
**Status:** APPROVED  
**Type:** Implementation Plan / Architectural Design Document  

---

## 1. Executive Summary & Root Cause Analysis

During a comprehensive architectural audit of the Cognis storage layer (`src/storage/`), a fatal runtime collision was identified between our schema migration chain (`v1Migration` $\rightarrow$ `v3Migration`) and our CQRS read-model data access pattern (`ReadModelRepository`).

### 1.1 Historical Context: Why `v1` Created `read_models` with `projectionKey`
In the initial `v1Migration` (`src/storage/migrations/v1.ts`), `read_models` was defined with `{ keyPath: 'projectionKey' }` as a speculative placeholder for future queryable projections before the CQRS read-model abstractions (`ReadModelRepository.ts` and `ProjectionManager.ts`) were finalized. As the repository layer evolved during Week 3, the canonical identifier for domain projections was standardized to `projectionId` across `ReadModelRepository.ts` and all projection builders (`SessionProjectionBuilder`, `AutomaticityProjectionBuilder`, etc.). Rather than altering historical `v1Migration` code (which breaks schema immutability principles), `v3Migration` (`src/storage/migrations/v3.ts`) was introduced to evolve the schema to `projectionId`. However, due to the collision mechanics described below, `v3Migration` failed to actually apply this change during upgrade loops.

### 1.2 Root Cause Mechanics
1. **Initial Store Creation in `v1Migration` (`src/storage/migrations/v1.ts`)**:
   When a database is first created (`oldVersion === 0`), `v1Migration.upgrade(db, tx)` runs and executes:
   ```ts
   if (!db.objectStoreNames.contains('read_models')) {
     db.createObjectStore('read_models', { keyPath: 'projectionKey' });
   }
   ```
2. **Skipped Re-indexing in `v3Migration` (`src/storage/migrations/v3.ts`)**:
   Two iterations later inside the exact same upgrade loop (`onupgradeneeded`), `v3Migration.upgrade(db, tx)` runs:
   ```ts
   if (!db.objectStoreNames.contains('read_models')) {
     const store = db.createObjectStore('read_models', { keyPath: 'projectionId' });
   }
   ```
   Because `read_models` was created by `v1Migration` just microseconds prior, `db.objectStoreNames.contains('read_models')` evaluates to `true`. As a result, `v3Migration` entirely skips its logic. The store's primary key path remains locked to `'projectionKey'`.
3. **Runtime `DataError` inside `ReadModelRepository.ts`**:
   `ReadModelRepository.ts` enforces the canonical contract:
   ```ts
   public async put<T extends { projectionId: string }>(readModel: T): Promise<void>
   ```
   Whenever `SessionProjectionBuilder` or any other builder attempts to persist a read model (`readModelRepo.put({ projectionId: 'session_xyz', ... })`), IndexedDB throws:
   `DataError: Data provided to an operation does not meet requirements`
   because the object does not contain the required `projectionKey` property demanded by the active object store schema.
4. **Omission from Migration Registry (`src/storage/migrations/index.ts`)**:
   While `src/background/index.ts` bypasses the registry (`new CognisDatabase([v1Migration, v2Migration, v3Migration])`), `src/storage/migrations/index.ts` currently only exports `[v1Migration, v2Migration]`. Any test or future composition root importing `migrations` from `index.ts` runs against an un-upgraded schema version (`v2`).

### 1.3 State of Existing Production Data (`read_models` Population Status)
Based on the current repository state, we have found no evidence that canonical read models have ever been successfully persisted through `ReadModelRepository`. Until proven otherwise, the `read_models` store should be treated as effectively unused, though the migration should remain safe if legacy records are encountered.

---

## 2. Out of Scope

This RFC does not modify:

- `ReadModelRepository` API or contracts
- `ProjectionBuilder` interfaces or implementations
- `EventBus` behavior or event registry
- `ProjectionManager` execution or replay logic
- IndexedDB event store schema (`events` object store)

---

## 3. Architectural Invariants & Design Constraints

1. **Idempotency Across All Upgrade Paths**:
   Whether upgrading from `v0 -> v3` (fresh install), `v1 -> v3`, or `v2 -> v3`, the resulting `read_models` object store MUST have `{ keyPath: 'projectionId' }`.
2. **Safe Schema Transition & Data Preservation**:
   Before modifying the `read_models` store, the migration must first determine whether the existing store already conforms to the canonical schema. If migration is required and legacy records exist, they must be preserved or cleanly migrated without data loss. The exact implementation should be determined after verifying IndexedDB upgrade semantics during the upgrade transaction.
3. **Single Source of Truth for Migrations across Composition Roots**:
   `src/storage/migrations/index.ts` MUST export the complete, authoritative array `[v1Migration, v2Migration, v3Migration]`. `background/index.ts` must import this canonical registry rather than constructing its own inline migration array.

---

## 4. Proposed Module Changes

### Module 1: `v3Migration` Hardening
**File:** [`v3.ts`](file:///Users/ntbnaren7/Dev/cognis/src/storage/migrations/v3.ts)

**Objective**: Ensure the `read_models` object store conforms to `{ keyPath: 'projectionId' }` during upgrades.

**Success Criteria:**
- The canonical `keyPath` is `projectionId` after any upgrade path.
- Migration is idempotent: running the upgrade on an already-correct store performs no mutations.
- Existing compatible data is preserved when feasible.

**Migration Strategy**: Determine whether the existing store already conforms to the canonical schema before deciding whether migration is required. If migration is required, re-create the store with `{ keyPath: 'projectionId' }` and a `sessionId` index, preserving existing records where IndexedDB upgrade semantics allow.

---

### Module 2: Registry Alignment
**File:** [`index.ts`](file:///Users/ntbnaren7/Dev/cognis/src/storage/migrations/index.ts)

**Objective**: Register `v3Migration` inside the canonical `migrations` array so all consumers share one source of truth.

```diff
  import { Migration } from "../indexeddb/CognisDatabase";
  import { v1Migration } from "./v1";
  import { v2Migration } from "./v2";
+ import { v3Migration } from "./v3";

  /** All migrations in ascending version order. */
- export const migrations: Migration[] = [v1Migration, v2Migration];
+ export const migrations: Migration[] = [v1Migration, v2Migration, v3Migration];

  export { v1Migration } from "./v1";
  export { v2Migration } from "./v2";
+ export { v3Migration } from "./v3";
```

---

### Module 3: Composition Root Alignment
**File:** [`background/index.ts`](file:///Users/ntbnaren7/Dev/cognis/src/background/index.ts)

**Objective**: Eliminate duplicate inline migration array construction; consume the canonical registry.

```diff
- import { v1Migration } from '../storage/migrations/v1';
- import { v2Migration } from '../storage/migrations/v2';
- import { v3Migration } from '../storage/migrations/v3';
+ import { migrations } from '../storage/migrations';

  // ...

- const db = new CognisDatabase([v1Migration, v2Migration, v3Migration]);
+ const db = new CognisDatabase(migrations);
```

---

## 5. Verification Plan

### Automated Unit & Selftests
1. **Fresh Database Upgrade (`v0 -> v3`)**:
   - Instantiate `CognisDatabase(migrations)` against an empty IndexedDB instance.
   - Verify `objectStore('read_models').keyPath === 'projectionId'`.
   - Assert `put()`, `get()`, update, and overwrite all succeed without `DataError`.

2. **Existing Database Upgrade (`v1 -> v3`)**:
   - Create DB at v1 with legacy `keyPath: 'projectionKey'`. Close DB.
   - Re-open against `CognisDatabase(migrations)`. Verify upgrade runs.
   - Verify `objectStore('read_models').keyPath === 'projectionId'`.
   - Assert `put()`, `get()`, update, and overwrite all succeed.

3. **Idempotency / Double-Open Invariant**:
   - Open an already-upgraded v3 database a second time. Verify `onupgradeneeded` does not fire and zero schema modifications occur.

4. **Registry & Composition Root Contract**:
   - Verify `migrations` imported from `migrations/index.ts` has length 3 and `migrations[2].version === 3`.
   - Verify `background/index.ts` no longer imports individual migration files.

---

## 6. Rollout & Reversibility

- **Rollout**: Merge `v3.ts`, `migrations/index.ts`, and `background/index.ts` changes as a single atomic PR under RFC 1. Once automated tests pass, storage layer is declared ready for downstream projection builders.
- **Reversibility**: All changes are confined to `v3.ts`, `migrations/index.ts`, and `background/index.ts`. Reverting the PR has no impact on perception, platform adapters, engines, or UI.
