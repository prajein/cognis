# RFC 2: Surface B ↔ Background Bridge Implementation Plan

**Author:** Cognis Architecture Lead (`Naren`)  
**Status:** APPROVED  
**Type:** Implementation Plan / Architectural Design Document  

---

## 1. Executive Summary & Problem Statement

During our architectural audit of Surface B (`src/sidepanel/`), we identified that the sidepanel UI (`SurfaceB.tsx` → `useSession.ts` → `SessionManager.ts`) currently operates in complete isolation from the rest of the extension runtime. It relies on a transient, local `InMemorySessionRepository` stored inside a React `useRef` singleton and lacks connection to the cross-process `ExtensionEventBridge` or the canonical event store.

As a result:
1. **Process Blindness**: When a user selects a task and starts a session in Surface B, the state transition exists solely in transient React memory. No events reach the Background worker (`src/background/`), preventing `InsightScheduler`, `InsightEngine`, and `SessionProjectionBuilder` from executing.
2. **State Loss on Reopen**: Because `InMemorySessionRepository` lives in UI memory, closing and reopening the sidepanel resets all session timers and task selections.
3. **Architectural Coupling in Draft 1 (Rejected)**: Our initial proposal attempted to solve this by wrapping React in an `<EventBusProvider>` and instantiating a local `ReadModelRepository` inside the sidepanel process. This violated fundamental separation of concerns: React must consume infrastructure services rather than owning them, and multiple extension processes concurrently opening IndexedDB connections introduces lock contention, schema validation hazards, and split-brain persistence.

This RFC defines the canonical bridge architecture between Surface B (`sidepanel`) and the `background` runtime, adhering strictly to clean runtime composition, centralized storage ownership, transport-agnostic service abstractions, and explicit Command/Query separation.

---

## 2. Runtime Ownership & Architectural Invariants

To eliminate coupling and process boundary hazards, ownership is strictly partitioned across runtime layers:

```
+-----------------------------------------------------------------------------------+
| SIDEPANEL PROCESS                                                                 |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | UI Layer (React)                                                            |  |
|  |  [SurfaceB.tsx] ---> [useSession Hook] ---> [SessionService (UI Façade)]    |  |
|  +-----------------------------------------------------------------------------+  |
|                                         |                                         |
|                                         v  (Consumes services, never owns)        |
|  +-----------------------------------------------------------------------------+  |
|  | SidepanelRuntime Composition Root (src/sidepanel/runtime/)                  |  |
|  |  [bootstrap.ts / container.ts]                                              |  |
|  |     |-- own --> Local EventBus (sidepanel-scoped)                           |  |
|  |     |-- own --> Transport (pluggable; default supplied by composition root) |  |
|  |     +-- own --> SessionGateway (SessionCommandGateway + SessionQueryGateway)|  |
|  +-----------------------------------------------------------------------------+  |
+---------------------------------------|-------------------------------------------+
                                        |
                              Transport (pluggable)
                                        |
+---------------------------------------|-------------------------------------------+
| BACKGROUND PROCESS                    v                                           |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | BackgroundRuntime Composition Root (src/background/)                        |  |
|  |  [EventBus (host)] <---> [Transport Host]                                   |  |
|  |                                    |                                         |  |
|  |                                    v                                         |  |
|  |  [SessionProjectionBuilder] & [Background Engines]                          |  |
|  |                                    |                                         |  |
|  |                                    v                                         |  |
|  |  [ReadModelRepository] & [CognisDatabase] (EXPLICIT SOLE OWNER)            |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 2.1 Persistence Ownership (Background Worker Only)

- **Sole Source of Truth**: The `Background` runtime (`src/background/`) exclusively owns `CognisDatabase` and all instances of `ReadModelRepository`.
- **No Sidepanel Database Access**: The sidepanel process MUST NOT import `CognisDatabase`, open IndexedDB connections directly, or instantiate `ReadModelRepository`. All read and write operations against persistent state (`events` or `read_models`) are brokered by the background worker through the `SessionGateway`.

### 2.2 Infrastructure Ownership (`SidepanelRuntime` Composition Root)

- **Separation from React**: Infrastructure services (`EventBus`, `Transport`, `SessionGateway`) are owned and bootstrapped by a dedicated runtime container located in `src/sidepanel/runtime/`. React components consume higher-level service interfaces via hooks. They do not instantiate, tear down, or reference infrastructure directly.
- **Multi-Context Scalability**: If `popup`, `options`, or `devtools` panels are introduced, they each possess their own runtime composition root (`src/popup/runtime/`, `src/options/runtime/`) following the exact same pattern. Additional cross-process gateways (`InsightGateway`, `ProfileGateway`, `TaskGateway`) will follow this exact same runtime pattern, establishing a universal, scalable bridge topology across all Cognis extension contexts.

### 2.3 Authoritative Event Invariant

> **Background-originated session events are authoritative. Sidepanel-originated actions are commands, not state. The sidepanel MUST NOT optimistically assume persistence. The UI transitions to the next state only after receiving the authoritative `session.*` event broadcast from the background projection — never before.**

This invariant enforces that the CQRS model is maintained end-to-end. If a `startSession()` command is dispatched, the sidepanel does **not** immediately render `SESSION_ACTIVE`. It renders `SESSION_ACTIVE` only after the background has persisted the `SessionReadModel` and broadcast `session.started` back through the `Transport`. This prevents the sidepanel from ever showing a state that the background has not confirmed.

### 2.4 Authoritative Session State (`SessionReadModel`)

- The `SessionReadModel` stored in the `read_models` object store (built by `SessionProjectionBuilder` inside the background process) is the definitive, authoritative representation of session state across the entire platform. All UI state derives from it.

### 2.5 Layer Responsibilities & Dependency Hierarchy

To ensure clear separation between orchestration, UI consumption, and cross-process communication, the session architecture is explicitly layered:

```
[SurfaceB.tsx]
      ↓
