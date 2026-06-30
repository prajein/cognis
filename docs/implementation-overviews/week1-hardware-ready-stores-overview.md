# Hardware-Ready Stores (v2 migration) — Architecture Walkthrough

**Module**: `src/storage/migrations/`
**Owner**: Suchit (Storage Layer)
**Sprint**: Week 1 — "create the hardware-ready tables now … but leave them empty"
**Status**: Implemented and Verified
**Reference**: [IndexedDB Event Store Implementation Plan](../implementation-plans/week1-indexeddb-event-store-implementation-plan.md)
**Constitution Reference**: Sections 8 (Storage Law), 9 (Arc Readiness)

---

## 1. Executive Summary

This completes the remaining piece of Suchit's Week-1 storage deliverable. The
Event Store (v1: `events`, `user_profiles`, `read_models`) already shipped in
[#6](https://github.com/prajein/cognis/pull/6). What was still outstanding from
the sprint plan was the instruction to:

> "Create the hardware-ready tables now (`signal_frame`, `state_score`, and so on)
> but leave them empty — that way adding Arc later needs no migration."

A new **v2 migration** adds those two empty object stores. The point is timing:
by creating the stores now, the day Arc hardware arrives becomes a matter of
*writing* to stores that already exist — never evolving the schema on a user's
live database (Arc Readiness Law: "zero schema migrations").

## 2. Why a new migration (v2) and not an edit to v1

v1 has already shipped. IndexedDB only re-runs `onupgradeneeded` when the version
number increases, so editing v1 would never reach databases already at version 1.
Adding `v2Migration` means:

- existing v1 databases upgrade in place and gain the two stores; and
- fresh installs run v1 then v2 in sequence.

This also exercises the migration runner in `CognisDatabase` (which runs every
migration whose `version` exceeds the database's current version) exactly as the
implementation plan designed it.

## 3. The Stores

Both are created **empty** in v0.1. Their shape mirrors the `events` store
(`keyPath: "id"`, plus session/timestamp indexes) so the same access patterns —
"this session's frames", "frames in time order" — work the day they hold data.

| Store | Future contents | Indexes |
| --- | --- | --- |
| `signal_frame` | Raw Arc biosignal frames (EEG/PPG/IMU/temperature). Fed by the future Arc adapter, whose `hardware.signal.received` event already exists in the registry. | `by-session`, `by-timestamp`, `by-session-timestamp` |
| `state_score` | Modelled cognitive-state scores over time. Written by the software State Engine and, later, the Arc state provider — through the same shape, preserving the hardware-agnostic contract. | `by-session`, `by-timestamp`, `by-session-timestamp` |

## 4. Files Created and Modified

- **[NEW]** `src/storage/migrations/v2.ts` — the v2 migration creating the two empty hardware-ready stores. Structure only; no data is written.
- **[NEW]** `src/storage/migrations/index.ts` — the ordered migration registry (`[v1Migration, v2Migration]`) the composition root will hand to `new CognisDatabase(...)`. Adding a future schema change = appending one entry here.
- **[NEW]** `src/storage/migrations/v2.selftest.ts` — framework-free, mock-driven self-test (15 assertions).

No existing storage code was modified — v1, `CognisDatabase`, `EventRepository`, and `EventStoreSubscriber` are untouched.

## 5. Scope Note — projections/repositories remain deferred

The implementation plan explicitly **defers** `SessionRepository`,
`ProfileRepository`, and all `projections/*` to a future sprint ("designing read
models before understanding real query patterns would be premature"). This PR
respects that decision and does **not** touch those placeholders. It adds only
the hardware-ready stores called for by the Week-1 plan.

## 6. Verification

- `npx tsc --noEmit` — clean (strict mode, zero diagnostics).
- Self-test: **15/15 assertions pass** — store creation, keyPaths, all indexes, idempotency, and a strictly-ascending, complete migration registry. The test drives the migration against a minimal in-memory mock of the IndexedDB upgrade surface (no browser, no extra dependency).

## 7. Definition of Done Checklist

- [x] Schema change is additive and idempotent.
- [x] New version (v2), never an edit to a shipped migration.
- [x] Stores created empty (hardware-ready, no data in v0.1).
- [x] Indexed consistently with the `events` store.
- [x] Migration registry assembled for the composition root.
- [x] Ships a self-test.
- [x] Foundation contracts (v1, CognisDatabase, EventRepository) untouched.
- [x] Architectural documentation (this file).
