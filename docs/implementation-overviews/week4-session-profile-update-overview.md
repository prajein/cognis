# Implementation Overview: Week 4 Session Profile Update

## Overview
This document serves as the authoritative architectural record for the Week 4 Session Profile Update. It describes the verified implementation of longitudinal gap tracking, target-less suppression semantics, and cross-context hydration.

## Product Contracts

### P1: Meaningful Session
A meaningful session is defined by the predicate `hasTypingActivity === true`.
- Derived exclusively from `prompt.typed` events.
- Empty or idle sessions do not count as meaningful.
- Non-meaningful sessions do not advance longitudinal miss counters.

### P2: Target-Less Semantics
"Target less" is implemented as absolute binary suppression.
- `TRANSFERRED` places the gap into binary runtime suppression.
- It is not permanently irreversible. A qualifying meaningful session in which the gap is detected reactivates the profile state to `ACTIVE`.
- Runtime restoration occurs through the next session's hydration boundary.
- `GhostTextEngine` enforces this suppression by completely dropping the gap from stem generation.
- There is no probabilistic or reduced-frequency targeting.

### 3/7 Longitudinal State Machine
The authoritative longitudinal counter is `sessionsSinceLastSeen`.
- **0-2 misses:** `ACTIVE`
- **3-6 misses:** `MAYBE_TRANSFERRED`
- **7+ misses:** `TRANSFERRED`
A previously unseen gap is not initialized merely because it is absent. First actual detection initializes the gap.

## Architecture & Ownership

### SessionProjectionBuilder
Owns factual `SessionReadModel` materialization. It idempotently sets `hasTypingActivity = true` upon receiving `prompt.typed`.

### SessionProfileUpdater
Owns longitudinal `UserProfileRecord` mutation. Operating at `session.ended`, it reads the session and gap profile read models. It stores up to the 7 most recent meaningful sessions in `recentCountedSessions`. This Top-7 array is strictly an audit/history window; `sessionsSinceLastSeen` is the authoritative source for the state machine. Canonical ordering is `endedAt` ASC, with `sessionId` ASC as the tie-breaker.

### AdaptationQueryHandler
Serves as the persisted policy firewall. It reads `gapHistory` and emits only `TRANSFERRED` gaps as `suppressedGaps`. `ACTIVE` and `MAYBE_TRANSFERRED` gaps are omitted. The Content Script does not receive the full longitudinal profile.

### Content Script Hydration
Owns local hydration orchestration via asynchronous initialization:
- The Content Script sends `QUERY_ADAPTATION_STATE`.
- The response is cached.
- `session.started` provides the authoritative local `sessionId`.
- Hydration is synthesized only after both the policy response and local `sessionId` are available.
- `adaptation.configured` events use that exact local `sessionId`.
This strictly prevents adaptation configuration from being emitted before a valid local session exists and prevents cross-session policy application within the Content Script lifecycle.

### GhostTextEngine
Owns transient binary suppression enforcement at runtime. It drops any gap in its `suppressedGaps` set during a pause.

## Persistence and Idempotency
`SessionProfileUpdater` utilizes `foldedSessions` to provide transactional idempotency (not exactly-once execution). The update occurs inside a single IndexedDB transaction.

## Reactivation Semantics
When a gap is `TRANSFERRED`, and a meaningful session occurs where `gap.detected` fires:
- The gap is reactivated at the profile-fold boundary.
- `sessionsSinceLastSeen` resets to `0`, and `transferState` becomes `ACTIVE`.
- The current session's runtime suppression is not dynamically removed. The next session's hydration observes the persisted `ACTIVE` state and therefore does not suppress the gap.

## Migration and Failure Defaults
Legacy records or missing profiles fail open safely:
- `hasTypingActivity` defaults to `false`.
- Missing transfer states default to `ACTIVE`.
- Hydration failures default to zero `suppressedGaps`.

## Accepted Limitations
- **Late Evidence:** Late evidence arriving after the profile fold can leave `UserProfileRecord` permanently behind the `SessionReadModel` because the existing rebuild pipeline does not reconstruct `UserProfileRecord`.
- **Rapid Restart:** A rapid restart can observe a stale profile before the previous profile transaction commits, producing a bounded stale hydration policy.

## Verification Status
The implementation has been exhaustively tested and verified against the architectural contracts.
