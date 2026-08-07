# Cognis Mock Harness Implementation Plan

**Module**: `src/mock/harness/`
**Owner**: Naren (Architecture Governance)
**Sprint**: Week 1 — "the mock harness runs"
**Status**: Approved for Implementation
**Constitution Reference**: Sections 2 (Event-Driven), 3 (Layer 6 — Presentation), 9 (Arc Readiness)

---

## 1. Executive Summary & Design Goals

The Mock Harness is an offline synthetic event producer that simulates real user
interactions (typing, pauses, revisions), AI platform behaviour (response
streaming, completion, abandonment), and future Arc BLE hardware biosignals
(`hardware.signal.received`) — all without requiring live AI platforms, browser
DOM access, or physical hardware.

It is a Week 1 deliverable because every downstream sprint (State Engine, Gap
Engine, Ghost Text, Surface B) requires a stable, deterministic event source for
development and validation before live platform adapters arrive in Week 4.

### Design Goals & Constraints

*   **Event-Only Output**: The harness communicates exclusively through
    `EventBusContract.publish()`. It never calls engine methods directly
    (Constitution Section 2).
*   **Constitution-Compliant Events**: All events are minted through the
    `createDomainEvent` factory using branded types (`SessionId`, `EventId`,
    `Timestamp`) from `core/types/session.types`.
*   **Privacy-First**: Raw prompt text is never persisted. Simulated prompts are
    hashed before emission using `cyrb53` (ADR-019).
*   **Hardware-Ready**: The harness emits `hardware.signal.received` events in
    the exact payload shape that future Arc BLE hardware will use, validating the
    hardware-ready seam without physical devices.
*   **Deterministic & Testable**: Accepts injectable `Clock` and `EventIdFactory`
    overrides so self-tests can assert exact event envelopes.
*   **No Business Logic**: The harness simulates *inputs* only. It does not
    perform gap detection, state inference, enrichment, or insight generation.

---

## 2. Problem Statement

The `src/mock/harness/` directory was created in the repository structure but
contains zero implementation files. The sprint plan explicitly requires "the mock
harness runs" as a Week 1 deliverable, and Week 2 depends on "a live mock-harness
demo of words-per-minute tracking, pause detection and state inference."

Without the harness, engine developers must either:
- use ad-hoc inline mocks (currently scattered across self-tests), or
- test against live AI platform UIs (non-deterministic, fragile).

---

## 3. Current Repository State

- `src/mock/harness/` — empty directory scaffold.
- `src/core/event-bus/` — fully implemented EventBus, contracts, registry,
  factory, types.
- Ad-hoc mocks exist inside `v2.selftest.ts` (`MockDatabase`),
  `ReasoningPipeline.selftest.ts` (`MockStrategy`), and
  `hardening.selftest.ts` (`mockSelectors`).

---

## 4. Engineering Constitution Requirements

| Section | Rule | Harness Obligation |
| --- | --- | --- |
| §2 Event-Driven | Modules communicate only through Domain Events | Publish events only through `EventBusContract` |
| §2 Event Sourced | Events are immutable facts | Use `createDomainEvent` for every envelope |
| §2 Local-First | No cloud dependency | Zero network calls |
| §2 Privacy-First | No raw prompt storage | Hash all simulated prompt text |
| §3 Layer 6 | Presentation/Mock consumes projections, does not bypass engines | Never import or call engine classes |
| §5 Type Safety | Branded types mandatory | All identifiers use `SessionId`, `EventId`, `Timestamp` |
| §9 Arc Readiness | Hardware seam must be testable | Emit standard hardware event payloads |

---

## 5. Architecture Overview

```
MockHarness (orchestrator)
├── SyntheticEventGenerator (event factory helper)
├── StreamSimulator (async response chunk producer)
├── types.ts (configuration & scenario DTOs)
└── index.ts (public barrel export)
```

The harness sits at the boundary of the system. It emits events onto the
`EventBus` and the rest of the architecture (engines, storage, projections)
processes them exactly as it would process live events. No special wiring or
alternative code paths exist for simulated input.

---

## 6. Repository Files

### Files To Create

| File | Responsibility |
| --- | --- |
| `src/mock/harness/types.ts` | Configuration interfaces, scenario DTOs, simulation types |
| `src/mock/harness/SyntheticEventGenerator.ts` | Wraps `createDomainEvent` for every event type with convenient builder methods |
| `src/mock/harness/StreamSimulator.ts` | Async generator emitting `response.chunk` events at configurable intervals |
| `src/mock/harness/MockHarness.ts` | Top-level orchestrator with session lifecycle and simulation API |
| `src/mock/harness/index.ts` | Public barrel export |
| `src/mock/harness/MockHarness.selftest.ts` | Framework-free self-test following the `Checker` convention |

