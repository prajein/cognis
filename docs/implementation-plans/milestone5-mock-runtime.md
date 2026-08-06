# Milestone 5: Mock Runtime Implementation Plan

## The Core Objective
The objective of this milestone is **not** simply to build a demo. The objective is to **build a second runtime that proves Cognis' architecture is runtime-agnostic.**

After Milestone 5, the following invariant must hold true:
**No Engine, Projection, Gateway, or React component knows whether it is running in a mock environment or a live environment.**

The mock environment serves as a rigorous proving ground, establishing that the EventBus and our Domain Events are the absolute borders of the system.

## The Invariant

```text
No
- Engine
- Projection
- Gateway
- React Component

knows
- mock / live
```

This invariant protects the architecture from accumulating fragile conditionally-branched logic (e.g. `if (mock) { ... }`). 

## Implementation Strategy

### 1. Harness Event Wrapper
To simulate the `ExtensionEventBridge` which injects `isAuthoritative: true` and `origin: 'remote'` into events coming from the background, we will wrap the EventBus that is provided to the `MockHarness`.

When the `MockHarness` fires an event, it hits this wrapper, which transparently injects the metadata required for the UI to accept the event as authoritative state. 

### 2. Mock Gateways
The UI (Surface B) communicates with IndexedDB via Gateways.
In the mock runtime, we will instantiate:
- `LocalSessionGateway`
- `LocalInsightGateway`
Both of these will communicate directly with the local IndexedDB, completely bypassing the Chrome runtime messaging layer, thereby proving that the Gateway interfaces cleanly abstract storage access.

### 3. Scenario Playback & UI Sync
We will introduce a `ScenarioPlayer` capable of interpreting scripts (`demoScenario.ts`) to stream simulated prompts, responses, and cognitive pauses into the `MockHarness`.

To ensure the UI seamlessly reacts to background-driven actions (like a script starting a session or emitting an insight):
- `SurfaceB.tsx` will decouple from its local `selectedTaskId` state and dynamically sync with the active session's `taskId` retrieved via `useSession()`.
- `useInsights.ts` will subscribe directly to `InsightEvents.GENERATED` on the EventBus for real-time React state updates instead of relying on fragile UI timeouts.