[useSession.ts]
      ↓
[SessionService (UI-facing façade)]
      ↓
[SessionManager (Domain lifecycle rules & state machine)]
      ↓
[SessionGateway (Transport boundary: Command + Query separation)]
      ├── SessionCommandGateway (Converts commands to canonical domain events)
      └── SessionQueryGateway (Brokers read-model hydration queries)
      ↓
[Transport (Pluggable cross-process boundary)]
      ↓ (Chrome IPC / MessagePort / WebSocket)
[Background Transport Host]
      ↓
[Background EventBus & Query Handlers]
      ↓
[SessionProjectionBuilder]
      ↓
[ReadModelRepository & CognisDatabase]
```

- **`SessionService`**: The UI-facing façade consumed directly by React hooks (`useSession`). Exposes clean application actions (`startSession(taskId)`, `pauseSession()`) and reactive state observables (`onStateChanged`). It isolates React from domain transition complexity and transport mechanics.
- **`SessionManager`**: The domain state machine and lifecycle orchestrator. Owns the business rules of session transitions (`IDLE → ACTIVE → PAUSED → ENDED`), validating that a state transition is legal before dispatching. Repositories and gateways do not orchestrate; `SessionManager` does.
- **`SessionGateway` (`SessionCommandGateway` + `SessionQueryGateway`)**: The transport boundary facade. Its responsibilities are cleanly partitioned:
  - **`SessionCommandGateway`**: Converts validated domain commands from `SessionManager` into canonical domain events (`SessionEvents.STARTED`, `SessionEvents.PAUSED`, etc.) for transport across process boundaries.
  - **`SessionQueryGateway`**: Brokers read-model state queries (`getActiveSession()`) across the transport without exposing message IDs or envelopes.
- **`Transport`**: Pluggable cross-process communication layer. Chrome IPC is an **implementation detail** of the default `Transport` supplied during bootstrapping. Changing the transport (e.g., for testing or a future Electron port) requires zero changes to the hooks, services, or gateways.

---

## 3. Event Contract Evolution (RFC 2 Scope)

> **Scope Declaration**: This RFC extends the Session event contract to carry `platform` and `taskId`. This is intentionally scoped within RFC 2 because these fields are required to make the session gateway hydration and command flows semantically meaningful. They do not alter the event store schema beyond adding optional fields.

### 3.1 Session Event Payload Extension

#### [MODIFY] [contracts.ts](file:///Users/ntbnaren7/Dev/cognis/src/core/event-bus/contracts.ts)

- Extend `SessionStartedPayload` to carry optional `platform` and `taskId`:
```typescript
export interface SessionStartedPayload {
  readonly platform: string;
  readonly taskId?: string;
}
```

These fields are **backward compatible**: existing callers that do not supply `taskId` continue to work. `platform` documents the process context that initiated the session (`'content-script'` from `PlatformManager`, `'side-panel'` from `SurfaceB`).

### 3.2 Projection Schema Extension

#### [MODIFY] [SessionProjectionBuilder.ts](file:///Users/ntbnaren7/Dev/cognis/src/storage/projections/builders/SessionProjectionBuilder.ts)

- Extend `SessionReadModel` to carry `taskId`:
```typescript
export interface SessionReadModel {
  projectionId: string;
  sessionId: string;
  platform: string;
  taskId?: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'paused' | 'ended';
  totalPauseDurationMs: number;
  lastUpdated: number;
}
```

- Update `handleEvent(event)` to extract `taskId` from `SessionStartedPayload` and persist it on the read model. If absent, persist `undefined`.

---

## 4. Command Flow (Sidepanel → Background)

All mutations initiated from Surface B are commands. They are validated by `SessionManager`, converted into canonical domain events by `SessionCommandGateway`, and transported to the background.

> **Architectural Note — `SessionManager` and `SessionCommandGateway` coupling**: In this sprint, `SessionManager` directly invokes `SessionCommandGateway` after validating a transition. This is an intentional application-boundary tradeoff: `SessionManager` is already an application-layer concern (it does not represent a pure domain entity in DDD terms — it coordinates UI lifecycle, not business invariants). An alternative design would have `SessionManager` return a `SessionCommand` value object for `SessionService` to dispatch through the gateway, keeping the manager entirely transport-agnostic. That model is the preferred long-term direction, but it adds an extra type and dispatch step that is premature at this stage. **The `SessionManager → SessionCommandGateway` dependency should be revisited when Cognis introduces multiple platforms (e.g., native, Electron) that require separate command routing.** Reviewers should treat the gateway as an application boundary, not a domain dependency.

### 4.1 Execution Path

1. **User Action**: User selects a task and clicks "Start Session" in Surface B.
2. **UI Dispatch**: `useSession.ts` calls `sessionService.startSession(taskId)`.
3. **Domain Validation**: `SessionService` delegates to `SessionManager`, which validates that the session is currently `IDLE` and transitions its internal state machine.
4. **Command Conversion & Transport**: `SessionManager` invokes `SessionCommandGateway.startSession(taskId)`. The gateway converts this command into a canonical domain event (`SessionEvents.STARTED` with `{ platform: 'side-panel', taskId }`) and publishes it onto the local `EventBus`, which the `Transport` intercepts and carries to the background.
5. **Background Processing**: The background `Transport` host receives the event and re-publishes `SessionEvents.STARTED` onto the background `EventBus`, triggering `SessionProjectionBuilder.handleEvent()`.
6. **Persistence**: `SessionProjectionBuilder` writes the canonical `SessionReadModel` (with `taskId`) into `read_models` via `ReadModelRepository.put()`.
7. **Authoritative Broadcast**: The background `Transport` broadcasts `session.started` back to the sidepanel. The sidepanel `useSession` hook transitions the UI to `SESSION_ACTIVE` **only upon receiving this broadcast** — never optimistically on step 2.

---

## 5. Query Flow & Reactive Synchronization (Background → Sidepanel)

Because the sidepanel does not access IndexedDB directly, it retrieves initial state through the `SessionQueryGateway` and remains synchronized via bridged domain events.

### 5.1 Initial State Hydration (Reopen / Mount)

When Surface B opens or reloads, the runtime bootstraps first and fetches existing state before React renders session-dependent UI:

1. **Bootstrap Phase**: `bootstrapSidepanelRuntime()` calls `SessionQueryGateway.getActiveSession()`.
2. **Gateway Query**: `SessionQueryGateway` delegates to the `Transport`, which sends a query message to the background worker.
3. **Background Execution**: A dedicated `SessionQueryHandler` (located in `src/background/handlers/`) receives the query, reads `ReadModelRepository` for `status === 'active'`, and returns the canonical `SessionReadModel` (or `null` if no session is active). This handler must never be inlined into `background/index.ts`; centralizing query handler logic in dedicated files prevents the composition root from accumulating anonymous handlers.
4. **Container Population**: The resolved `SessionReadModel` is stored in `SidepanelContainer.runtimeState.activeSession`.
5. **React Render**: React renders a **loading shell** immediately on mount. Once `container.runtimeState` is ready, the hook hydrates session state and re-renders the full session UI. Slow background startup does not block the initial UI paint.

### 5.2 Real-Time Event Synchronization

Once bootstrapped, the sidepanel stays synchronized via bridged events:

1. **Background Broadcast**: When any background engine publishes `SessionEvents.PAUSED`, `SessionEvents.RESUMED`, `SessionEvents.ENDED`, or `AUTOMATICITY_UPDATED`, the background `Transport` broadcasts the event envelope to all connected clients.
2. **Local Bus Delivery**: The sidepanel `Transport` receives the envelope and dispatches the event onto the local `EventBus`.
3. **Reactive Service Update**: `sessionService` (consumed by `useSession`) subscribes to these events and produces new state, ensuring timer displays, status badges, and pause counters reflect the canonical background projection without local drift.

---

## 6. Runtime Lifecycle (End-to-End)

This section provides the complete lifecycle sequence from extension load through reopen/hydration:

```
1. Extension loads
        ↓
