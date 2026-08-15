# Week 7 Storage Retention & Privacy — Implementation Overview

## 1. What was actually changed
We implemented a strict allowlist-driven privacy layer for all text-bearing events, ensuring raw prompt data never reaches IndexedDB. We engineered a robust, time-bounded, IDB-native retention primitive driven by a `chrome.alarms` background scheduler. We introduced projection safety checks to ensure retention compaction never corrupts existing state. Finally, we explicitly blocked destructive compaction because the repository does not yet define weekly/monthly summary semantics.

## 2. Files Changed
- `manifest.json`
- `src/background/index.ts`
- `src/background/retention-scheduler.ts`
- `src/core/event-bus/contracts.ts`
- `src/core/event-bus/registry.ts`
- `src/storage/indexeddb/PersistenceMapper.ts`
- `src/storage/indexeddb/PersistenceMapper.selftest.ts`
- `src/storage/projections/ProjectionManager.ts`
- `src/storage/projections/ProjectionManager.selftest.ts`
- `src/storage/repositories/RetentionRepository.ts`
- `src/storage/retention/RetentionPolicy.ts`

## 3. Why each change exists
- `PersistenceMapper.ts`: Overhauled to use `allowedFields` to structurally guarantee raw text privacy.
- `RetentionRepository.ts`: Exists because standard domain repositories (like `EventRepository`) must remain append-only; retention requires privileged cross-store `delete` capabilities.
- `RetentionPolicy.ts`: Encapsulates the 90-day time-series cleanup logic and explicitly blocks it to prevent accidental data loss.
- `ProjectionManager.ts`: Safely aborts rebuilds if it detects an incomplete (compacted) history, preventing healthy state implosions.
- `retention-scheduler.ts`: Relies on `chrome.alarms` to avoid long-running interval timers.

## 4. Data Flow
1. Content Script/Engines emit `DomainEvent` with potentially raw text on the EventBus.
2. `EventStoreSubscriber` routes the event to `PersistenceMapper`.
3. `PersistenceMapper` strips all unknown/blocked fields, creating a sanitized DTO.
4. `EventRepository` `.add()`s the DTO to IndexedDB.
5. In the background, `chrome.alarms` triggers `RetentionPolicy` every 24 hours.
6. `RetentionPolicy` observes undefined summary semantics and safely blocks destructive compaction.

## 5. Privacy Guarantees
**PROVEN BY CODE/TESTS**: Unknown future fields (`rawText`, `promptText`) cannot bypass the DTO sanitization layer. Explicit allowlists enforce privacy at the boundary before `EventRepository`. Proven by `PersistenceMapper.selftest.ts`.

## 6. Retention Behavior
**PROVEN BY CODE**: `RetentionRepository` uses single-pass `readwrite` transactions over `by-timestamp` indexes to batch-delete records without loading them into memory. It is restartable and bounds-safe.

## 7. Projection Safety Behavior
**PROVEN BY CODE/TESTS**: `ProjectionManager.rebuildForSession()` checks the first ordered event in the stream; if it is missing `SessionEvents.STARTED` (implying historical compaction) or the stream is empty, the `builder.clear()` phase is aborted. Proven by `ProjectionManager.selftest.ts`.

## 8. Scheduler Behavior
**PROVEN BY CODE**: `initializeRetentionScheduler` idempotently registers `cognis-retention-alarm` during service-worker bootstrap. It relies exclusively on the browser `alarms` API, using no local timeouts.

## 9. Test Commands
```bash
npx tsc --noEmit
for f in $(find src -name '*.selftest.ts' | sort); do npx tsx "$f" || exit 1; done
git diff --check
```

## 10. Actual Test Results
- Compilation: 0 Errors.
- All self-tests passed (including the new `PersistenceMapper` and `ProjectionManager` suites).
- Trailing whitespaces resolved.

## 11. Static Audit Results
- `grep -R -n -E "eventRepository\.append|\.put\(" src`: `EventRepository` remains strictly `.add()` append-only.
- `grep -R -n -E "promptText|rawText|chunkText" src/storage`: Zero persistent DTO footprint.

## 12. Remaining Limitations
- 90-day historical compaction is deliberately and indefinitely blocked.

## 13. Deliverable Status
**PARTIAL** (Intentionally Blocked)
The storage privacy, scheduling, and retention infrastructure is fully complete. The final 90-day deletion command is blocked because the required weekly/monthly summaries are **UNDEFINED IN REPOSITORY**.
