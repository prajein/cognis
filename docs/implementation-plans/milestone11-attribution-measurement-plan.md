# Milestone 11: Attribution & Measurement Implementation Plan

**Goal:** Measure observable behavioral signatures surrounding ghost-text dismissals to capture raw evidence that may later help distinguish intervention aversion, poor suggestion quality, context mismatch, and task-state mismatch.

**Constraints:** M11 is a measurement-only milestone. It must not alter adaptation state, introduce causal labels (`bad_quality`, etc.), or rely on ML inference.

---

## 1. Architectural Changes

To securely measure distance metrics (lexical overlap, edit distance) between the proposed stem and the user's typed text without persisting raw user input, the measurement must occur entirely within the content script (Perception Layer). 

We will introduce a `GhostTextMeasurementObserver` that opens an ephemeral Observation Window immediately upon intervention dismissal.

### Lifecycle & State Machine
1. **Trigger**: `GhostTextObserver` emits `ghosttext.dismissed`.
2. **Window Opens**: `GhostTextMeasurementObserver` records the `interventionId`, `gapType`, rejected stem, original input node, and dismissal timestamp. It begins capturing subsequent local typing in memory.
3. **First Keystroke**: The observer records the exact `continuationLatencyMs`.
4. **Window Closes (The 2/5 Policy)**: The window closes deterministically on the *first* of the following conditions:
   - **`prompt.sent`** (Detected via EventBus or local DOM submit listeners)
   - **`focus_lost`** (Input node `blur` event)
   - **`intervention_replaced`** (A new `ghosttext.generated` event fires)
   - **`idle_timeout`** (2 seconds of typing inactivity)
   - **`hard_timeout`** (5 seconds maximum elapsed time from window start)
   - **`node_removed`** (The input node is unmounted/disconnected from DOM)
5. **Compute**: The observer computes raw features (e.g., lexical overlap, edit distance).
6. **Emit & Flush**: The observer emits `ghosttext.measurement.computed`. All raw captured text is immediately discarded from memory.

---

## 2. Event/Schema Changes

### Schema Correction: Decoupling Reason Semantics
We must strictly separate *why the intervention ended* from *why the measurement window ended*. 

### New Event Contract: `ghosttext.measurement.computed`
*Registry*: `GhostTextEvents.MEASUREMENT_COMPUTED`

```typescript
export interface GhostTextMeasurementComputedPayload {
  interventionId: string;
  gapType: GapType;
  
  // Why the intervention itself was dismissed (from existing domain semantics)
  dismissalReason: 'continued_typing' | 'caret_moved' | 'lost_focus' | 'node_removed' | 'replaced' | 'explicit' | 'timeout';
  
  // Why the observation window closed
  measurementCompletionReason: 'idle_timeout' | 'hard_timeout' | 'prompt_sent' | 'focus_lost' | 'intervention_replaced' | 'node_removed';
  
  context: {
    origin: string; // e.g., "https://chat.openai.com" (never full URL paths/queries)
    domRole: string; // e.g., "textarea", "textbox"
  };
  
  features: {
    continuationLatencyMs: number | null; // Null if no typing occurred
    typedTextLength: number | null;
    stemLength: number;
    lexicalOverlap: number | null; 
    editDistance: number | null; 
  };
  
  // Represents measurement completeness, NOT confidence in a causal label
  confidence: 'high' | 'medium' | 'low' | 'unknown';
}
```

### Confidence Model
* `unknown`: No subsequent typing captured (features null).
* `low`: Window interrupted prematurely (e.g., `node_removed` mid-typing).
* `medium`/`high`: Meaningful typing captured without early interruption.

---

## 3. Persistence

**Decision:** Do NOT persist measurements locally. 
**Justification:** M11 improves measurement quality, but does not introduce a local policy consumer for granular interaction logs. Persisting detailed behavioral telemetry per-intervention creates unnecessary IndexedDB bloat and privacy risks. 
**Action:** M11 relies purely on the ephemeral emission of `ghosttext.measurement.computed` to the `EventBus`. Telemetry egress systems (if present) can forward this off-device. No `v5` IndexedDB migration will be introduced.

---

## 4. Privacy Considerations

- **URL Handling**: The observer must use `window.location.origin` strictly. No pathnames, query parameters, or PII will be read from the URL.
- **Raw Text Storage**: The raw text exists solely in ephemeral memory and is strictly cleared the moment the event fires.

---

## 5. Modified & New Files

### Modify
- `src/core/event-bus/registry.ts`: Add `MEASUREMENT_COMPUTED`.
- `src/core/event-bus/contracts.ts`: Define `GhostTextMeasurementComputedPayload`.

### New
- `src/platforms/observers/GhostTextMeasurementObserver.ts`: Handles the ephemeral observation window and feature calculations.
- `src/platforms/observers/GhostTextMeasurementObserver.selftest.ts`: Deterministic invariant tests.

---

## 6. Required Invariants

1. **Deterministic Attribution**: Every measurement event must carry the exact `interventionId` that triggered the window.
2. **Isolation**: A new dismissal instantly terminates an active observation window (producing `measurementCompletionReason: 'intervention_replaced'`) before starting a new one.
3. **No Fabrication**: If the user does not type anything after dismissal, distance features must be `null`, and confidence must be `unknown`.
4. **No Side Effects**: `GhostTextAdaptor` must not subscribe to or change state based on `MEASUREMENT_COMPUTED`.
5. **No PII Persistence**: `context.origin` must not contain query parameters.

---

## 7. Deterministic Self-Tests (`GhostTextMeasurementObserver.selftest.ts`)

- **Accepted Intervention**: Window should not start if accepted.
- **Explicit Dismissal (No Typing)**: Window hits `hard_timeout` (or `idle_timeout` if timer runs), fires measurement with `features: { continuationLatencyMs: null, lexicalOverlap: null }`, confidence `unknown`.
- **Continued Typing**: Captures first keystroke latency, hits 2s `idle_timeout` or 5s `hard_timeout`, fires with computed distances and `high` confidence.
- **Prompt Sent**: `prompt.sent` or `submit` terminates window early.
- **Multiple Interventions Overlapping**: Second intervention terminates first window with `intervention_replaced`.
- **DOM Loss**: If `inputNode` is unmounted, terminates with `node_removed` and `medium/low` confidence.

---

## 8. Verdict

**READY FOR IMPLEMENTATION**
The architectural dependencies, lifecycle bounds, and schemas are fully specified and decoupled. No further policy decisions are required.