2. Background bootstraps
   └── Instantiates EventBus, Transport (host), ReadModelRepository, CognisDatabase
   └── Registers ProjectionBuilders, Engines, InsightScheduler
        ↓
3. Transport host is ready (accepting connections)
        ↓
4. User opens Sidepanel
        ↓
5. SidepanelRuntime bootstraps (src/sidepanel/runtime/bootstrap.ts)
   └── Instantiates local EventBus
   └── Instantiates Transport (client) → connects to background host
   └── Instantiates SessionGateway(transport)
   └── Calls SessionGateway.getActiveSession()
        ↓
6. [Failure case → See Section 7]
        ↓
7. React mounts → renders loading shell immediately
        ↓
8. Runtime hydration resolves
   └── container.runtimeState.activeSession populated (or null)
        ↓
9. useSession hook reads activeSession → renders full session UI
        ↓
10. User starts session
    └── useSession calls sessionService.startSession(taskId)
    └── SessionManager validates legal transition IDLE → ACTIVE
    └── SessionCommandGateway converts command to SessionEvents.STARTED
    └── Transport carries event → Background EventBus
    └── SessionProjectionBuilder persists SessionReadModel
        ↓
11. Background engines activate (InsightScheduler, GapDetection)
    └── Projection updates published onto background EventBus
    └── Transport broadcasts to sidepanel client
    └── Local EventBus delivers event
    └── useSession updates → React re-renders
        ↓
