# Week 6: Reading Engagement Tracker Implementation Plan

## 1. Objective
Implement the Reading Engagement Tracker (Suchit's scope) to measure whether the user actually read an AI-generated answer. The tracker captures scroll velocity, scroll reversals, and time-before-first-action locally in a DOM observer, emits a single derived domain event per reading phase, and persists the aggregated metrics in the session profile for downstream consumption by Gap-related workflows.

## 2. Requirements Traceability

| Requirement | Repository Evidence | Planned Implementation | Acceptance Test |
|---|---|---|---|
| Track Scroll Velocity | `PlatformAdapter` observer capabilities | Calculate scroll distance / time in `ReadingObserver` via `requestAnimationFrame` | Scroll injection produces expected speed output |
| Track Scroll Reversals (Rereading) | Product definition: direction changes | Count direction flips exceeding a 50px jitter threshold in `ReadingObserver` | Up/down sequence > 50px increments reversal count |
| Time Before First Action | `prompt.typed`, `PromptEvents.SENT` existing contracts | Clock from `response.started` to first action | Emitted domain event matches elapsed ms |
| Feed Gap Profile's session-behaviour | `SessionReadModel` has `hasTypingActivity`; `GapProfileReadModel` is strictly typed | Add metrics to `SessionReadModel` for downstream querying | `SessionReadModel` contains aggregated metrics |

## 3. Existing Architecture
- **PlatformAdapter (ChatGPTAdapter / ClaudeAdapter)**: Composition roots for observers.
- **ResponseObserver**: Emits `response.started`, `response.chunk`, `response.completed`. Caches `promptEventId` and `promptHash`.
- **EventBus**: Central event broker. Requires derived domain events, prohibits native UI frequency telemetry.
- **SessionProjectionBuilder / SessionReadModel**: Persists session-level behavior aggregates (e.g., `totalPauseDurationMs`). Critically, it currently lacks strict event idempotency for additive fields (it blindly increments pause duration).
- **GapProfileReadModel**: Strictly constrained to a `Record<GapType, ...>` schema.
- **Platform Selectors**: Defines CSS selectors, but currently lacks an explicit scroll listener target definition.

## 4. Final Architecture
**Data Flow**:
1. **Response Lifecycle**: `response.started` provides `promptEventId` and sets the tracking baseline.
2. **Engagement Observation**: `ReadingObserver` attaches debounced `scroll` listeners to `PlatformSelectors.scrollContainer`.
3. **Local Metric Calculation**: Velocity and reversals accumulate in-memory.
4. **Derived Domain Event**: A known user action (`prompt.typed`, `PromptEvents.SENT`, or `session.ended`) terminates tracking. Exactly ONE `reading.engagement.measured` domain event is emitted per `promptEventId`.
5. **Session Projection**: `SessionProjectionBuilder` receives the event. It checks idempotency (via a new tracked array) and updates `SessionReadModel` totals.

**Explicitly Prohibited**:
- Raw scroll events `→` EventBus.
- Modifying `GapProfileReadModel`.

## 5. Production File Change Matrix

| File | Change | Reason | Risk |
|---|---|---|---|
| `src/platforms/selectors/interfaces.ts` | Add `scrollContainer?: string \| 'window'` | Abstract scroll target differences | Low |
| `src/platforms/selectors/chatgpt-v1.ts` | Set `scrollContainer: 'window'` | ChatGPT scrolls on the window | Low |
| `src/platforms/selectors/claude-v1.ts` | Set `scrollContainer: '.font-claude-response'` | Claude scrolls on a nested div | Low |
| `src/core/event-bus/registry.ts` | Add `READING_ENGAGEMENT_MEASURED` | Establish domain event constant | Low |
| `src/core/event-bus/contracts.ts` | Add `ReadingEngagementMeasuredPayload` | Define strict event payload | Low |
| `src/storage/projections/builders/SessionProjectionBuilder.ts` | Add reading fields & `processedPromptEventIds`, handle new event | Persist aggregated session reading metrics with idempotency | Medium |
| `src/platforms/observers/ReadingObserver.ts` | [NEW] Create reading tracker observer | Implement local DOM telemetry and calculation | Medium |
| `src/platforms/chatgpt/ChatGPTAdapter.ts` | Instantiate `ReadingObserver` | Bind tracker | Low |
| `src/platforms/claude/ClaudeAdapter.ts` | Instantiate `ReadingObserver` | Bind tracker | Low |

## 6. Observer Contract
- **Name**: `ReadingObserver`
- **Dependencies**: `EventBus`, `PlatformConfig`, `SessionId`.
- **Event Subscriptions**: `response.started`, `prompt.typed`, `prompt.sent`, `session.ended`, `session.started`.
- **DOM Listeners**: `scroll` (passive, bound to `scrollContainer`).
- **Session Ownership**: Hard-bound to `SessionId` upon instantiation. State clears on `session.started`.
- **Response Correlation**: Caches `promptEventId` and `promptHash` from `response.started`.
- **Cleanup**: `destroy()` removes DOM listeners, stops `requestAnimationFrame`, and unsubscribes from EventBus.

## 7. Scroll Target Contract
- **Abstraction**: `scrollContainer?: string | 'window'` in `PlatformConfig`.
- **Rationale**: ChatGPT and Claude use radically different scroll elements. A generic selector `string` fails for `window` tracking. `string | 'window'` is the smallest type-safe abstraction required.

## 8. Metric Algorithms

### 8.1 Scroll Velocity
- **Delta Calculation**: `abs(currentPosition - previousPosition)`.
- **Zero-Delta/Zero-Time Handling**: Ignored.
- **Unit**: Pixels per second (px/s). Integer.
- **Classification**: ENGINEERING DECISION. Pixels per second as an integer simplifies calculation without losing meaningful precision.

### 8.2 Scroll Reversals
- **Direction Calculation**: `Math.sign(currentPosition - previousPosition)`.
- **Jitter Handling**: Reversal only counts if scroll travels at least `50px` in the new direction.
- **Classification**: ENGINEERING DECISION. Without a 50px threshold, trackpad jitter generates false reversals.

### 8.3 Time Before First Action
- **Clock Start**: `response.started` timestamp.
- **Clock Start Semantics**: ENGINEERING APPROXIMATION. `response.started` implies the DOM node was created, not necessarily that it entered the viewport. This measures engagement behavioral timing, not verified pure reading time.
- **Clock End**: `prompt.typed` or `PromptEvents.SENT` (whichever arrives first).
- **Pause Semantics**: Ignored (clock is absolute elapsed time) unless explicitly defined otherwise by product. Kept minimal.

### 8.4 Mathematical Semantics (Normative Resolution)
Because the initial specification contained ambiguities regarding frame sampling and pause handling, this section provides the strict normative definitions required for implementation:
- **Sampling Cadence**: Frame-sampled. `requestAnimationFrame` (RAF) dictates the exclusive measurement cadence.
- **previousPosition**: The recorded position from the previously executed RAF sample.
- **currentPosition**: The latest available `window.scrollY` (or equivalent) position at the exact moment the RAF executes.
- **Intermediate Scroll Events**: Explicitly coalesced and discarded. Any sub-frame movement (e.g., 100 -> 200 -> 50) before a RAF resolves solely to the final frame position (`50`), dropping the unrendered intermediate position (`200`).
- **Displacement Calculation**: `abs(currentPosition - previousPosition)` between successive RAF executions.
- **Zero-Displacement Handling**: If `abs(currentPosition - previousPosition) === 0`, the frame contributes `0` to accumulated distance and `0` to accumulated time, but updates the `lastScrollTime` to the current RAF timestamp.
- **Zero-Time Handling**: If the elapsed time between RAF executions is `0`, the frame is ignored.
- **Pause Handling / Velocity Denominator**: The architecture dictates an event-driven RAF (RAF is only scheduled when a `scroll` event fires). Consequently, if a user pauses for 5 minutes, no RAFs fire. The *next* scroll event schedules a RAF, and its `deltaTime` (calculated against `lastScrollTime`) inherently includes the 5-minute pause. **This is the normative, intended behavior.** The metric measures the *effective elapsed speed* across the scrolling phase (Elapsed-Sample-Time), not just the momentary active movement speed.
- **Reversal Sampling**: Reversals are evaluated strictly against the frame-sampled positions, completely ignoring any coalesced sub-frame jitter.
- **Jitter Threshold**: A reversal is only counted if the new frame-sampled position exceeds a strict `50px` displacement from the *absolute recorded extremum* of the previous direction. Sub-threshold jitter does not reset the extremum.

## 9. Answer Correlation
- **Trigger**: `response.started` provides `promptEventId` and `promptHash`.
- **Multiple Answers**: If `response.started` fires while already tracking, finalize the previous answer immediately, then reset for the new one.
- **Stale Prompt Protection**: The emitted event MUST include the `promptEventId`.

## 10. State Machine
- **IDLE**: Awaiting `response.started`.
- **TRACKING**: `response.started` received. Caching `promptEventId`. Accumulating scroll data.
- **FINALIZED**: `prompt.typed` or `prompt.sent` received. Event emitted. Immediately return to IDLE to prevent duplicate emission for the same response.

## 11. Domain Event Contract
- **Event Name**: `reading.engagement.measured` (Added to `CognitiveEvents` registry to match `ghosttext.measurement.computed`).
- **Payload (`ReadingEngagementMeasuredPayload`)**:
  - `promptEventId: string` (correlation - REQUIRED)
  - `promptHash: string` (correlation - REQUIRED)
  - `readingDurationMs: number`
  - `scrollVelocityPxPerSec: number`
  - `scrollReversals: number`
  - `actionType: 'typed' | 'sent' | 'session_ended'`
- **Rationale**: Minimal fields necessary to fulfill Week 6 and support downstream processing.

## 12. Session Projection Contract
- **SessionReadModel Additions** (Optional for backward compatibility):
  - `totalScrollReversals?: number`
  - `averageScrollVelocityPxPerSec?: number`
  - `averageTimeBeforeFirstActionMs?: number`
  - `totalReadingPhases?: number`
  - `processedReadingPrompts?: string[]` (Crucial for idempotency)
- **Aggregation Logic**:
  - Requires safe initialization (`model.totalReadingPhases = model.totalReadingPhases || 0;`).
  - Rolling average mathematics: `newAvg = ((oldAvg * oldCount) + newValue) / (oldCount + 1)`.
- **Idempotency Classification**: ENGINEERING DECISION. `SessionProjectionBuilder` does NOT natively support replay idempotency for additive maths. We must track processed `promptEventId`s in `processedReadingPrompts` to prevent duplicate aggregation.

## 13. Gap Profile Integration
- **Product Reconciliation**: "Gap Profile's session-behaviour part" structurally means downstream Gap workflows will query `SessionReadModel`. Suchit's scope ends at saving data to `SessionReadModel`. `GapProfileReadModel` is explicitly unmodified.

## 14. Lifecycle
- **`session.started`**: Transition to IDLE, clear caches.
- **`response.started`**: Transition to TRACKING, attach DOM listener, set clock start.
- **`prompt.typed` / `PromptEvents.SENT`**: If TRACKING, calculate metrics, emit domain event, transition to IDLE.
- **`session.ended`**: Finalize tracking, emit event with `actionType: 'session_ended'`.
- **Missing Scroll Target**: Log warning, remain IDLE. Fail gracefully.

## 15. Performance
- **Scroll Throttling**: Use `requestAnimationFrame`. Only track `window.scrollY` (cheap DOM read).
- **Cleanup**: `cancelAnimationFrame` upon `destroy()` or finalization so deferred reads don't pollute subsequent responses.

## 16. Failure and Recovery
- **Missing Container**: Tracker remains IDLE. Fail-open.
- **Session End Mid-Tracking**: Flush metrics and emit.
- **Duplicate Action Event**: State machine transitions to IDLE on the first action. Subsequent actions are ignored.

## 17. Backward Compatibility
- **Deserialization**: Existing `SessionReadModel` records in IndexedDB will lack reading metrics. Optional properties (`?`) preserve serialization safety.
- **Initialization**: `SessionProjectionBuilder` must default undefined values to `0` before performing mathematical operations.

## 18. Test Plan
- **Metric Tests**: No scroll; single movement; >50px jitter vs <50px jitter; multiple reversals; zero duration.
- **Lifecycle Tests**: `response.started` starts tracking; `prompt.typed` finalizes; `session.started` resets.
- **Correlation Tests**: Emitted event contains correct `promptEventId`.
- **Projection Tests**: First event initializes averages; duplicate event (same `promptEventId`) is ignored; multiple events average correctly.
- **Isolation Tests**: `session.started` clears pending `requestAnimationFrame` and state.

## 19. Acceptance Criteria
1. `reading.engagement.measured` domain event contains calculated metrics and `promptEventId`.
2. EventBus receives exactly ONE event per generated response.
3. `SessionReadModel` correctly averages metrics.
4. Duplicate processing of the same reading event does not alter `SessionReadModel` averages (idempotent).
5. All tests pass.

## 20. Explicit Non-Goals
- Answer analysis, automaticity calculation, Gap heuristic changes.
- Read-depth scoring.

## 21. Implementation Order
1. Update `interfaces.ts`, `chatgpt-v1.ts`, `claude-v1.ts`.
2. Add event to `registry.ts` and `contracts.ts`.
3. Update `SessionReadModel` and `SessionProjectionBuilder.ts` (with tests).
4. Implement `ReadingObserver.ts` (with tests).
5. Wire `ChatGPTAdapter.ts` and `ClaudeAdapter.ts`.

## 22. Invariant Ledger
| Invariant | Repository Basis | Implementation Guarantee | Test Guarantee | Status |
|---|---|---|---|---|
| No raw scroll on EventBus | Architectural design | Computed locally in Observer | Component validation | VERIFIED |
| One event per response | State machine isolation | Transition to IDLE upon first action | Lifecycle test | VERIFIED |
| Correct prompt correlation | `response.started` payload | Cached `promptEventId` | Correlation test | VERIFIED |
| Session isolation | `session.started` boundary | State reset on session events | Isolation test | VERIFIED |
| No GapProfile pollution | `GapProfileReadModel` schema | Only `SessionReadModel` updated | Code review | VERIFIED |
| Idempotent projection | Missing native idempotency | `processedReadingPrompts` array | Projection duplicate test | ENGINEERING DECISION |
| Missing-container fail-open | Defensive programming | Null-check before binding | Failure test | VERIFIED |
| Legacy ReadModel compat | IndexedDB deserialization | Optional properties + safe math | Projection init test | VERIFIED |

## 23. Final Implementation Boundary
**PRODUCTION CHANGES**:
- `src/platforms/selectors/interfaces.ts`
- `src/platforms/selectors/chatgpt-v1.ts`
- `src/platforms/selectors/claude-v1.ts`
- `src/core/event-bus/registry.ts`
- `src/core/event-bus/contracts.ts`
- `src/storage/projections/builders/SessionProjectionBuilder.ts`
- `src/platforms/observers/ReadingObserver.ts` (NEW)
- `src/platforms/chatgpt/ChatGPTAdapter.ts`
- `src/platforms/claude/ClaudeAdapter.ts`

**TEST CHANGES**:
- `src/platforms/observers/ReadingObserver.selftest.ts` (NEW)
- `src/storage/projections/builders/SessionProjectionBuilder.selftest.ts`

**FINDINGS CLASSIFICATION**:
- **BLOCKERS**: None.
- **NON-BLOCKING FINDINGS**: None.
- **REJECTED ASSUMPTIONS**: "Projection builder inherently handles idempotency" (REJECTED by repository evidence; fixed in plan). "Clock starts exactly at reading" (REJECTED; it is an engineering approximation of engagement).
- **VERIFIED DECISIONS**: Event correlation via `promptEventId`, fail-open DOM abstraction, projection aggregation mathematics.

**IMPLEMENTATION AUTHORIZED**
