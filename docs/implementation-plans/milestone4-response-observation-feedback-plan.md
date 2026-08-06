# Milestone 4: Response Observation & Cognitive Feedback Plan

**Module**: Surface B & Downstream Engines (`ResponseIntelligenceEngine`, `InsightEngine`)  
**Owner**: Naren (Architecture & Product Lead)  
**Status**: Approved & Executed  

---

## 1. Executive Summary

Milestone 4 closes the feedback loop in Cognis' core value proposition:
```
Observe Typing → Intercept Submit → Observe Response → Analyze Cognitive Outcome → Present Insight
```
This milestone ensures that as the AI model streams its response, Cognis observes response lifecycle state (`response.started`, `response.chunk`, `response.completed`), processes response metrics asynchronously in the background, updates projections, and dynamically updates Surface B (Brain Map pulsing during streaming, Insight Card rendering upon completion).

---

## 2. Architecture & Design Principles

1. **Decoupled Downstream Analysis**: The perception layer (`ResponseObserver`) only emits canonical `response.*` domain events. It does not perform evaluation or touch React components directly.
2. **Shared Downstream Contracts**: `ResponseAnalysis` is an explicit, shared contract between `ResponseIntelligenceEngine` and downstream consumers, avoiding engine internal leakage.
3. **No Direct EventBus in React**: React components access background state via the `InsightGateway` and `ResponseLifecycleTracker`, maintaining state-driven, event-sourced UI boundaries.
4. **Completion Debouncing**: To handle DOM variation across LLM web UIs without infinite loop traps, `ResponseObserver` implements a 1000ms debounce on completion detection.

---

## 3. Key Components & Changes

### 3.1 Downstream Contracts & Engines
- **[NEW] `src/core/types/response.types.ts`**: Defines standard `ResponseAnalysis` payload structure.
- **[MODIFY] `src/engines/response/ResponseIntelligenceEngine.ts`**: Subscribes to streaming events, reconstructs response text, runs `AnalysisPipeline`, and emits `response.analyzed` / `response.analysis_completed`.
- **[MODIFY] `src/engines/insights/InsightScheduler.ts`**: Listens to `response.completed` (in addition to volume thresholds) to trigger `ReasoningPipeline` for immediate feedback loops.
- **[MODIFY] `src/background/index.ts`**: Instantiates and boots `ResponseIntelligenceEngine` alongside `InsightEngine`.

### 3.2 Sidepanel / Runtime Wiring
- **[NEW] `src/sidepanel/runtime/InsightGateway.ts`**: Read-model query bridge connecting sidepanel to background IndexedDB projections.
- **[NEW] `src/sidepanel/runtime/ResponseLifecycleTracker.ts`**: EventBus subscriber for sidepanel runtime that manages `isStreaming` state safely outside React state updates.
- **[MODIFY] `src/sidepanel/runtime/RuntimeContext.tsx`**: Exposes `isStreaming` and `insightGateway` to Surface B hooks.

### 3.3 UI Components & Hooks
- **[MODIFY] `src/sidepanel/features/surface-b/hooks/useInsights.ts`**: Queries `InsightGateway` asynchronously after `isStreaming` flips to `false` (with a 300ms race-condition buffer).
- **[MODIFY] `src/sidepanel/features/surface-b/components/BrainMap.tsx`**: Accepts `isStreaming` prop and renders dynamic progress bars with a CSS keyframe pulse animation.
- **[NEW] `src/sidepanel/features/surface-b/components/InsightCard.tsx`**: Renders qualitative insights derived from `InsightReadModel`.

---

## 4. Verification Plan

- **Happy Path**: Start session → type prompt → submit → observe pulsing Brain Map during streaming → observe Insight Card appearing post-completion.
- **Resilience Test**: Verify completion debouncing handles trailing DOM mutations cleanly without infinite event loops.