### Files To Modify

None. No existing files are modified by this implementation.

---

## 7. Runtime Flow

### Typing Simulation

```
MockHarness.simulateTyping(text, options)
  → SyntheticEventGenerator.promptTyped(...)
    → createDomainEvent('prompt.typed', ...)
  → eventBus.publish('prompt.typed', event)
  → [Subscribers execute synchronously]
  → [EventStoreSubscriber persists asynchronously]
```

### Response Streaming Simulation

```
MockHarness.simulateResponse(text, options)
  → StreamSimulator.stream(text, chunkSize, delayMs)
    → eventBus.publish('response.started', ...)
    → loop: eventBus.publish('response.chunk', ...)
    → eventBus.publish('response.completed', ...)
```

### Hardware Signal Simulation

```
MockHarness.simulateHardwareSignal(signalType, value)
  → SyntheticEventGenerator.hardwareSignalReceived(...)
    → createDomainEvent('hardware.signal.received', ...)
  → eventBus.publish('hardware.signal.received', event)
```

---

## 8. Dependency Graph

```
MockHarness
  └── SyntheticEventGenerator
        └── createDomainEvent (core/event-bus)
              ├── EventType (core/event-bus/registry)
              ├── CognisEventMap (core/event-bus/contracts)
              └── SessionId, EventId, Timestamp (core/types/session.types)
  └── StreamSimulator
        └── SyntheticEventGenerator
  └── EventBusContract (core/event-bus/types)
```

No dependency on engines, storage, platforms, or sidepanel.

---

## 9. Implementation Strategy

1. Build types and interfaces first (zero runtime code).
2. Build the `SyntheticEventGenerator` (pure factory helper).
3. Build `StreamSimulator` (async stream producer).
4. Build `MockHarness` (orchestrator composing the above).
5. Build self-test validating the complete flow.

---

## 10. Implementation Tasks

| Task | Complexity | Files |
| --- | --- | --- |
| 1. Types & Interfaces | Low | `types.ts` |
| 2. SyntheticEventGenerator | Low | `SyntheticEventGenerator.ts` |
| 3. StreamSimulator | Medium | `StreamSimulator.ts` |
| 4. MockHarness Orchestrator | Medium | `MockHarness.ts`, `index.ts` |
| 5. Self-Test | Medium | `MockHarness.selftest.ts` |

---

## 11. Testing Strategy

Framework-free self-tests following the `Checker` pattern established in
`v2.selftest.ts`. The self-test will:

1. Instantiate a harness with a deterministic clock and event ID factory.
2. Collect all published events from a mock EventBus.
3. Assert event structure, type, branded identifiers, and payload shapes.
4. Assert streaming chunks have monotonically increasing `totalLength`.
5. Assert session lifecycle ordering (started → typed → paused → ended).
6. Assert hardware event payloads match the Arc-stable contract.

---

## 12. Risks

- **Timer Precision**: `StreamSimulator` uses `setTimeout`/`Promise` delays.
  In service worker contexts, timers may be throttled. Mitigation: accept an
  injectable delay function.
- **Event Flooding**: Unrestricted high-frequency emission could overwhelm slow
  subscribers. Mitigation: configurable inter-event delay with sensible defaults.

---

## 13. Future Extensions

- **JSON Scenario Playback**: Load pre-defined interaction scripts from static
  JSON scenario files.
- **Event Replay**: Replay historical sessions from `EventRepository` onto the
  `EventBus` at configurable speed multipliers.
- **MockPlatformAdapter**: In-memory `PlatformAdapter` implementation for
  integration with `PlatformManager`.
- **Brain Map Scenario Support**: Feed specific gap/state sequences to validate
  brain map rendering.

---

## 14. Expected Deliverables

- [x] `src/mock/harness/types.ts`
- [x] `src/mock/harness/SyntheticEventGenerator.ts`
- [x] `src/mock/harness/StreamSimulator.ts`
- [x] `src/mock/harness/MockHarness.ts`
- [x] `src/mock/harness/index.ts`
- [x] `src/mock/harness/MockHarness.selftest.ts`
- [x] `docs/implementation-plans/week1-mock-harness-implementation-plan.md`
- [x] `docs/implementation-overviews/week1-mock-harness-overview.md`
