# Mock Harness — Architecture Walkthrough

**Module**: `src/mock/harness/`
**Owner**: Naren (Architecture Governance)
**Sprint**: Week 1 — "the mock harness runs"
**Status**: Implemented and Verified
**Reference**: [Mock Harness Implementation Plan](../implementation-plans/week1-mock-harness-implementation-plan.md)
**Constitution Reference**: Sections 2 (Event-Driven), 3 (Layer 6), 5 (Type Safety), 9 (Arc Readiness)

---

## 1. Executive Summary

The Mock Harness is an offline synthetic event producer that simulates real user
interactions (typing, pauses, revisions), AI platform behaviour (response
streaming, completion), session lifecycle, and future Arc BLE hardware biosignals
— all without requiring live AI platforms, browser DOM, or physical hardware.

It is a Week 1 deliverable because every downstream sprint (State Engine, Gap
Engine, Ghost Text, Surface B) requires a stable, deterministic event source for
development and validation before live platform adapters arrive in Week 4.

The sprint plan mandates: "the mock harness runs" and Week 2 depends on "a live
mock-harness demo of words-per-minute tracking, pause detection and state
inference."

## 2. Architecture

The Mock Harness sits in Layer 6 (Presentation & Sandbox) of the Cognis
architecture. It acts as a pure event producer — it generates canonical
`DomainEvent<T>` envelopes and publishes them onto the `EventBus`. Downstream
engines, storage, and projections process these events identically to live events.

```
MockHarness (orchestrator)
├── SyntheticEventGenerator (event factory helper)
├── StreamSimulator (async response chunk producer)
├── types.ts (configuration & scenario DTOs)
└── index.ts (public barrel export)
```

### Key Architectural Rules

1. **Event-Only Output**: Communicates exclusively via `EventBusContract.publish()`.
2. **No Business Logic**: Simulates *inputs* only. Does not perform gap detection,
   state inference, enrichment, or insight generation.
3. **No Direct Storage**: Never writes to IndexedDB. Persistence happens naturally
   via `EventStoreSubscriber`.
4. **No Engine Coupling**: Never imports or calls engine classes directly.
5. **Hardware-Ready**: Emits `hardware.signal.received` events in the exact payload
   shape that future Arc BLE hardware will produce.

## 3. Repository Structure

### Files Created

| File | Responsibility |
| --- | --- |
| **[NEW]** `src/mock/harness/types.ts` | Configuration interfaces (`MockHarnessConfig`, `TypingSimulationOptions`, `StreamSimulationOptions`) and simulation DTOs |
| **[NEW]** `src/mock/harness/SyntheticEventGenerator.ts` | Wraps `createDomainEvent` with typed builder methods for every simulatable event type |
| **[NEW]** `src/mock/harness/StreamSimulator.ts` | Async generator that streams `response.started` → N × `response.chunk` → `response.completed` with configurable delay |
| **[NEW]** `src/mock/harness/MockHarness.ts` | Top-level orchestrator with session lifecycle, typing, cognitive, response, and hardware simulation API |
| **[NEW]** `src/mock/harness/index.ts` | Public barrel export |
| **[NEW]** `src/mock/harness/MockHarness.selftest.ts` | Framework-free self-test (Checker pattern, 42 assertions) |

No existing files were modified.

## 4. Execution Flow

### Typing Simulation

```
MockHarness.simulateTyping(text)
  → SyntheticEventGenerator.promptTyped(text, revisionDepth)
    → cyrb53(text) → hash
    → createDomainEvent('prompt.typed', sessionId, 'mock-harness', payload)
  → eventBus.publish('prompt.typed', event)
  → [Engine subscribers execute synchronously]
  → [EventStoreSubscriber persists asynchronously]
```

### Response Streaming

```
MockHarness.simulateResponse(promptText, responseText, options)
  → StreamSimulator.stream(promptHash, responseText, options)
    → eventBus.publish('response.started', ...)
    → for each chunk:
        → await delay(chunkDelayMs)
        → eventBus.publish('response.chunk', { chunkText, chunkLength, totalLength })
    → eventBus.publish('response.completed', { responseLength, durationMs })
```

