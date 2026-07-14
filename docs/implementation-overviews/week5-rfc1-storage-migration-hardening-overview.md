# Week 5 RFC 1: Storage Migration Hardening & Schema Alignment — Architecture Walkthrough

**Module**: `src/storage/`
**Owner**: Architecture Lead (`Naren`)
**Implementation Date**: 2026-07-14
**Status**: Implemented and Verified
**Reference**: [RFC 1 Plan](../implementation-plans/week5-rfc1-storage-migration-hardening-plan.md)

---

## 1. Executive Summary

We have successfully resolved the fatal runtime collision in the database schema upgrade path (`v1Migration` $\rightarrow$ `v3Migration`) that previously blocked down-stream projection builders. 

By hardening `v3Migration` to check the actual store `keyPath` at runtime rather than relying on a naive `contains('read_models')` object-store name check, the system now safely migrates legacy `read_models` stores (using `{ keyPath: 'projectionKey' }`) to the canonical `{ keyPath: 'projectionId' }` standard required by `ReadModelRepository.ts`. Furthermore, we aligned all composition roots to use a single source of truth for the migration registry, removing duplicate inline arrays.

---

## 2. Files Created and Modified

### Database Migrations
- **[MODIFY]** `src/storage/migrations/v3.ts`: Upgraded the migration logic to inspect the existing `read_models` `keyPath`. If legacy, it deletes the store and creates a fresh instance with `{ keyPath: 'projectionId' }` and a compound `sessionId` index.
- **[MODIFY]** `src/storage/migrations/index.ts`: Registered `v3Migration` inside the canonical `migrations` array and re-exported it.

### Composition Root
- **[MODIFY]** `src/background/index.ts`: Eliminated duplicate inline array construction of migration elements; background worker now imports and instantiates the database using the canonical registry array (`migrations`).

---

## 3. Architectural Decisions & Mappings

| Architectural Constraint | Implementation Result |
| --- | --- |
| **Idempotency** | `v3Migration` checks `existingStore.keyPath === 'projectionId'`. If correct, the upgrade immediately returns, executing zero database mutations on subsequent opens. |
| **Schema Transition & Data Preservation** | Since the legacy `read_models` store previously threw `DataError` on all writes, it was effectively unpopulated. However, the store re-creation is handled within the transaction context of `onupgradeneeded` to guarantee state integrity. |
| **Single Source of Truth** | Bypassing the migration registry is eliminated. Both client testing harnesses and the background worker boot using the exact same registry export. |

---

## 4. Preservation of Invariants

- **Database Upgradability**: The upgrade process operates completely within the IndexedDB `onupgradeneeded` transaction boundary, ensuring any schema changes are atomic and aborting the transaction leaves the DB in a stable state.
- **Repository Key Path Invariant**: The primary key path of the projection table is now guaranteed to match the TypeScript model definitions, preventing runtime serialization `DataError` exceptions on `ReadModelRepository.put()`.

---

## 5. Verification Steps Executed

- Verified that the migration registry has length 3 and exports all migrations in ascending order.
- Verified that compiling background code with the modified registry import succeeds without errors.
- Verified that subsequent database opens execute correctly.
