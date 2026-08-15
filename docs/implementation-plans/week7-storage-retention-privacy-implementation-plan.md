# Week 7 Storage Retention & Privacy — Implementation Plan

## 1. Week 7 Objective
"Keeping the stored data tidy and private."
- Add retention/cleanup: 90 days of full logs, then weekly summaries, then monthly summaries.
- Confirm raw prompt text is never stored; only a hash.

## 2. Scope
This plan is strictly limited to storage retention, storage privacy enforcement, and projection safeguards. It specifically excludes ChatGPT/Claude adapter work, progress charts, weekly digest generation, and AI-dependency detection.

## 3. Original Architectural Findings
- EventStoreContract (via `EventRepository`) must remain strictly append-only (no `put` or `delete`).
- `PersistenceMapper` handles persistence DTO creation.
- Retention operations require privileged cross-store atomicity separate from the domain event bus.
- Weekly and monthly summary schemas do not currently exist in the repository.

## 4. Implemented Components
- `PersistenceMapper.ts` & `PersistenceMapper.selftest.ts`
- `RetentionRepository.ts`
- `RetentionPolicy.ts`
- `ProjectionManager.ts` & `ProjectionManager.selftest.ts`
- `retention-scheduler.ts`
- `manifest.json` (alarms)
- `registry.ts` and `contracts.ts` (StorageEvents)

## 5. Privacy Architecture
- **Allowlist Gateway**: `PersistenceMapper` exclusively utilizes explicit `allowedFields` for all prompt and response variations. Unknown properties (e.g. `rawText`, `userMessage`) are inherently dropped.
- **Blocklist Check**: For `response.chunk`, `chunkText` is explicitly stripped via `blockedFields`.
- **Proof**: `PersistenceMapper.selftest.ts` asserts that raw inputs never survive sanitization.

## 6. Retention Architecture
- **Privileged Access**: `RetentionRepository.deleteOlderThan` performs time-bounded deletions using `by-timestamp` indexes on `events`, `signal_frame`, and `state_score` across a single `readwrite` IndexedDB transaction.
- **Batched**: Deletes occur in batches of 500 to prevent long-running transaction blocks.

## 7. Projection Safety
- `ProjectionManager.rebuildForSession()` verifies the integrity of the event stream prior to clearing builders.
- If history is empty or missing the `SessionEvents.STARTED` event (due to retention), the replay is aborted safely, preventing the destruction of existing healthy projections.

## 8. Background Scheduling
- A `chrome.alarms` based timer (`cognis-retention-alarm`) is registered idempotently in `retention-scheduler.ts` and fires every 24 hours.

## 9. Summary/Compaction Boundary
- **UNDEFINED SUMMARY SCHEMAS**: The repository currently lacks schemas and generation mechanisms for the requested weekly/monthly summaries.
- **BLOCKED COMPACTION**: Because summaries are undefined, `RetentionPolicy.ts` implements a hard boundary (`summarizeBeforeDeletion() => false`), intentionally blocking all destructive retention of the 90-day logs until the summary pipeline is available.

## 10. Verification Strategy
- **Type Safety**: `npx tsc --noEmit` ensures structural integrity.
- **Self-tests**: Isolated invariants proven via node-based self-tests for `PersistenceMapper`, `ProjectionManager`, etc.
- **Static Analysis**: Grep checks to verify no direct IndexedDB mutations bypass the EventRepository, and no raw text variables enter persistence DTOs.

## 11. Known Limitations
- The 90-day time-series cleanup is completely blocked pending summary implementation. The `StorageEvents.RETENTION_COMPLETED` audit event will not fire until this is unblocked.

## 12. Explicitly Undefined Requirements
- Weekly summary generation logic and schema.
- Monthly summary generation logic and schema.

## 13. Final Acceptance Status
**PARTIAL (BLOCKED)**
The privacy guarantees, scheduling, projection safety, and retention primitives are completely implemented and proven. However, the final destructive cleanup of 90-day logs is intentionally blocked due to the undefined summary semantics, preventing historical data loss.
