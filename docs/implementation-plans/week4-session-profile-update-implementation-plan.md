# Cognis Week 4 Session Profile Update Implementation Plan

## 1. Final Status
IMPLEMENTATION COMPLETE AND VERIFIED WITH ACCEPTED LIMITATIONS.
The Week 4 Session Profile Update has been fully implemented, tested, and integrated.

## 2. Scope
Week 4 covers:
- Meaningful-session determination
- Longitudinal 3/7 gap transfer state machine
- Binary suppression mapping for "target less" semantics
- Profile persistence and transactional idempotency
- Pull-based hydration of adaptation policy
- Migration and fail-open default behavior
- Exhaustive verification and self-tests

**OUT OF SCOPE (Explicitly not implemented):**
- A 10-minute inactivity timer
- A global evidence watermark or EOF/evidence-settlement protocol
- EventStore rebuild mechanisms for UserProfileRecord
- An `AdaptationCoordinator` component
- Push-based or EventBridge-based targeted hydration
- Exact-once execution semantics (transactional idempotency is used instead)
- `promptCount` or `typingObservationCount` metrics
- Probabilistic targeting algorithms
- Runtime dynamic restoration via `action: 'active'` events overriding longitudinal state
- Week 5+ implementation

## 3. Historical Architectural Audit
*Earlier audit findings in this section were investigative hypotheses from Issues 1 through 4D. They were superseded by the final contracts in Sections 4 through 12.*

- **Issue 1-3:** Investigated session lifecycle and evidence settlement. It was hypothesized that a 10-minute inactivity timer or an EOF marker could guarantee evidence completeness. *Rejected:* EventStore and EventBus do not support synchronous global ordering. Late evidence is accepted as a permanent limitation (see Section 12).
- **Issue 4A-4C:** Explored canonical ordering and non-commutative transfer rules. Arrival-order folding was recognized as problematic. *Superseded:* The final 3/7 state machine uses a commutative Top-7 bounded structure to guarantee convergence regardless of IPC arrival order.
- **Issue 4D:** Debated push hydration (`session.started`) versus pull hydration (`client.ready`) and the necessity of an `AdaptationCoordinator`. *Rejected:* Push hydration and `AdaptationCoordinator` were discarded due to race conditions and tab initialization flaws. *Final:* Replaced by a direct pull-based IPC query (`QUERY_ADAPTATION_STATE`) triggered by the Content Script.
- **P1/P2 Candidates:** Explored using `promptCount` or probabilistic targeting. *Rejected:* Product explicitly decided on a boolean `hasTypingActivity` for P1 and absolute binary suppression for P2.

## 4. P1 Final Product Contract
The final product definition for a meaningful session is:
`M(session) = sessionReadModel.hasTypingActivity === true`

Meaning:
A meaningful session is one containing text composition activity. The evidence source is `PromptEvents.TYPED` (`prompt.typed`).
- Empty or idle sessions do not count.
- One typing observation makes the session meaningful.
- Many typing observations still count as exactly one meaningful session.
- Prompt submission, completion, or gap detection is NOT required.
- Duration is NOT the meaningfulness criterion.
- `promptCount` and `typingObservationCount` are NOT used.

The `SessionProjectionBuilder` owns this factual projection by idempotently setting `hasTypingActivity = true` when `prompt.typed` is observed for an already-started session. The field is intentionally boolean.

## 5. P2 Final Product Contract
The final product meaning of "target less" is absolute binary suppression.

`TRANSFERRED` means:
- Target zero.
- Do not generate GhostText for that gap.

The existing `GhostTextEngine` implements this through its suppression Set. The engine was intentionally not redesigned; it does not use probabilities, priorities, or reduced-frequency targeting.
- `MAYBE_TRANSFERRED` has no longitudinal suppression effect.
- `ACTIVE` has no longitudinal suppression effect.

The `AdaptationQueryHandler` translates only `TRANSFERRED` states into `suppressedGaps: GapType[]`. The Content Script hydrates this policy through a direct `QUERY_ADAPTATION_STATE` IPC call and synthesizes `adaptation.configured(action: 'suppress')` only when both the local `session.started` sessionId and the hydration response are available, preserving session scoping.

## 6. Final 3/7 State Machine
The authoritative longitudinal counter is `sessionsSinceLastSeen`. It is NOT derived dynamically from the Top-7 array at read time.

The counter represents: "The number of meaningful sessions that have occurred since the session in which the gap was most recently detected."

State thresholds:
- **0-2 missed meaningful sessions:** `ACTIVE`
- **3-6 missed meaningful sessions:** `MAYBE_TRANSFERRED`
- **7+ missed meaningful sessions:** `TRANSFERRED`

**Never-seen semantics:**
A gap that has never been detected is NOT initialized merely because a meaningful session occurs. It is initialized only upon first detection with:
- `lastSeen` = current session
- `sessionsSinceLastSeen` = 0
- `transferState` = `ACTIVE`

**Reactivation:**
Detection during any meaningful session reactivates the gap:
- `lastSeen` = current session
- `sessionsSinceLastSeen` = 0
- `transferState` = `ACTIVE`

Runtime restoration occurs passively at the next hydration boundary. No explicit restore event is required.

## 7. Top-7 Canonicalization
`recentCountedSessions` contains only meaningful sessions and retains exactly the last seven.
Canonical ordering:
1. `endedAt` ASC
2. `sessionId` ASC (as a deterministic tie-breaker)

