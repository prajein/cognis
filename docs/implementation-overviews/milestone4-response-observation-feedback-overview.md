# Milestone 4: Implementation Overview

## Architecture Realized

Milestone 4 closes the visual feedback loop of Cognis without compromising its Event Sourced boundaries.

```
DOM (ChatGPT) 
   ↓
ResponseObserver (Perception Layer)
   ↓ (response.started / chunk / completed)
EventBus (Background Host)
   ↓
ResponseIntelligenceEngine ──[asynchronously runs AnalysisPipeline]──→ (response.analysis_completed)
   ↓
ProjectionManager ──[projects to InsightReadModel in IndexedDB]──→ DB
   ↓
InsightGateway ──[queried by React hooks]──→ useInsights ──→ UI (InsightCard)
```

Instead of allowing React to listen directly to the `EventBus` (which would couple components to event timelines), the UI queries read-model updates through `InsightGateway`. 

## Robust Streaming Completion (The Debounce Fix)

LLM streaming over the DOM is notoriously volatile. In early tests, we faced an infinite event loop issue where the perception layer (`ResponseObserver`) fired `started` -> `chunk` -> `completed` rapidly on every single DOM mutation. This occurred because ChatGPT's streaming UI indicator was not matching selectors during trailing rendering steps, tricking the observer into assuming completion.

We implemented a robust **1000ms debounce** on completion detection. When streaming activity appears to halt, the observer enters a cooldown phase. If any trailing text modifications or mutations occur within that 1000ms window, the cooldown is canceled, and streaming resumes. This decoupled completion tracking from unreliable, volatile DOM class matches.

## Solving React/Engine Database Race Conditions

A core race condition arose because the background `ReasoningPipeline` and projection database writes happen asynchronously. When the response completed:
1. `isStreaming` flipped to `false` in the React context.
2. The UI immediately queried `InsightGateway.getSessionInsights()`.
3. The background engine was still processing the raw metrics, meaning the read-model query returned empty array results.

We solved this in the Presentation layer by introducing a deliberate **300ms race-condition buffer** inside the `useInsights` hook. When `isStreaming` resolves to false, it triggers a debounced query, allowing background engine loops to complete writes before the UI reads from IndexedDB.

## UI Visualization Enhancements

The Brain Map component in Surface B was redesigned to display region activation levels as progress bars (`value / 5 * 100%`) with micro-animations. It pulses actively when the `ResponseLifecycleTracker` reports active streaming, and settles down cleanly when the completion debounce finishes.
