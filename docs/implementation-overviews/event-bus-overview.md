# Cognis Event Bus: Architecture & Implementation Overview

The Event Bus system is the central nervous system of Cognis, orchestrating decoupled communication between modules. Following the Cognis Engineering Constitution, it ensures modules communicate exclusively through Domain Events.

This document serves as the canonical reference for the EventBus architecture, defining boundaries, guarantees, and Architectural Decision Records (ADRs) that guide its evolution.

---

## 1. Architectural Boundaries

The event routing topology is explicitly divided into two independent systems. This separation ensures that the core routing mechanism remains completely unaware of the browser extension runtime environment.

### Process-Local EventBus (`EventBus.ts`)
**Responsibility:** In-process event routing.
The `EventBus` is a synchronous, pure-domain event broker. It handles publishers and subscribers strictly within a single JavaScript engine runtime context. It possesses zero knowledge of Chrome, IPC, or external processes.

### ExtensionEventBridge (`ExtensionEventBridge.ts`)
**Responsibility:** Cross-context transport.
The `ExtensionEventBridge` acts as an adapter. It monitors local `EventBus` traffic and propagates events across isolated browser extension boundaries (Content Script $\leftrightarrow$ Background Worker $\leftrightarrow$ Side Panel/Popup). 

### Future Arc Hardware Integration
Because the `EventBus` and `ExtensionEventBridge` are architecturally decoupled, future Arc physical hardware integration (e.g., via Web Bluetooth in the background worker) will interface *directly* with the Background Worker's `EventBus`. The hardware adapter simply publishes events (like `hardware.signal.received`); it requires zero dependency on or modification to the `ExtensionEventBridge`.

---

## 2. In-Process EventBus: Execution Guarantees

