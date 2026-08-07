# Milestone 5: Mock Runtime & UI Synchronization

**Status:** Completed
**Goal:** Prove Cognis' architecture is runtime-agnostic by building a `MockHarness` that powers Surface B identically to the live extension background.

## Objective
To prove that our Event-Driven architecture strictly obeys the invariant: **No Engine, Projection, Gateway, or React component knows whether it is running in a mock or live environment.** The mock environment serves as a pristine, deterministic proving ground for Surface B's UI and data lifecycle without needing a live AI, DOM bindings, or physical hardware.

## Key Changes
1. **Mock Harness Integration:**
   - Introduced `MockHarness` and `SyntheticEventGenerator` into the frontend build.
   - Wired the Mock Harness into a local `EventBus` in `bootstrapMockRuntime`.
   - Created `LocalSessionGateway` and `LocalInsightGateway` that interact strictly with a local IndexedDB repository.

2. **Scenario Player & Demo:**
   - Created `ScenarioPlayer` to programmatically execute predefined test scripts.
   - Built `demoScenario.ts` with typed prompts, simulated pauses, streamed AI responses, and forced Insight triggers.

3. **Runtime Synchronization (React):**
   - Fixed `SurfaceB.tsx` to reactively use the `taskId` from the currently active session (driven by EventBus) instead of solely relying on local button clicks.
   - Refactored `useInsights.ts` to actively subscribe to the `InsightEvents.GENERATED` domain event for real-time reactivity, eliminating hardcoded fetch timeouts.
   - Ensured all simulated events inject `isAuthoritative: true` and `origin: 'remote'`, mimicking the behavior of the `ExtensionEventBridge`.

## Architectural Validation
This milestone successfully proved the core constraint: **The UI (Surface B) and engines react to `MockHarness` events exactly as they do to background script events.** The UI naturally pulsed the Brain Map and surfaced Cognitive Insights strictly by observing the standard event streams and IndexedDB read models.
