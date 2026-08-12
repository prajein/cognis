# Milestone 10: Persistent User Model (Implementation Plan)

**Status:** APPROVED — Ready for implementation.
**Preceding audit:** [m10-persistent-user-model-audit.md](file:///Users/ntbnaren7/.gemini/antigravity-ide/brain/c75b0252-664b-487c-aaa9-aa6195b7bc7a/docs/audits/m10-persistent-user-model-audit.md)

---

## Goal

> **Can Cognis remember what it learned about a user beyond one session?**

M9 proves that Cognis can maintain and reverse session-scoped adaptation decisions. M10 extends that by persisting the underlying **behavioral evidence** across session boundaries, so each session begins with the accumulated history of prior interactions rather than zero evidence.

**M10 does not claim "Cognis has learned the user."**
M10's defensible claim is:

> Cognis persists cross-session behavioral evidence from which it derives a preference state at session start.

---

## Resolved Architectural Decisions

| Question | Decision | Rationale |
|---|---|---|
| Flush trigger | `SessionEvents.ENDED` | Simplest viable choice; over-engineering a dedicated event is premature |
| IPC query exposure | No — backend-only | Sidepanel has no UI for adaptation state in M10 |
| Evidence bounding | No cap — unbounded for M10 | M14 robustness concern; instrument via logging for now |
| Persist `nextProbeThreshold`? | **No** | It is policy state, not raw evidence. Reconstructed from evidence + `policyVersion` at session start |

---

## Architectural Corrections Over the Audit Draft

### Correction 1: Atomic Concurrent-Write Safety

The audit draft noted `lastSessionId` as the idempotency guard. This is correct for double-write protection but insufficient for concurrent multi-session writes.

The `AdaptationPreferenceRepository.flush()` method must execute a **single atomic `readwrite` transaction** for each record:

```
open readwrite transaction
  → get(id)
  → if lastSessionId === currentSessionId: skip (idempotent)
  → if valid: merge evidence additively
  → put updated record
commit
```

This ensures two simultaneous `ENDED` events (e.g., from tab duplication or a background script restart) cannot interleave partial writes. Each update is a complete read-merge-write within one transaction.

**FACT baseline**: The existing `ProfileRepository.update()` already demonstrates this atomic pattern. The new `AdaptationPreferenceRepository` must follow the same contract exactly.

### Correction 2: Evidence Persists; Policy Is Reconstructed

The original audit proposed persisting `nextProbeThreshold`. This is removed.

**What persists (raw evidence):**
- `totalExposures: number`
- `totalAcceptances: number`
- `totalExplicitRejections: number`
- `persistedState: 'ACTIVE' | 'SUPPRESSED'`
- `policyVersion: string` — the version of the `GhostTextAdaptor` policy that wrote this record

**What is reconstructed at session start from evidence:**
- `nextProbeThreshold` — derived from `policyVersion` + `totalExplicitRejections / totalExposures` ratio at startup
- `suppressedDetections` — always resets to `0` at session start
- `activeProbeInterventionId` — always `null` at session start
- `PROBING` state — never persisted; if session ended while probing, it's resolved to `SUPPRESSED`

**Why `policyVersion`**: If M11 changes the probe threshold formula, the system can correctly reconstruct `nextProbeThreshold` from evidence using the *current* policy rather than blindly inheriting an old one.

For M10, `policyVersion` is a literal constant string (e.g., `'m10.0'`). It requires no registry; it is simply an opaque tag that a future migrating policy reader can branch on.

### Correction 3: MV3 Service Worker Suspension — Labelled as Known Limitation

> [!WARNING]
> **Known Limitation (M10):** If the Chrome MV3 service worker is suspended between `SessionEvents.STARTED` and `SessionEvents.ENDED` without firing the `ENDED` event, all in-session evidence accumulated since the last flush will be lost. This session's contribution to the persistent model will be missing.
>
> This does **not** corrupt the persistent model — the last successfully flushed state remains intact. It only means this particular session's evidence is not included.
>
> This is formally recorded as a monitored assumption to be addressed in M14 adversarial testing. It does not block M10 delivery.

---

## Final Persistent Schema

```typescript
// src/core/types/adaptation.types.ts

/** The singleton profile ID used for all local adaptation records. */
export const ADAPTATION_PROFILE_ID = 'default-user' as const;

/**
 * PersistedGapPreference
 *
 * One record per GapType per user. Stores cumulative behavioral evidence
 * derived from ghost text acceptance and rejection across sessions.
 *
 * Design rules:
 * - Only raw evidence is persisted. Policy state (nextProbeThreshold etc.) is reconstructed.
 * - PROBING state is never persisted. It resolves to SUPPRESSED at flush.
 * - activeProbeInterventionId is never persisted.
 * - suppressedDetections always resets to 0 at session start.
 */
export interface PersistedGapPreference {
  /** Composite key: `${profileId}::${gapType}` e.g. "default-user::audience" */
  readonly id: string;
  readonly profileId: string;
  readonly gapType: GapType;

  /** Cumulative cross-session behavioral evidence. */
  totalExposures: number;
  totalAcceptances: number;
  totalExplicitRejections: number;

  /**
   * The resolved preference state at the end of the last session.
   * Never PROBING. If the session ended mid-probe, this is SUPPRESSED.
   */
  persistedState: 'ACTIVE' | 'SUPPRESSED';

  /**
   * Version tag of the adaptation policy that wrote this record.
   * Used by future policy versions to reconstruct derived state correctly.
   * M10 value: 'm10.0'
   */
  policyVersion: string;

  /** Unix epoch ms of the first evidence recorded for this gap type. */
  readonly firstSeenAt: number;

  /** Unix epoch ms of the last session that flushed this record. */
  lastUpdatedAt: number;

  /**
   * The session ID that last flushed this record.
   * Guards against double-writes from the same session.
   */
  lastSessionId: string;
}
```

---

## `nextProbeThreshold` Reconstruction at Session Start

When `GhostTextAdaptor` loads a `PersistedGapPreference` and needs to initialize a `GapPreference` for the in-memory state machine, it must reconstruct `nextProbeThreshold` from raw evidence:

```
if persistedState === 'SUPPRESSED':
  rejectionRate = totalExplicitRejections / max(totalExposures, 1)
  if rejectionRate >= 0.90: nextProbeThreshold = 20   // Very strong rejection history
  if rejectionRate >= 0.75: nextProbeThreshold = 10   // Strong rejection history  
  else:                      nextProbeThreshold = 5    // Weak rejection history (shouldn't normally persist as SUPPRESSED)
if persistedState === 'ACTIVE':
  nextProbeThreshold = 5   // Default; no exploration needed immediately
```

This ensures the threshold is a **policy decision made at load time**, not a historical artifact from a prior session's policy version.

---

## Session Lifecycle

| Event | Action |
|---|---|
| `SessionEvents.STARTED` | 1. Query all `PersistedGapPreference` for `profileId = 'default-user'`. 2. Reconstruct in-memory `GapPreference` map from evidence. 3. `suppressedDetections = 0`, `activeProbeInterventionId = null` for all. |
| Evidence accumulates in-session | No writes to IndexedDB. All state is in-memory (unchanged from M9). |
| `SessionEvents.ENDED` | 1. For each `GapPreference` in the in-memory map, compute the flush record. 2. Resolve any `PROBING` state to `SUPPRESSED`. 3. Execute one atomic `readwrite` transaction per record: `get → check lastSessionId → merge additively → put`. |
| Service-worker cold-start | On next `SessionEvents.STARTED`, preferences are read from the last successfully flushed IndexedDB state. |

---

## Files to Create / Modify

### New Files

#### [NEW] `src/core/types/adaptation.types.ts`
- Declares `PersistedGapPreference` and `ADAPTATION_PROFILE_ID`.

#### [NEW] `src/storage/migrations/v4.ts`
- Creates `adaptation_preferences` object store:
  - `keyPath: 'id'` (composite: `profileId::gapType`)
  - Index: `by-profileId` on `profileId` (`unique: false`)
- Idempotent: guarded by `objectStoreNames.contains`.

#### [NEW] `src/storage/repositories/AdaptationPreferenceRepository.ts`
- Methods:
  - `getAll(profileId: string): Promise<PersistedGapPreference[]>`
  - `flush(record: PersistedGapPreference, sessionId: string): Promise<void>` — atomic read-merge-write transaction
  - `deleteOne(id: string): Promise<void>` — per-gap reset
  - `deleteAll(profileId: string): Promise<void>` — full adaptation reset

The `flush()` method has the following atomic contract:
```
readwrite tx:
  existing = get(record.id)
  if existing?.lastSessionId === sessionId: return (idempotent)
  merged = {
    ...record,
    totalExposures: (existing?.totalExposures ?? 0) + record.totalExposures,
    totalAcceptances: (existing?.totalAcceptances ?? 0) + record.totalAcceptances,
    totalExplicitRejections: (existing?.totalExplicitRejections ?? 0) + record.totalExplicitRejections,
    firstSeenAt: existing?.firstSeenAt ?? record.firstSeenAt,
    lastUpdatedAt: record.lastUpdatedAt,
    lastSessionId: sessionId,
  }
  put(merged)
```

### Modified Files

#### [MODIFY] `src/storage/migrations/index.ts`
- Import and register `v4Migration`.

#### [MODIFY] `src/background/adaptation/GhostTextAdaptor.ts`
- Constructor accepts an optional `AdaptationPreferenceRepository | null`.
  - When `null` (e.g., during tests), persistence is silently skipped. In-memory behavior is identical to M9.
- `handleSessionStarted()`: Load all persisted preferences; seed in-memory map.
- `handleSessionEnded()`: Flush all in-memory preferences atomically.

#### [MODIFY] `src/background/index.ts`
- Instantiate `AdaptationPreferenceRepository(db)`.
- Inject into `new GhostTextAdaptor(eventBus, adaptationPrefRepo)`.

---

## Verification Plan

### Automated Tests
- **Self-test (`GhostTextAdaptor.selftest.ts`)**: Existing M9 tests must all pass unchanged, because the `AdaptationPreferenceRepository` dependency is optional. No test environment regression.
- **New self-test (`AdaptationPreferenceRepository.selftest.ts`)**: In-process IndexedDB stub test asserting:
  - `flush()` is idempotent on same `sessionId`.
  - `flush()` merges evidence additively across sessions.
  - `flush()` resolves `PROBING` to `SUPPRESSED`.
  - `deleteOne()` and `deleteAll()` work correctly.
  - Concurrent `flush()` calls for the same record serialize correctly.

### Compiler
- `npx tsc --noEmit` must pass with zero errors.

### Schema
- `npm run test` (schema validation) must pass.

### Post-M10 Exit Audit
- Independent audit verifying the atomic flush contract, idempotency, `PROBING`-to-`SUPPRESSED` resolution, and the `nextProbeThreshold` reconstruction semantics.

---

## What M10 Explicitly Does Not Do

- Does **not** expose adaptation preferences to the sidepanel.
- Does **not** introduce automatic evidence decay.
- Does **not** persist `nextProbeThreshold` — this is reconstructed from evidence + policy.
- Does **not** claim "Cognis has learned the user."
- Does **not** persist `suppressedDetections`, `activeProbeInterventionId`, or `PROBING` state.
- Does **not** provide any ML or heuristic weighting of cross-session evidence.
