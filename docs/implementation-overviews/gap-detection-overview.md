# Gap Detection Engine — Architecture Walkthrough

**Module**: `src/engines/gap/`
**Owner**: Yogesh (Gap Detection, Ghost Text, Taxonomy)
**Sprint**: Week 1 — "draft the gap-detection rules and pick the on-device approach"
**Status**: Implemented and Verified
**Constitution Reference**: Sections 2 (Local-First), 3 (Layer separation), 4 (Event Contract Law), 5 (Type Safety), 9 (Arc Readiness)

---

## 1. Executive Summary

The Gap Detection Engine is the first Surface A domain engine. It looks at the
user's in-progress prompt and estimates which kinds of context are missing —
the user's intent, audience, constraints, and so on — so that the Ghost Text and
Enrichment engines can help the user say what they actually mean.

This delivers Yogesh's Week-1 deliverable: a **drafted, on-device rule set** plus
the engine that carries it. The rules are deliberately simple and transparent
(deterministic lexical heuristics, zero network, zero model weights), and every
threshold and marker lives in versioned config so the rules can be tuned without
a code change. A pretrained stem/NLU model can later replace the heuristics
behind the same `detect()` signature.

## 2. The Gap Taxonomy

Eight gap types, defined in `src/core/types/gap.types.ts` (the shared contract):

| Gap type        | The question the user has not yet answered |
| --------------- | ------------------------------------------ |
| `intentionality`| What am I ultimately trying to achieve?    |
| `audience`      | Who is this output for?                     |
| `constraint`    | What are the boundaries / limits?           |
| `stakes`        | Why does this matter; what are the consequences? |
| `assumption`    | What am I taking for granted but not stating? |
| `mechanism`     | How should this work / be done?             |
| `temporal`      | What is the timeframe or sequence?          |
| `second_order`  | What are the downstream effects?            |

## 3. Files Created and Modified

### Engine (`src/engines/gap/`)
- **[NEW]** `types.ts` — engine-internal types (`GapSignal`, `GapAnalysisInput`, `GapAnalysisResult`). Kept out of protected `core/` because they are engine internals; only `GapType` and the `gap.detected` payload are shared contracts.
- **[NEW]** `GapHeuristics.ts` — the pure rule engine. No EventBus, no storage, no DOM, no clock — a pure function from input to gap signals. This is "the rules."
- **[MODIFY]** `GapDetectionEngine.ts` — replaced the placeholder. Wires the heuristics to the EventBus: consumes context events, exposes the `analyze(text)` sensory-input edge, and publishes `gap.detected`.
- **[NEW]** `GapDetectionEngine.selftest.ts` — framework-free self-test (15 assertions).

### Configuration (`src/core/config/`)
- **[NEW]** `gap_rules.json` — versioned rule set: per-gap markers, base confidences, state/revision modifiers, and emit thresholds.
- **[NEW]** `gap_rules.schema.json` — JSON Schema (draft-07) for the above.
- **[NEW]** `gap-rules-loader.ts` — typed runtime loader (mirrors `activation-profile-loader`).
- **[MODIFY]** `index.ts` — re-export the loader.

### Event Infrastructure (`src/core/event-bus/`)
- **[NEW]** `createDomainEvent.ts` — small `DomainEvent<T>` factory with injectable clock + id source (testability + Arc-readiness). Lives alongside the rest of the event infrastructure and is re-exported from the event-bus barrel.

### Tooling
- **[MODIFY]** `scripts/validate-schemas.mjs` — generalised to validate every `*.schema.json` / data pair (now covers gap rules; tolerant of not-yet-present configs).

## 4. Architectural Decision — The Sensory-Input Edge

The Constitution forbids `Perception → Engine` direct calls and requires
`Perception → Event Bus → Engine`, while Local-First forbids persisting raw
prompt text (events carry `currentTextHash`, never the text). Gap detection,
however, needs the words.

These reconcile cleanly once we separate **domain events** from **sensory input**:

- **Sensory input** (raw prompt text, and tomorrow raw Arc signal frames) is
  transient. It is handed to an engine in-memory and never persisted. The Gap
  Engine receives it via `analyze(text)`.
- **Domain events** (the engine's *conclusions* — `gap.detected { gapType,
  confidence }`) flow through the EventBus, are ordered, and are persisted.

So the bus still carries every domain fact, the engine stays replaceable, and raw
text never reaches the event log. This mirrors exactly how Arc hardware will hand
raw waveforms to a state provider while only `state.changed` reaches the bus.

> This decision is documented here rather than as an ADR because it lives inside
> a feature engine (`engines/gap/`), not a protected foundation area. If the
> Architecture Lead wishes to elevate it to an ADR, the seam is already isolated.

## 5. How Detection Works

For each gap type the config lists markers whose **presence** means the gap is
already addressed. For a given prompt the engine:

1. Skips entirely if the text is shorter than `minTextLength`.
2. For each rule, if no marker is present, assigns `baseConfidence`, then adds
   the cognitive-state modifier (overload raises gap likelihood, coasting lowers
   it) and a revision-depth modifier (more edits ⇒ more uncertainty), clamped to
   `[0, 1]`.
3. Emits the signals at or above `emitThreshold`, strongest first, capped at
   `maxSignals`.

All confidences are **model estimates, not measurements** (Disclosure Rule).

## 6. Preservation of Invariants

- **Event Contract Law**: emits only `gap.detected`, exactly as registered, with the documented `{ gapType, confidence }` payload.
- **Local-First**: raw text is never persisted, hashed into an event, or echoed back.
- **Deterministic Runtime**: detection is synchronous substring scanning (microseconds), far inside the <200ms ghost-text budget; no network in the path.
- **Arc Readiness**: no platform/DOM/browser coupling; the engine is constructed with an `EventBusContract` and nothing else mandatory.
- **Replaceability (DoD #10)**: heuristics are injected, so a future model implements the same surface without downstream changes.

## 7. Verification

- `npx tsc --noEmit` passes (strict mode, zero diagnostics).
- `node scripts/validate-schemas.mjs` validates `gap_rules.json` against its schema.
- Self-test: **15/15 assertions pass** (pure-rule behaviour, state/revision modifiers, the `maxSignals` cap, end-to-end engine publish, and the pre-session no-op).

## 8. Definition of Done Checklist

- [x] Emits documented events (`gap.detected`).
- [x] Consumes documented events (`state.changed`, `prompt.typed`).
- [x] Has typed contracts and a payload schema (config schema).
- [x] Ships a self-test.
- [x] Meets latency budgets (synchronous, in-memory).
- [x] Platform-agnostic and hardware-ready (no DOM, injectable clock/id).
- [x] Has architectural documentation (this file).
- [x] Replaceable without downstream changes (injected heuristics).