### Hardware Signal Simulation

```
MockHarness.simulateHardwareSignal(deviceId, signalType, value, confidence)
  → SyntheticEventGenerator.hardwareSignalReceived(...)
    → createDomainEvent('hardware.signal.received', ...)
  → eventBus.publish('hardware.signal.received', event)
```

## 5. Component Responsibilities

### MockHarness

The top-level entry point. Manages session state, guards against invalid
operations (e.g., simulating typing without an active session), and delegates
event construction to `SyntheticEventGenerator` and `StreamSimulator`.

### SyntheticEventGenerator

A stateless factory helper bound to a `SessionId`. Provides one typed builder
method per event type. Every method calls `createDomainEvent()` and returns
a fully-formed `DomainEvent<T>` envelope with branded identifiers.

Contains a standalone copy of `cyrb53` to hash prompt text without importing
from the perception layer (which would violate module boundaries).

### StreamSimulator

Accepts response text and breaks it into configurable fixed-size chunks.
Emits `response.started`, then iteratively emits `response.chunk` events with
configurable inter-chunk delay, then emits `response.completed`. Accepts an
injectable delay function so self-tests can run without real timers.

## 6. Events

The Mock Harness can simulate every event namespace in the registry:

| Namespace | Events |
| --- | --- |
| Session | `session.started`, `session.ended`, `session.paused`, `session.resumed` |
| Prompt | `prompt.typed`, `prompt.sent`, `prompt.cancelled` |
| Cognitive | `pause.detected`, `state.changed`, `gap.detected` |
| Response | `response.started`, `response.chunk`, `response.completed`, `response.abandoned` |
| Hardware | `hardware.connected`, `hardware.disconnected`, `hardware.signal.received` |

## 7. Configuration

All configuration is provided via `MockHarnessConfig`:

- `platform` — Platform string for session events (default: `'mock-harness'`).
- `taskId` — Optional task identifier for Surface B scenarios.
- `eventFactoryOptions` — Injectable `Clock` and `EventIdFactory` overrides
  for deterministic testing.

## 8. Runtime Behaviour

- The harness enforces strict session lifecycle: `startSession()` must be called
  before any simulation method, and `endSession()` must be called before starting
  a new session.
- All event envelopes carry the source string `'mock-harness'` for traceability.
- Raw prompt text is never included in event payloads — only `cyrb53` hashes.
- The `StreamSimulator` reports deterministic duration (chunks × delay), not
  wall-clock time.

## 9. Testing

The self-test validates 10 categories across 42 assertions:

1. Session lifecycle (start → end, event types, payload values)
2. Double-start guard (throws if session already active)
3. No-session guard (throws if no active session)
4. Typing simulation (text length, word count, hash, revision depth)
5. Cognitive events (pause detection, state transitions)
6. Response streaming (event count, chunk monotonicity, completion)
7. Hardware simulation (connect, signal, disconnect)
8. Event envelope structure (id, timestamp, sessionId, source)
9. Standalone generator usage
10. Session pause/resume

## 10. Limitations

- **No Scenario Playback**: JSON scenario loading is deferred to a future sprint.
- **No Event Replay**: Historical session replay from `EventRepository` is a
  future extension.
- **No MockPlatformAdapter**: The `PlatformAdapter` mock for integration with
  `PlatformManager` is deferred.
- **Timer Precision**: `StreamSimulator` depends on `setTimeout` for delays;
  service worker timer throttling may affect chunk timing in production contexts.

## 11. Future Work

- JSON scenario files for pre-defined interaction scripts.
- `EventReplayer` to replay historical sessions from `EventRepository`.
- `MockPlatformAdapter` implementing the `PlatformAdapter` interface.
- Integration with Surface B brain map rendering scenarios.

## 12. Engineering Notes

- The `cyrb53` hash function is duplicated from `TypingObserver.ts` to avoid a
  cross-layer dependency (mock → perception). Both implementations produce
  identical output. If the algorithm is ever centralised into a shared utility,
  both call sites should be updated.
- The harness uses `crypto.randomUUID()` for session IDs at runtime. Tests
  override this via the `eventFactoryOptions` pattern.
