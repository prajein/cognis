# ADR-019: Transient Transport Data Policy

**Date**: 2026-06-30
**Status**: Approved
**Context**: Architecture Governance / Response Intelligence Engine

## 1. Context

Cognis relies on an Event-Driven Architecture where the EventBus synchronously routes Domain Events to all registered subscribers. Under standard Event Sourcing semantics, every field on a Domain Event is a durable fact that must be persisted to the Event Store (IndexedDB). Furthermore, the Engineering Constitution (Section 2) strictly prohibits the persistence or transmission of raw conversational text, OCR data, or raw biometric streams to protect user privacy.

However, engines like the **Response Intelligence Engine** require access to the raw data (e.g., `chunkText`) transiently in-memory to perform deep linguistic and structural analysis. Without a constitutional mechanism to safely transport this raw data across the EventBus without violating zero-persistence invariants, analytical capabilities are severely crippled.

We must establish an architectural policy for safely transporting transient data across the EventBus without mutating immutable events or violating persistence guarantees.

## 2. Decision

We establish a **Transient Transport Data Policy**. 

The EventBus is permitted to transport transient payload fields that are explicitly classified as **transport-only**. `chunkText` on the `ResponseChunkPayload` is the first concrete implementation of this policy. Future applications may include OCR text, speech transcripts, clipboard snapshots, or raw hardware signal windows.

### Transient Transport Data Rules

Transport-only fields are legally classified as volatile transport data, not persistent domain facts. The following strict lifecycle applies:

1. **EventBus Transport Exception**: Transport-only fields are valid *only* during synchronous event dispatch.
2. **Immutability of Facts**: The original event published on the EventBus remains immutable for the duration of dispatch. Subscribers MUST NEVER mutate or `delete` properties from the event object, as this would cause unpredictable state for downstream subscribers.
3. **Persistence Mapping (Sanitization)**: The Storage Layer MUST exclude transport-only fields during persistence mapping. The `EventRepository` persists a sanitized DTO, not the raw event envelope.
4. **No Projections**: Transport-only fields must never be written to Read Models.
5. **No Telemetry**: Transport-only fields must never be logged to the console, exported, or sent to external telemetry/analytics systems.
6. **No Replay**: Because the data is stripped prior to persistence, transport-only fields are completely unavailable during historical event replays. 
7. **Dereferencing (Garbage Collection)**: Any engine consuming transport-only fields (e.g., the `ReconstructorBuffer` within the Response Intelligence Engine) must explicitly dereference and destroy the assembled data immediately after analysis.

## 3. Layer Access Permissions

To enforce this policy, the following access rules apply to `chunkText` (and all future transport-only fields):

| Layer | Can access transport-only fields? | May persist? |
| :--- | :--- | :--- |
| **Platform Adapter** | ✅ | ❌ |
| **EventBus** | ✅ | ❌ |
| **Response Intelligence Engine** | ✅ | ❌ |
| **EventStoreSubscriber** | ✅ (for sanitization only) | ❌ |
| **EventRepository** | ❌ (receives sanitized event DTO) | ✅ (sanitized only) |
| **Projection Builders** | ❌ | ❌ |
| **Insight Engine** | ❌ | ❌ |
| **IndexedDB (Storage)** | ❌ | ❌ |

## 4. Consequences

### Positive
- **Unblocks Intelligence**: Allows domain engines to perform deep analysis on transient, sensitive data.
- **Preserves Privacy & Immutability**: Strictly upholds Constitution Section 2 (zero persistence of sensitive data) and preserves the fundamental EventBus invariant that published events remain immutable.
- **Future Extensibility**: This policy serves as a reusable foundation for future high-bandwidth or sensitive streaming data (e.g., Arc hardware signal windows, clipboard state).

### Negative
- **Storage Layer Complexity**: The `EventStoreSubscriber` must now implement specific DTO mapping or stripping logic to guarantee transport-only fields are omitted before handing the event off to the `EventRepository`.
- **Replay Limitations**: Algorithm upgrades to engines depending on transport-only data will only apply to future sessions, as the data cannot be replayed from the Event Store.

## 5. Implementation Directives

1. **Contracts**: Update `src/core/event-bus/contracts.ts` -> `ResponseChunkPayload` to include `readonly chunkText?: string;`. Add a JSDoc comment explicitly labeling it as `[TRANSPORT-ONLY]`.
2. **Storage Mapping**: Update `src/storage/indexeddb/EventStoreSubscriber.ts` to implement a persistence mapping step that creates a sanitized clone of the event, excluding `chunkText`, before invoking `EventRepository.append()`.