Top-7 acts as a compact, commutative audit and history window. It is NOT the authoritative source for `sessionsSinceLastSeen`.

## 8. Persistence and Transactional Idempotency
The system guarantees **transactional idempotency / effectively-once final state** (NOT exactly-once execution).
- `ProfileRepository.update()` performs the read-modify-write operation within an IndexedDB `readwrite` transaction.
- `foldedSessions` is checked inside that transaction boundary.
- If the same session fold executes again after a prior successful commit, the ledger causes the second execution to become a harmless no-op.

## 9. Hydration and IPC
The final implementation is strictly pull-based.
Content Script:
1. Registers `session.started` handling.
2. Requests `QUERY_ADAPTATION_STATE` directly via Chrome IPC.
3. Caches the response.
4. Caches the local `sessionId` when `session.started` arrives.
5. Synthesizes suppression only when BOTH values are available.

It safely handles either arrival order:
A. Query response arrives before `session.started`.
B. `session.started` arrives before the query response.

It uses the local `sessionId` to bind the policy. If hydration fails, it fails open with zero suppressed gaps.

## 10. Repository Mutation Boundaries
- **SessionProjectionBuilder** → `SessionReadModel`
- **SessionProfileUpdater** → `UserProfileRecord`
- **AdaptationQueryHandler** → read-only policy translation from `UserProfileRecord`
- **Content Script** → local hydration coordination and synthesis of runtime adaptation events
- **GhostTextEngine** → transient runtime suppression state

## 11. Migration and Failure Defaults
Legacy records fail safely:
- Legacy `SessionReadModel`: `hasTypingActivity ?? false`
- Legacy `UserProfileRecord`: `gapHistory ?? {}` and `foldedSessions ?? []`
- Missing transfer state defaults to `ACTIVE`.
- Missing profile or hydration failure defaults to `suppressedGaps = []`.
No new explicit schema migration script is necessary for Week 4.

## 12. Accepted Limitations
### L1: Issue 3B Late Evidence
If `prompt.typed` or `gap.detected` arrives after the `SessionProfileUpdater` has already folded `session.ended`:
- `SessionReadModel` may contain the late evidence.
- `UserProfileRecord` does not retroactively incorporate it.
- The longitudinal profile permanently diverges from the factual session projection.

`ProjectionManager.rebuildForSession` does NOT repair `UserProfileRecord`. This is a permanent limitation under the current architecture.

### L2: Rapid Restart / Hydration Race
If a new tab/session hydrates before the previous `ProfileRepository` transaction has committed, it may observe the previous policy for exactly one session. This bounded stale-policy window is explicitly accepted for Week 4.

## 13. Implemented File Set
**Modified:**
- `src/core/ipc/messages.ts`
- `src/core/types/profile.types.ts`
- `src/storage/projections/builders/SessionProjectionBuilder.ts`
- `src/background/index.ts`
- `src/content/index.ts`
- `src/engines/identity/IdentityProfileWriter.ts`

**Created:**
- `src/background/adaptation/SessionProfileUpdater.ts`
- `src/background/handlers/AdaptationQueryHandler.ts`

**Tests:**
- `src/tests/background/SessionProfileUpdater.selftest.ts`
- `src/tests/background/AdaptationQueryHandler.selftest.ts`
- `src/tests/content/Hydration.selftest.ts`
- `src/tests/storage/SessionProjectionBuilder.selftest.ts`

**Documentation:**
- `docs/implementation-plans/week4-session-profile-update-implementation-plan.md`

*(Note: `GhostTextEngine.ts` and `GhostTextAdaptor.ts` were strictly NOT modified for Week 4).*

## 14. Test Matrix
- **SessionProfileUpdater.selftest.ts:** Tests empty sessions, meaningful misses, bounds (3/7), reactivation, commutativity, never-seen gap ignorance, and transactional idempotency via `foldedSessions`.
- **AdaptationQueryHandler.selftest.ts:** Tests missing records, legacy schemas, and accurate filtering of only `TRANSFERRED` gaps.
- **SessionProjectionBuilder.selftest.ts:** Tests boolean `hasTypingActivity` idempotency.
- **Hydration.selftest.ts:** Tests both A/B arrival orderings and failure defaults.

## 15. Verification Results
- **TypeScript typecheck:** PASS
- **Vite production build:** PASS
- **npm run test:** PASS
- **schema validation:** PASS
- **brain-map generation:** PASS
- **brain-map verification:** PASS
- **SessionProfileUpdater selftest:** 18 checks PASS
- **AdaptationQueryHandler selftest:** 4 checks PASS
- **Hydration selftest:** 9 checks PASS
- **SessionProjectionBuilder selftest:** 7 checks PASS
- **Total explicit Week 4 checks:** 38 PASS
- **git diff --cached --check:** PASS

## 16. Final Invariant Ledger
- **I1:** `hasTypingActivity` perfectly defines a meaningful session.
- **I2:** Binary suppression perfectly models "target less".
- **I3:** 3/7 thresholds strictly dictate `transferState`.
- **I4:** Transactional idempotency prevents duplicate execution.
- **I5:** Pull-based hydration establishes correct runtime suppression irrespective of IPC ordering.
- **I6:** Longitudinal state safely isolates from transient runtime adaptation (`GhostTextEngine`).

## 17. Final Implementation Status
IMPLEMENTATION COMPLETE AND VERIFIED WITH ACCEPTED LIMITATIONS.
