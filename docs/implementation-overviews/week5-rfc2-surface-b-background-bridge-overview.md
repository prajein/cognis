# Week 5 RFC 2: Surface B ↔ Background Bridge — Architecture Walkthrough

**Module**: `src/sidepanel/runtime/`, `src/sidepanel/features/session/`
**Owner**: Architecture Lead (`Naren`)
**Implementation Date**: 2026-07-16
**Status**: Implemented and Verified
**Reference**: [RFC 2 Plan](../implementation-plans/week5-rfc2-surface-b-background-bridge-plan.md)

---

## 1. Executive Summary

We have successfully implemented **RFC 2: Surface B ↔ Background Bridge**, establishing clean CQRS boundaries, decoupling React from infrastructure ownership, and bridging the sidepanel to authoritative background read models. 

By separating commands from queries, isolating Chrome IPC interactions inside a unified gateway, and bootstrapping sidepanel dependencies in a dedicated runtime composition root, we eliminated split-brain IndexedDB writes. The sidepanel now acts as an observer of background-broadcasted facts while delegating state mutations through a transport gateway. Additionally, we addressed command/event echoing via generic transport metadata on the event envelope.

---

## 2. Files Created and Modified

### Core IPC & Event Contracts
- **[MODIFY]** `src/core/event-bus/contracts.ts`: Added optional `origin?: 'local' | 'remote'` and `isAuthoritative?: boolean` fields to `DomainEvent<T>` to transport context metadata.
- **[NEW]** `src/core/ipc/messages.ts`: Defined standard IPC request/response interfaces (`QueryActiveSessionRequest`, `QueryActiveSessionResponse`) shared across contexts.
- **[MODIFY]** `src/core/event-bus/ExtensionEventBridge.ts`: Updated bridge to stamp incoming remote IPC events with `origin: 'remote'` and `isAuthoritative: true`, and added background worker broadcasting logic to keep all UI tabs/ports in sync.

### Background Query Layer
- **[NEW]** `src/background/handlers/SessionQueryHandler.ts`: Implemented background listener for `QUERY_ACTIVE_SESSION` messages that queries IndexedDB active session projections.
- **[MODIFY]** `src/background/index.ts`: Registered `SessionQueryHandler` within the background worker startup sequence.
- **[MODIFY]** `src/storage/repositories/ReadModelRepository.ts`: Added `getAllByPrefix` to query projections by category prefix.

### Sidepanel Runtime (Composition Root)
- **[NEW]** `src/sidepanel/runtime/SessionCommandGateway.ts`: Defined write-only interface for session domain commands.
- **[NEW]** `src/sidepanel/runtime/SessionQueryGateway.ts`: Defined read-only interface for session active queries.
- **[NEW]** `src/sidepanel/runtime/SessionGateway.ts`: Unified implementation of gateways mapping domain calls to event publications (commands) and Chrome IPC (queries).
- **[NEW]** `src/sidepanel/runtime/container.ts`: Declared types and interfaces for the frozen composition container.
- **[NEW]** `src/sidepanel/runtime/bootstrap.ts`: Created the single-entry bootstrap runtime that instantiates services, gateways, and registers IPC event bridges exactly once per process.
- **[NEW]** `src/sidepanel/runtime/RuntimeContext.tsx`: React Context provider and hook (`useSidepanelRuntime`) wrapping the container.
- **[MODIFY]** `src/sidepanel/main.tsx`: Wired the bootstrap function at module scope and added a loading/connecting screen before rendering.

### Domain Machine & UI Integration
- **[MODIFY]** `src/sidepanel/features/session/manager/SessionManager.ts`: Refactored to depend on `SessionCommandGateway` instead of local storage. Maintained domain state machine transitions (`getNextState`).
- **[DELETE]** `src/sidepanel/features/session/repository/InMemorySessionRepository.ts`: Purged local storage logic from the presentation layer.
- **[MODIFY]** `src/sidepanel/features/session/hooks/useSession.ts`: Refactored to consume the bootstrap services and update state strictly when authoritative background events arrive.
- **[MODIFY]** `src/sidepanel/features/surface-b/SurfaceB.tsx`: Added reconnecting UI shells to handle broker disconnected states.

---

## 3. Architectural Decisions & Mappings

| Architectural Constraint | Implementation Result |
| --- | --- |
| **Purity of Domain Layer** | `SessionManager` relies strictly on interfaces and has zero knowledge of transport, Chrome IPC, or storage. |
| **Separation from React** | React components consume higher-level interfaces via `useSidepanelRuntime()` and do not instantiate or reference infrastructure directly. |
| **Authoritative Event Invariant** | UI state updates (`useSession`) only execute when `event.isAuthoritative === true`, preventing local command echo desynchronization. |
| **Zero Sidepanel Database Access** | The sidepanel does not instantiate `CognisDatabase` or write to IndexedDB; all persistence is delegated to the background worker. |

---

## 4. Preservation of Invariants

- **Singleton Bootstrap**: Evaluating bootstrap at module scope prevents duplicate `EventBus`, `ExtensionEventBridge`, or `SessionGateway` allocations.
- **IPC Safety**: `chrome.runtime.*` usage is strictly encapsulated in `SessionGateway`, isolating the rest of the app from platform-specific APIs.
- **CQRS Isolation**: Write paths (commands via local bus to IPC bridge) and read paths (queries via query handler) operate in separate channels.

---

## 5. Verification Steps Executed

- **Compilation**: Verified type-safety across the workspace using `npx tsc --noEmit`.
- **Validation**: Executed `npm test` verifying that brain-map assets and schemas conform to project invariants.
- **Post-Audit verification**: Verified that local command echos are ignored in `useSession` and that background worker successfully rebroadcasts authoritative events.
