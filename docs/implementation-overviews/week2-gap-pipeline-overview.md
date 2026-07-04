# Week 2 — Gap Detection Pipeline (Testable) — Architecture Walkthrough

**Module**: `src/engines/gap/pipeline/`
**Owner**: Yogesh (Gap Detection, Ghost Text, Taxonomy)
**Sprint**: Week 2 — Perception + Brain Map · Yogesh's slice: "wire the gap rules into a testable pipeline"
**Status**: Implemented and Verified
**Builds on**: [Week 1 — Gap Detection Engine](./week1-gap-detection-overview.md)
**Constitution Reference**: Sections 2 (Local-First), 3 (Layer separation), 9 (Arc Readiness) · [ADR-019 Transient Transport Data Policy](../adrs/ADR-019-transient-response-text.md)

---

## 1. Executive Summary

Week 1 shipped the gap rules and the engine that carries them. Week 2 makes that
engine **runnable and regression-testable off a live site**.

In production the flow is `ChatGPTAdapter` (DOM) → `gapEngine.analyze(text)` →
`gap.detected` on the bus. That needs a real browser, so the rules were only
verifiable by hand. `GapPipeline` reproduces the exact same wiring — the **real**
`GapDetectionEngine` reading the **real** `gap_rules.json`, driven through the
same `analyze()` sensory-input edge — but in-memory and scriptable. Paired with a
golden **scenario corpus**, it becomes the regression net that lets anyone tune
the rules and immediately see which prompts moved, and a script for the Friday
demo with no live site required.

## 2. Files Created

- **[NEW]** `src/engines/gap/pipeline/GapPipeline.ts` — the in-memory driver. Owns an isolated `EventBus` + `GapDetectionEngine`, seeds a session, and exposes `feed({ text, state, revisionDepth })` which returns the `gap.detected` payloads the engine produced for that prompt.
- **[NEW]** `src/engines/gap/pipeline/scenarios.ts` — the golden corpus: realistic prompts, each with the exact gap set the current rules should emit and a note on what it demonstrates.
- **[NEW]** `src/engines/gap/pipeline/GapPipeline.selftest.ts` — the runner. Asserts every scenario, plus a `--describe` mode that prints what each prompt currently produces (a rule-tuning aid).

No existing files are modified — this is purely additive on top of the merged Week 1 engine.

## 3. Why This Mirrors Production (and stays honest)

| Production (`ChatGPTAdapter`) | `GapPipeline` |
| --- | --- |
| DOM `input` event provides live text | `feed({ text })` provides live text |
| `gapEngine.analyze(text)` in-memory | `gapEngine.analyze(text)` in-memory |
| behavioural context from `state.changed` / `prompt.typed` | pipeline emits the same context events |
| `gap.detected` flows on the shared bus | `gap.detected` flows on an isolated bus, captured |

Same engine, same rules, same sensory-input edge — only the text source and the
bus are swapped. Raw text is still transient: it is handed to `analyze()` and
never placed on the bus or persisted, exactly as the Transient Transport Data
Policy (ADR-019) requires. The pipeline's bus has no `EventStoreSubscriber`, so
nothing it emits is written anywhere.

## 4. The Scenario Corpus

Ten scenarios pin the current rule behaviour. A sample of what they lock in:

```
bare-imperative                  -> intentionality, audience, constraint   (top 3; mechanism capped out)
fully-specified                  -> (none)                                  (all markers present)
audience-missing                 -> audience
audience-missing-coasting        -> (none)                                  (coasting -0.1 drops audience)
constraint-frees-mechanism-slot  -> intentionality, audience, mechanism     (satisfying constraint frees a slot)
well-...-stretch                 -> (none)
well-...-overload                -> assumption, stakes                       (overload +0.1 lifts both)
too-short                        -> (none)                                  (below minTextLength)
```

Every assertion is an exact-set match, so a change to any marker, threshold, or
modifier in `gap_rules.json` surfaces as a corpus diff — the point of the harness.

## 5. Verification

- `npx tsc --noEmit` — clean (strict mode, zero diagnostics).
- Self-test: **11/11** — the ten corpus scenarios plus a confidence-range invariant, run against the real `gap_rules.json`.
- `--describe` mode prints the live detections for rule tuning.

## 6. Definition of Done Checklist

- [x] Exercises the real engine + real config through the real `analyze()` edge.
- [x] Deterministic, in-memory, no DOM, no persistence.
- [x] Ships a self-test / regression corpus.
- [x] Respects Local-First + ADR-019 (raw text stays transient).
- [x] Platform-agnostic and hardware-ready.
- [x] Architectural documentation (this file).
- [x] Purely additive — no existing module modified.
