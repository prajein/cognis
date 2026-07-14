# Architecture & Implementation Plan: Runtime Perception Layer

**Document Type:** Staff/Principal Engineer Architecture RFC
**Focus:** Browser Runtime Event Generation, Platform Observability, & DOM Resilience
**Status:** Approved for Implementation (Frozen)

---

## Executive Summary

This RFC details the implementation of the **Runtime Perception Layer** for Cognis. Currently, the intelligence engines (Insight, State, Response) operate on robust CQRS foundations but lack a live, continuous stream of real user events. This milestone bridges that gap by directly observing the browser DOM and user interactions, and translating them into a strict canonical lifecycle of domain events.

The perception layer acts exclusively as a boundary translator. It contains **zero business logic**, **zero enrichment**, and **zero storage logic**. Its sole responsibility is to observe the chaos of the DOM and emit clean, deterministic, ordered domain events onto the EventBus.

---

## 1. Ownership Boundaries

To guarantee testability and isolate breakages when target web UIs (e.g., ChatGPT) update their DOM, we enforce a strict separation of concerns.

### 1.1 The Adapter as a Composition Root
The Platform Adapters (`ChatGPTAdapter`, `ClaudeAdapter`) do not own DOM parsing or streaming state logic. They serve strictly as composition roots that instantiate dedicated observers:
- `ResponseObserver` (Monitors DOM for AI outputs)
- `TypingObserver` (Monitors DOM for user inputs)

### 1.2 Two-Stage Translation & Stateless Translators
To protect downstream systems, DOM observation is separated from Event translation using an intermediate raw snapshot:
```
[MutationObserver] ──► [Raw DOM Snapshot] ──► [Translator] ──► [Domain Event] ──► [EventBus]
```
**Stateless Translators:** The Translator (`translate(snapshot) -> DomainEvent[]`) must be a purely stateless function. It must not cache DOM nodes, hold timers, or keep track of previous chunks. All state management (e.g., tracking the previous chunk length) belongs strictly inside the Observers. 

### 1.3 Explicit Failure Policy & Observer Lifecycle
The perception layer must be indestructible. If a selector is missing, a response container disappears, or an observer disconnects, the system MUST:
- Publish nothing (fail silently at the event boundary).
- Never fabricate or guess events.
- Log a structured diagnostic warning.
- Remain alive and attached without crashing the extension.

**Explicit Observer Lifecycle:**
```
Created ──► Discover DOM ──► Attach ──► Observe ──► Lost Target ──► Destroy ──► Retry Discovery ──► Reattach
```
Observers are **replaceable, not recoverable**. If an observer loses its target (e.g., due to React SPA navigation), it must be destroyed and a brand new observer created. 

### 1.4 Selector Versioning & Registry
Selectors will not be lumped into a single file. They will be versioned per platform to support future expansions (Gemini, Perplexity, Copilot):
```
src/platforms/
  ├── selectors/
  │   ├── interfaces.ts
  │   ├── registry.ts
  │   ├── chatgpt-v1.ts
  │   └── claude-v1.ts
```

---

## 2. Layered Runtime Architecture

The implementation enforces the following responsibility layers:

```mermaid
graph TD
    subgraph Layer 1: Platform Observation (Adapters & Observers)
        A[ChatGPTAdapter / ClaudeAdapter]
        A1[TypingObserver]
        A2[ResponseObserver]
    end
    
    subgraph Layer 1.5: Event Translation
        B[DOM Snapshot]
        B1[Event Translator (Pure)]
    end

    subgraph Layer 2: Interaction Perception
        C[InteractionTracker]
    end
    
    subgraph Layer 3: Cognitive State
        D[StateEvaluator]
        E[TransitionPolicy]
        F[StateEngine]
    end
    
    subgraph Layer 4: Response Intelligence
        G[ReconstructorBuffer]
        H[AnalysisPipeline]
        I[Analyzers]
    end
    
    subgraph Layer 5: Distribution & Sinks
        J[EventBus]
        K[(Storage)]
        L[GhostText]
        M[Insight Engine]
    end

    Layer1 -- "Raw Mutants" --> Layer1.5
    Layer1.5 -- "Domain Events" --> Layer5
    Layer5 -- "Dispatches to" --> Layer2
    Layer5 -- "Dispatches to" --> Layer3
    Layer5 -- "Dispatches to" --> Layer4
```

---

## 3. Canonical Runtime Event Lifecycle

The following strict sequence represents the **only valid event lifecycle**. Every engineer must implement against this deterministic contract:

