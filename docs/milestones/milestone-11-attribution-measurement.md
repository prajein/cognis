# Milestone 11: Attribution & Measurement

## Status
**Completed**

## Objective
Prior to M11, Cognis adapted to user dismissals by universally treating a Ghost Text dismissal as a rejection (intervention aversion). M11 introduces the instrumentation required to measure the *behavioral signature* of a dismissal, providing the quantitative evidence needed to distinguish between "intervention aversion" and "poor suggestion quality".

**Core Principle:** M11 measures. It does not adapt.

## Key Deliverables

1. **`GhostTextMeasurementObserver`**
   - An isolated observer in the perception layer that tracks text changes immediately following a Ghost Text dismissal.
   - Decoupled entirely from `GhostTextAdaptor` and M8/M9/M10 adaptation policies.

2. **LCP/LCS Delta Extraction**
   - Captures the exact input value at the moment of dismissal (`baselineText`).
   - At the end of the measurement window, extracts the precise text delta typed *after* the dismissal, isolating it from the rest of the existing prompt document.

3. **Deterministic Normalization & Semantic Distances**
   - Standardizes the Ghost Text stem and the typed delta (lowercasing, stripping punctuation, collapsing whitespace).
   - Computes `lexicalOverlap` (Jaccard similarity) and `editDistance` exclusively between the stem and the localized delta to produce mathematically sound features.

4. **Rigorous Lifecycle Management**
   - Measurement windows are bound by a 2-second idle timeout and a 5-second hard cap.
   - Synchronous teardowns handle `prompt.sent`, `focus_lost`, `node_removed`, and `intervention_replaced` to guarantee exactly one measurement per intervention.

5. **Privacy & Security**
   - **Ephemeral Raw Text:** All text is processed transiently in memory, resolved to numeric primitives, and explicitly nullified. Raw text is never published to the EventBus or stored.
   - **Context Sanitization:** URL context is restricted strictly to `window.location.origin`.

## Engineering Constraints
- The implementation strictly avoids inferring causality (e.g., classifying a suggestion as "bad_quality").
- It remains measurement-only, ensuring that we do not create a feedback loop where an unvalidated attribution heuristic changes the system that produces the data.

## Next Steps
With M11 providing scientifically valid, privacy-safe measurement features (`continuationLatencyMs`, `editDistance`, `lexicalOverlap`), **M12** can now ingest this telemetry to make context-aware adaptation decisions.