The local [EventBus](file:///Users/ntbnaren7/Dev/cognis/src/core/event-bus/EventBus.ts) enforces strict operational contracts to ensure system stability.

### Threading Model & Concurrency
* **Single-Threaded & Synchronous:** All local events are dispatched synchronously on the main JavaScript thread. There is no asynchronous queueing (`setTimeout` or `Promise.resolve`) within the `publish` loop. This guarantees execution latency under **1ms**.
* **Re-entrant:** The bus supports nested publishes. If Subscriber A receives an event and subsequently publishes a new event during its execution, the new event is dispatched immediately, pausing the current dispatch iteration until the nested dispatch completes.

### Event Ordering Guarantees
* **Execution in Registration Order:** Subscribers are invoked strictly in the order they were registered. The internal storage uses a JavaScript `Set`, which guarantees iteration in insertion order. This provides deterministic execution, which is critical for state reconstruction.

### Subscriber Error Isolation
To ensure a failing subscriber does not disrupt other listeners or crash the publishing module, callback invocations are wrapped in an isolated boundary:
* If a handler throws, the error is caught and delegated to an injected `ErrorReporter` interface.
* The dispatch loop then continues to the next subscriber. A broken module (e.g., GhostTextEngine) cannot bring down the State Engine or Storage layers.

### Memory Management
Subscribers register with a unique callback handler. When a subscription is cancelled, the handler is removed. To prevent garbage collection leaks over long-lived sessions, if a type's handler `Set` becomes empty, the entire key is pruned from the internal map.

---

## 3. Cross-Context Event Bridge: Transport Guarantees

The [ExtensionEventBridge](file:///Users/ntbnaren7/Dev/cognis/src/core/event-bus/ExtensionEventBridge.ts) manages the IPC boundaries.

### IPC Topology
| Source Context | Destination Context | Transport Channel | API Mechanics |
| :--- | :--- | :--- | :--- |
| **Content Script** | Background Worker | Short-lived message | `chrome.runtime.sendMessage` |
| **Side Panel** | Background Worker | Long-lived port | `chrome.runtime.connect` (Port: `'cognis-event-bridge'`) |
| **Background Worker** | Side Panel | Long-lived port | Broadcast to registered ports in `connectedPorts` Set |
| **Background Worker** | Content Scripts | Short-lived query | `chrome.tabs.query` and `chrome.tabs.sendMessage` |

### Loop Prevention & Echo Mitigation
Bridging events bidirectionally risks infinite echo loops (Context A sends to B, B broadcasts back to A). 
1. **Origin Context Verification**: Events are wrapped in a `BridgeEnvelope`. If a bridge instance receives an envelope with an `originContext` matching its own context, the event is immediately discarded.
2. **Event ID Lineage Caching**: The bridge maintains a cache of recently processed `EventId`s. Events matching a cached ID are ignored, preventing duplication across complex topologies.

---

## 4. Architectural Decision Records (ADRs)

The following architectural decisions govern the current implementation and future evolution of the EventBus system.

### ADR 1: Removal of Fixed Dispatch Depth Guard
**Context:** Initial designs proposed a hard limit of `MAX_DISPATCH_DEPTH = 10` to prevent infinite recursion loops caused by circular event dependencies.
**Decision:** Remove the fixed depth limit.
**Rationale:** In a complex cognitive architecture, legitimate event chains (e.g., Perception $\rightarrow$ State Engine $\rightarrow$ Gap Engine $\rightarrow$ Ghost Text $\rightarrow$ Enrichment $\rightarrow$ Insights $\rightarrow$ Storage $\rightarrow$ Telemetry $\rightarrow$ UI) can easily exceed a depth of 10. Depth does not equal a loop. For v0.1, operating without loop detection is safer than dropping valid execution chains due to an arbitrary depth constraint.
**Future Evolution:** If runaway event cascades become a production issue, loop detection will be implemented via Event ID lineage and cycle detection, rather than flat stack depth limitations.

### ADR 2: Delegation of Logging Responsibility
**Context:** Initial designs used `console.error()` directly inside the `EventBus` to handle subscriber failures.
**Decision:** The EventBus must remain transport-only and completely agnostic to the environment's logging capabilities.
**Rationale:** Logging strategies differ heavily across Content Scripts, Service Workers, and isolated UI panels. Hardcoding console usage tightly couples the routing layer to a specific runtime's output stream.
**Implementation Expectation:** The `EventBus` will accept an abstracted `ErrorReporter` interface via constructor injection. This defers logging/telemetry responsibilities to the composition root of the respective context.

### ADR 3: Bridge Cache Eviction Strategy
**Context:** To prevent echo loops, the ExtensionEventBridge caches recently seen Event IDs up to `MAX_TRACKED_IDS` (1000). The original proposal suggested clearing the entire cache when the limit was reached.
**Decision:** Implement a FIFO (First-In, First-Out) queue or LRU (Least Recently Used) cache for ID eviction. 
**Rationale:** A complete cache reset introduces a critical vulnerability window. If the cache clears at event 1001, and an echo of event 995 is still propagating over IPC, the bridge will incorrectly accept the echoed event. FIFO ensures continuous, rolling protection.
**Implementation Expectation:** Refactor `recentlyBridgedIds` from a raw `Set` to a capped FIFO queue structure.

### ADR 4: Subscription Ordering Guarantees
**Context:** Event systems can either guarantee sequential execution based on registration order, or treat execution order as undefined.
**Decision:** Subscribers are guaranteed to execute in Registration Order.
**Rationale:** Determinism. If the Storage Layer subscribes before the UI Layer, the Storage Layer is guaranteed to process the event first. Because the internal `handlers` structure utilizes standard JavaScript `Set` objects—which natively preserve insertion order—this guarantee is both performant and structurally intrinsic.
**Consequences:** Subscribers must not assume they are the *only* listener acting on an event, but they can rely on temporal consistency if registration order is tightly controlled at application bootstrap.

---

## 5. Reference Implementation Files

* **Event Bus Class**: [EventBus.ts](file:///Users/ntbnaren7/Dev/cognis/src/core/event-bus/EventBus.ts)
* **IPC Bridge Class**: [ExtensionEventBridge.ts](file:///Users/ntbnaren7/Dev/cognis/src/core/event-bus/ExtensionEventBridge.ts)
* **Event Bus Contracts**: [types.ts](file:///Users/ntbnaren7/Dev/cognis/src/core/event-bus/types.ts)
