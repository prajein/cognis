# Milestone 11: Attribution & Measurement Overview

## Objective
M11 aimed to implement a scientifically sound measurement layer for Ghost Text interventions. Prior to M11, Cognis adapted to user dismissals by assuming a dismissal indicated rejection. M11 introduces the instrumentation required to measure the *behavioral signature* of a dismissal, providing the quantitative evidence needed to eventually distinguish between "intervention aversion" and "poor suggestion quality" in future milestones.

**Critical Constraint:** M11 measures. It does not adapt. 

## Architectural Changes

### 1. `ghosttext.measurement.computed` Event
Added a new telemetry event to the `EventBus` (`GhostTextEvents.MEASUREMENT_COMPUTED`). This event decouples the structural reason an intervention ended (`dismissalReason`) from the reason the measurement window ended (`measurementCompletionReason`), carrying the calculated behavioral features.

### 2. `GhostTextMeasurementObserver`
Introduced a new observer in the perception layer, completely decoupled from the `GhostTextAdaptor` and adaptation policies.
- **Baseline Capture**: Captures the exact input value at the moment of dismissal.
- **Delta Extraction**: Uses an LCP/LCS (Longest Common Prefix/Suffix) algorithm to isolate the specific text delta typed *after* the dismissal.
- **Deterministic Normalization**: Standardizes both the `stem` and the `delta` by lowercasing, stripping punctuation, and collapsing whitespace to prevent stylistic noise from inflating distance metrics.
- **Semantic Distances**: Computes `lexicalOverlap` (Jaccard similarity) and `editDistance` strictly between the stem and the newly typed continuation, not the entire document.

### 3. Rigorous Lifecycle Bounds
The observer strictly bounds its telemetry window:
- **2-second idle timeout** after the last keystroke.
- **5-second hard cap** from the moment of dismissal.
- **Explicit Terminations**: `prompt.sent`, `focus_lost`, `node_removed`, and `intervention_replaced`.
- **Double-termination Guarantees**: A synchronous teardown sequence guarantees that only one measurement is ever computed per intervention, even if a user sends the prompt precisely at the timeout boundary.

## Privacy & Security
- **Ephemeral Raw Text**: Raw baseline and continuation text are processed entirely in memory, resolved to numeric features, and explicitly nullified. They are never published to the EventBus or written to IndexedDB.
- **URL Sanitization**: Context tracking is constrained to `window.location.origin`, explicitly omitting pathnames or query strings.
- **Local Only**: All metrics are transient and local.

## Impact
M11 brings Cognis to the required level of scientific rigor for attribution. By properly isolating the text delta and capturing meaningful latency/overlap features, M12 will now be able to reliably ingest this telemetry to make context-aware adaptation decisions.
