# Week 3: Insight Engine Overview

## 1. Introduction

The **Insight Engine** is the apex reasoning layer of the Cognis platform. It operates completely out-of-band in the background service worker, isolating heavy inferential compute from the user's critical path. 

Unlike the Gap Detection or Enrichment engines, which react to real-time events, the Insight Engine operates on longitudinal data. It consumes histories of `prompt.*`, `gap.*`, and `response.analysis.completed` events, evaluates them against behavioral strategies, and emits high-level `insight.generated` events that form the user's permanent cognitive identity.

## 2. Architectural Highlights

### 8-Stage Reasoning Pipeline
The core of the engine is the `ReasoningPipeline`, which executes synchronously when triggered:
1. **Context Builder**: Pulls event histories from the Read Models.
2. **Evidence Collector**: Gathers specific marker timestamps (e.g., syntax errors, successful executions).
3. **Signal Weighting**: Applies recency bias (newer events hold more weight).
4. **Strategy Execution**: Runs modular heuristic strategies against the context.
5. **Confidence Calculation**: Computes a mathematical score (0.0 to 1.0) based on evidence volume, recency, and strategy baseline.
6. **Conflict Resolution**: Applies penalties if the new insight contradicts established identity (hysteresis).
7. **Validator**: Gates insights, ensuring they meet a strict minimum confidence (0.75) and evidence count (5) before publishing.
8. **Publisher**: Emits the validated `insight.generated` event to the EventBus.

### Taxonomy Domain Strictness
Insights are strictly categorized using the `TaxonomyDomain` type:
- `Behavioral`, `Learning`, `Automaticity`, `Gap`, `Prompting`, `Writing`, `Reasoning`, `Identity`.
This ensures that the generated insights are semantically actionable rather than free-form text.

### Modular Strategies
Insights are discovered through `InsightStrategy` implementations. 
- **V1AutomaticityEvaluator**: Evaluates skill phase transitions (e.g., Cognitive -> Associative -> Autonomous) based on success vs. error event densities over time.

### The Scheduler
To prevent continuous background churn, the `InsightScheduler` governs *when* the pipeline runs. It triggers evaluation runs only under specific conditions:
1. **Session Ended**: When the user closes the tab or becomes deeply idle (`session.ended`).
2. **Volume Threshold**: After a set number of prompts (e.g., 100) within a single session.

## 3. CQRS Boundary

The Insight Engine adheres to strict CQRS principles:
- **Input**: It queries Read Models (Projection DB) to build the reasoning context.
- **Processing**: Pure heuristics without side effects.
- **Output**: It publishes a new `insight.generated` Domain Event.
- **Storage**: The `IdentityProjectionBuilder` consumes the emitted insight event to update the final `identity-v1` read model, which is ultimately exposed to the presentation layer.
