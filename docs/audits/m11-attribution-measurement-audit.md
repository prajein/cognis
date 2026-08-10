# M11 Attribution & Measurement: Architectural Audit (Revised)

**Date:** 2026-08-10
**Target:** M11 Implementation Planning

---

## 1. Executive Summary
This audit investigates the current capability of the Cognis repository to correlate ghost text rejections with actual user behavior and environmental context. M11 focuses strictly on *measuring* behavioral signatures around dismissals without attributing causal intent or altering adaptation state.

---

## 2. Telemetry Inventory & Assessment

### A. Intervention-to-User-Text Correlation
* **Current State (FACT):** 
  - `GhostTextObserver` emits `ghosttext.dismissed` instantaneously.
  - `TypingObserver` specifically strips raw text, hashing it before emitting `prompt.typed`.
* **Finding (INFERENCE):** 
  - The background domain never receives the raw text. To compute distance metrics securely, we must introduce a `GhostTextMeasurementObserver` in the perception layer that maintains a temporary Observation Window.
* **Observation Window Lifecycle (POLICY DECISION):** 
  - Open on `ghosttext.dismissed`.
  - Capture first keystroke to compute `continuationLatencyMs`.
  - Close on the *first* of: 2-second idle timeout, 5-second hard maximum, `prompt.sent`, `blur` (lost focus), a new intervention, or DOM node removal.
  - Compute in-memory, emit event, discard text.

### B. Raw Measurable Features
* **continuation latency:** Requires instrumentation (timestamp delta from window start to first input event).
* **lexical overlap:** Requires instrumentation (computed in-memory).
* **edit distance:** Requires instrumentation (computed in-memory).
* **typed-text length:** Requires instrumentation (length of string accumulated in memory during window).
* **stem length:** Available in `ghosttext.dismissed`.

### C. Context Telemetry
* **Current State (FACT):** No environmental context is captured in prompt/ghosttext events.
* **Finding (INFERENCE):** `window.location.origin` and `inputNode.tagName` are trivially accessible in the content script.
* **Privacy Boundary (POLICY DECISION):** To avoid PII leakage, only `window.location.origin` (or masked routes) will be permitted. No full query parameters will be collected.

### D. Event Architecture & Schema Separation
* **Current State (FACT):** `ghosttext.dismissed` has a `reason` field (`continued_typing`, `caret_moved`, etc.).
* **Finding (INFERENCE):** The measurement window's completion is conceptually distinct from the intervention's dismissal. Overloading `dismissalReason` will ruin telemetry analysis.
* **Recommendation:** The new `ghosttext.measurement.computed` event must distinctly capture *both*:
  1. `dismissalReason`: Why the intervention ended (`continued_typing`, etc.).
  2. `measurementCompletionReason`: Why the observation window closed (`idle_timeout`, `hard_timeout`, `prompt_sent`, etc.).

### E. Persistence: A Challenge to Durable Storage
* **Initial Proposal:** Store measurements locally in a new `v5` IndexedDB store (`intervention_measurements`).
* **Re-evaluation (INFERENCE):** Storing granular, per-intervention distance metrics locally creates unbound storage bloat. More importantly, M11 introduces no local consumer for this data. (M12/M13/M14 will consume aggregate policies, not raw granular logs).
* **Finding (POLICY DECISION):** M11 does **not** need a local durable database store. The `ghosttext.measurement.computed` event should simply be emitted onto the `EventBus`. The system's existing telemetry/analytics egress layer (if any) will log it. We will explicitly defer local persistence of these measurements unless a concrete local consumer is defined.

---

## 3. Required Architectural Changes (Minimum Viable)

1. **Measurement Observer Window:** A new `GhostTextMeasurementObserver` in the perception layer that implements the strictly bounded lifecycle (2s idle / 5s max cap).
2. **New Domain Event:** `ghosttext.measurement.computed` containing raw features, completeness confidence, and decoupled completion/dismissal reasons.
3. **No Adaptation Changes:** The `GhostTextAdaptor` (M8-M10) will completely ignore the new measurement event.
4. **No Local Persistence:** We will NOT create a new IndexedDB store. Measurements are ephemeral to the EventBus.

## 4. Verdict

**READY FOR IMPLEMENTATION**
The architectural dependencies, lifecycle bounds, and schema separations are fully mapped.