1. `session.started` *(Exactly once when a session begins)*
2. `prompt.typed` *(Fired repeatedly while the user is typing, zero or more times)*
3. `pause.detected` *(Fired optionally after configured idle thresholds)*
4. `prompt.sent` *(Exactly once per submitted prompt)*
5. `response.started` *(Fired when the first AI response token appears)*
6. `response.chunk` *(Fired continuously during streaming. **ALWAYS emits DELTAS**, never accumulated strings, to minimize memory and IPC overhead. Reconstructed downstream by `ReconstructorBuffer`.)*
7. `response.completed` *(Exactly once when streaming ends)*
8. `response.analysis.completed` *(Fired after the analysis pipeline processes the complete response)*
9. `state.changed` *(Zero or more times, only when TransitionPolicy approves a state shift)*
10. `insight.generated` *(Background async event)*
11. `session.ended` *(Exactly once upon tab closure, navigation, or timeout)*

**Event Idempotency Guarantee:** Observers must suppress duplicate deltas generated by DOM re-renders while preserving the canonical event order.

---

## 4. Module-by-Module Implementation Plan

### 4.1 Module A: Response Streaming Integration
**Owner:** `ResponseObserver` & `Translator`
**Objective:** Observe DOM mutations to capture AI responses in real-time.
- **Tasks:**
  - Implement versioned `chatgpt-v1.ts` selector mappings.
  - Implement a replaceable `MutationObserver` yielding raw DOM snapshots.
  - Translate snapshots into `response.started`, `response.chunk` (deltas only), and `response.completed` via purely stateless functions.

### 4.2 Module B: Typing Cadence & Pause Detection
**Owner:** `TypingObserver` & `Translator`
**Objective:** Capture typing intervals to generate interaction signals.
- **Tasks:**
  - Bind keystroke/input listeners to the target textarea.
  - Calculate inter-keystroke intervals for `prompt.typed`.
  - Implement deterministic debounce logic for `pause.detected`.

### 4.3 Module C: Session Lifecycle
**Owner:** `PlatformManager`
**Objective:** Bound the timeline of interactions.
- **Tasks:**
  - Bind to `focus`, `blur`, and `visibilitychange` events to orchestrate `session.started` and `session.ended`.

---

## 5. Performance & Memory Budgets

Because the Perception Layer operates directly on the browser's main UI thread, its budgets are strict to guarantee zero perceptible lag or memory bloat. Memory leaks are the primary threat to long-running browser extensions.

| Component / Subsystem | CPU Latency Budget | Memory Budget / Constraints |
|-----------------------|--------------------|-----------------------------|
| `prompt.typed`        | **< 1 ms**         | N/A                         |
| `pause.detected`      | **< 1 ms**         | < 10 active timers          |
| `MutationObserver`    | **< 5 ms**         | Bounded mutation queue      |
| `ResponseObserver`    | N/A                | **< 500 KB** total footprint|
| Mutation Cache        | N/A                | **< 100 KB**                |
| Active DOM References | N/A                | **O(1)** (No dangling nodes)|
| `EventBus` Fan-out    | **< 5 ms**         | N/A                         |

---

## 6. Verification Strategy & Testing Plan

### 6.1 Resilience Testing
- **DOM Mocks (`JSDOM`)**: Verify that simulated mutations correctly trigger streaming events using exclusively delta payloads.
- **SPA Resilience**: Test that Single Page Application (SPA) navigations, page re-renders, and conversation switches do not detach observers permanently or result in duplicated event bindings.

### 6.2 Manual DevTools Verification
This milestone prioritizes observable behavior. Verification will be performed live in the browser extension runtime console.

---

## 7. Definition of Done (DoD)

This RFC is considered fulfilled only when every event in the canonical lifecycle can be manually verified and observed independently in the Chrome DevTools console:

- [ ] `session.started` fires exactly once upon injection.
- [ ] `prompt.typed` streams continuously as the user types in the input box.
- [ ] `pause.detected` fires successfully when the user stops typing for the threshold duration.
- [ ] `prompt.sent` fires when the user hits Enter or clicks Submit.
- [ ] `response.started` fires the millisecond the AI begins answering.
- [ ] `response.chunk` streams in alignment with UI text generation (yielding deltas).
- [ ] `response.completed` fires precisely when the AI stops generating text.
- [ ] Hardcoded DOM selectors are abstracted into a versioned configuration layer (`chatgpt-v1.ts`).
- [ ] Zero logic for state, memory, or enrichment exists within the adapter files.
- [ ] Translators are strictly stateless.
- [ ] Duplicate deltas from DOM re-renders are suppressed.
- [ ] **Runtime Perception Layer remains fully functional and leak-free after SPA navigation, page refreshes, conversation switching, and regenerated responses.**