12. User closes Sidepanel
    └── Transport client disconnects cleanly
        ↓
13. User reopens Sidepanel → return to step 5
    └── Hydration at step 8 restores session (timer, taskId, status)
```

---

## 7. Failure Semantics

The runtime must handle background process unavailability gracefully. Failure is not exceptional — service workers sleep, the background can restart mid-session, and ports can drop.

### 7.1 Hydration Failure (Background Unavailable at Open)

| Condition | Behavior |
|---|---|
| Background not yet ready | `SessionQueryGateway.getActiveSession()` waits up to a configurable timeout |
| Timeout exceeded | Resolve with `null` (treat as no active session) |
| Transport connection refused | Render `DISCONNECTED` state indicator in UI; enable retry |

The sidepanel **must render the loading shell** before the hydration timeout resolves. The UI must never block paint waiting for the background.

### 7.2 Mid-Session Transport Disconnect

| Condition | Behavior |
|---|---|
| Port drops while session active | `Transport` fires a `disconnect` event on the local `EventBus` |
| `sessionService` receives `disconnect` | Transitions UI to `RECONNECTING` state (timer pauses display, not session) |
| Reconnection succeeds | Re-executes `SessionQueryGateway.getActiveSession()` to re-sync state |
| Reconnection fails after retries | Transitions UI to `DISCONNECTED`; timer is frozen until re-sync |

### 7.3 Malformed or Missing Response

- If the background returns a structurally invalid `SessionReadModel`, the runtime logs a warning and resolves with `null` (safe fallback, no crash).
- Commands dispatched while disconnected are **dropped with a warning**. Command queuing is explicitly out of scope for this RFC.

---

## 8. UI Integration & Composition Root Restructuring

### 8.1 New Sidepanel Composition Root (`src/sidepanel/runtime/`)

#### [NEW] [bootstrap.ts](file:///Users/ntbnaren7/Dev/cognis/src/sidepanel/runtime/bootstrap.ts)

- Implements `bootstrapSidepanelRuntime(): Promise<SidepanelContainer>`:
  1. Instantiates `EventBus`.
  2. Instantiates the default `Transport` implementation (currently `ExtensionEventBridge` configured for `'side-panel'`; the composition root owns this choice — callers do not).
  3. Instantiates `SessionGateway(transport)`.
  4. Calls `SessionGateway.getActiveSession()` with timeout; resolves to `SessionReadModel | null`.
  5. Returns a frozen `SidepanelContainer`.

#### [NEW] [container.ts](file:///Users/ntbnaren7/Dev/cognis/src/sidepanel/runtime/container.ts)

- Defines `SidepanelContainer` exposing **higher-level service interfaces**, not raw infrastructure:

```typescript
export interface SidepanelContainer {
  readonly sessionService: SessionService;
  readonly eventPublisher: EventPublisher;
  readonly runtimeState: {
    readonly activeSession: SessionReadModel | null;
    readonly connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  };
}
```

Hooks consume `sessionService` and `eventPublisher`. They do not reference `EventBus`, `Transport`, or `SessionGateway` directly.

#### [NEW] [SessionGateway.ts](file:///Users/ntbnaren7/Dev/cognis/src/sidepanel/runtime/SessionGateway.ts)

- Implements `SessionGateway` as the composite facade implementing both `SessionCommandGateway` and `SessionQueryGateway` over the `Transport`:
  - **Query**: `getActiveSession(): Promise<SessionReadModel | null>`
  - **Command**: `startSession(taskId: string): void`
  - **Command**: `endSession(): void`
  - **Command**: `pauseSession(): void`
  - **Command**: `resumeSession(): void`
- Internally: commands publish events via `EventBus`; queries delegate to `Transport.query()`.

### 8.2 `SessionManager` Refactor (Not Deletion)

The `SessionManager.ts` file is **not deleted**. Its current in-memory implementation is replaced with a version that:
- Delegates lifecycle commands (`start`, `end`, `pause`, `resume`) to `SessionGateway`.
- Derives its state from `SessionReadModel` projections rather than maintaining local memory state.
- Coordinates the session state machine (validating transitions) before dispatching events.

Orchestration belongs in `SessionManager`, not in repositories. Once refactored, `SessionManager` becomes the correct abstraction layer between the `SessionService` UI façade and the gateway.

#### [MODIFY] [SessionManager.ts](file:///Users/ntbnaren7/Dev/cognis/src/sidepanel/features/session/manager/SessionManager.ts)
- Replace `InMemorySessionRepository` dependency with `SessionGateway`.
- Delegate all lifecycle commands to `SessionGateway`.
- Retain the state machine that validates legal transitions (`IDLE → ACTIVE → PAUSED → ENDED`).

#### [DELETE] [InMemorySessionRepository.ts](file:///Users/ntbnaren7/Dev/cognis/src/sidepanel/features/session/repository/InMemorySessionRepository.ts)
- Delete only the transient in-memory repository implementation. The `SessionRepository` interface file may be retained if it is referenced elsewhere.

#### [MODIFY] [useSession.ts](file:///Users/ntbnaren7/Dev/cognis/src/sidepanel/features/session/hooks/useSession.ts)
- Remove direct references to `InMemorySessionRepository` and `useRef` singletons.
- Consume `SidepanelContainer.sessionService`.
- Initialize local React state using `container.runtimeState.activeSession`.
- Subscribe to session events delivered on the local `EventBus` to drive reactive UI updates.
- Render a loading/disconnected shell while `connectionStatus !== 'connected'`.

---

## 9. Out of Scope

This RFC explicitly does **not** touch:
- **Storage Layer & Migrations**: `ReadModelRepository`, IndexedDB schema, `v3Migration` (closed under RFC 1).
- **Perception Layer**: `TypingObserver`, `ResponseObserver`, DOM mutation capture.
- **Intelligence Engines**: `GapDetectionEngine.ts`, `InsightEngine.ts`, `V1AutomaticityEvaluator.ts`.
- **Platform Adapters**: `PlatformManager.ts`, `ClaudeAdapter.ts`, `GeminiAdapter.ts`.
- **Event Store Schema**: The `events` object store inside `CognisDatabase`.
- **Command Queuing**: Commands dispatched while disconnected are dropped (deferred to a future RFC).
- **`SessionManager` → Command value-object refactor**: Keeping `SessionManager` transport-agnostic by returning `SessionCommand` values is explicitly deferred. The current coupling is documented in Section 4 and intentional for this sprint.

---

## 10. Verification & Acceptance Plan

### 10.1 Automated Integration Tests

1. **Command Loopback via Gateway (`SidepanelCommandFlow.test.ts`)**:
   - Construct a mock `Transport` (MessagePort-based, no Chrome API).
   - Construct `SessionGateway(mockTransport)`.
   - Call `sessionGateway.startSession('code-review')`.
   - Assert the mock Transport emits `SessionEvents.STARTED` with `{ platform: 'side-panel', taskId: 'code-review' }`.
   - Assert the background mock receives the event and `SessionProjectionBuilder` writes `SessionReadModel` with `taskId === 'code-review'`.

2. **Hydration via Gateway (`SidepanelHydration.test.ts`)**:
   - Seed background `ReadModelRepository` with `{ status: 'active', taskId: 'debugging', ... }`.
   - Call `SessionGateway.getActiveSession()` via mock transport.
   - Assert the returned `SessionReadModel` matches the seeded record.
   - Assert `SidepanelContainer.runtimeState.activeSession` is populated correctly.

3. **Failure Handling (`SidepanelFailure.test.ts`)**:
   - Simulate transport timeout (background does not respond within deadline).
   - Assert `getActiveSession()` resolves to `null` after timeout.
   - Assert `SidepanelContainer.runtimeState.connectionStatus === 'disconnected'`.
   - Simulate reconnect. Assert `connectionStatus` transitions to `'connected'` and state re-hydrates.

### 10.2 Manual & Visual Verification

1. **State Persistence Across Reopen**:
   - Open Surface B, select a task, and start a session. Observe `SESSION_ACTIVE`.
   - Close the sidepanel. Wait 10 seconds.
   - Reopen. Verify immediate `SESSION_ACTIVE` restoration with correct task and elapsed time.

2. **Loading Shell Behavior**:
   - Simulate slow background startup (e.g., artificial delay in dev).
   - Verify the UI renders a loading shell immediately and resolves to full session state after hydration — no blank screen or unhandled exception.

3. **Background Engine Triggering**:
   - Start a session from Surface B.
   - Inspect the background worker console and verify `InsightScheduler` receives the active session signal and begins evaluating periodic insight loops.
