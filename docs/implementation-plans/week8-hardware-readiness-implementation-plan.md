# Week 8 Hardware Readiness Implementation Plan

## 1. Scope
Implement implicit session lifecycle creation to allow a supported platform (e.g., ChatGPT, Claude) to initialize without a manual session start from Surface B. This resolves the previously audited missing path, ensuring observation begins automatically and `session.started` is explicitly persisted in the event store.

## 2. Authoritative Requirements
- **Implicit session generation**: Specified by `src/core/event-bus/contracts.ts` (Absent when the session is started implicitly by the platform adapter).
- **Session events reach persistence**: Invariants mandate the `EventBus` and `EventStoreSubscriber` remain the sole path to IndexedDB.
- **Hardware-ready fields & arc hooks**: BLOCKED ON SPECIFICATION. We strictly isolate and DO NOT implement these.

## 3. Existing Architecture
- **Surface B (`SessionGateway`)**: Manually starts sessions and emits `session.started`. This is bridged to the background and works flawlessly.
- **Platform (`content-script.ts`)**: Queries the background for an active session. If it finds one, it calls `PlatformManager.beginObservation(sessionId)`. If it doesn't, it did nothing prior to this implementation.
- **Platform (`PlatformManager.ts`)**: Handles observation state but required an explicit `sessionId`. Emits `session.ended`, `session.paused`, and `session.resumed` on tab lifecycle events, but only if `beginObservation` was successfully called.

## 4. Session ID Ownership
Two independent generation points now exist. `SessionGateway` creates the session UUID if a user explicitly opens the sidepanel and starts one. `PlatformManager` creates the session UUID if a user navigates to a platform and no session was recovered. In both paths, the created UUID is stamped on the `session.started` event and acts as the sole active identifier.

## 5. Event Bridge Architecture
The `ExtensionEventBridge` in `content-script.ts` relies on `eventsToBridge` to route content events to the background. By adding `SessionEvents.STARTED` and `SessionEvents.ENDED` to this array, we enable the implicit session lifecycle to automatically persist in the background's `EventStoreSubscriber` without introducing custom messaging or IndexedDB writes.

## 6. Implicit Session Implementation

### `src/platforms/manager/PlatformManager.ts`
- Updated `beginObservation` signature to `public beginObservation(sessionId?: SessionId): void`.
- If `sessionId` is not provided, we generate a new UUID and dispatch a `session.started` domain event with `source: 'platform-adapter'` and the `platform` (e.g., `chatgpt` or `claude`).

### `src/content/content-script.ts`
- Added `SessionEvents.STARTED` and `SessionEvents.ENDED` to `eventsToBridge` to ensure the implicitly created events reach the background's `EventStoreSubscriber` for persistence.
- Updated the initialization logic to call `platformManager.beginObservation()` without an ID when no active session is recovered.

## 7. Session Lifecycle Invariants
- **INVARIANT 1**: A supported platform initializes and creates an implicit session immediately if no active session exists.
- **INVARIANT 2**: Only one `session.started` event is emitted.
- **INVARIANT 3**: If Surface B has an active session, platform initialization preserves it without duplicating.
- **INVARIANT 4**: The generated session ID propagates naturally to all prompt/response events via the active adapter.
- **INVARIANT 5**: `session.started` follows the standard `EventBus` -> `ExtensionEventBridge` -> `EventStoreSubscriber` path. No raw IndexedDB writes.

## 8. Hardware Readiness Boundary
The existing Arc event contracts and `signal_frame`/`state_score` IndexedDB schemas remain untouched. We did NOT implement an Arc adapter. The hardware architecture is purely an event contract interface ready to be integrated when hardware is supplied.

## 9. Explicitly Non-Implemented Hardware Work
- Hardware nullable fields in `StateSnapshot`/`SessionReadModel`.
- The Hardware Integration Map.
- BLE mappings and Arc characteristics.

## 10. Tests
- Created `src/platforms/manager/PlatformManager.selftest.ts`.
- Mocks out the browser environment, explicitly verifying implicit session creation, explicit session restoration, idempotency (duplicate prevention), and `session.ended` propagation.

## 11. Verification
- `npm run build` confirmed `hardware.connected` and `session.started` exist in the bundle.
- `npx tsc --noEmit` passed.
- 13 out of 13 selftests (including the new one) passed.
- `git diff --check` passed (fixed trailing whitespace).

## 12. Acceptance Criteria
All implicit session creation goals were met successfully.

## 13. Remaining Blockers
Hardware property implementation is blocked until the exact field names and domain mappings are explicitly authored in a Hardware Integration Map.

## 14. Final Status
IMPLEMENTED AND VERIFIED. The implicit session pipeline is complete. Hardware readiness is paused on missing specification.
