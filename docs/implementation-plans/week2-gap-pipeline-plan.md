# Week 2 — Gap Detection Pipeline — Implementation Plan

**Module**: `src/engines/gap/pipeline/`
**Owner**: Yogesh
**Sprint slice**: Week 2 — "wire the gap rules into a testable pipeline"
**Constitution Reference**: Sections 2, 3, 9 · ADR-019

---

## 1. Problem

Week 1 delivered the gap rules (`gap_rules.json`) and the `GapDetectionEngine`.
The only way to exercise them is through the live `ChatGPTAdapter` → `analyze()`
path, which needs a browser. That makes the rules unverifiable in CI, risky to
tune, and impossible to demo without a live site.

## 2. Goal

An in-memory, deterministic pipeline that drives the **real** engine and **real**
config through the **real** `analyze()` edge, plus a golden corpus and runner, so
the rules are regression-tested and tunable with confidence.

## 3. Approach

1. `GapPipeline` — owns an isolated `EventBus` + `GapDetectionEngine`, seeds a
   session (so `analyze()` is live), and exposes `feed({ text, state,
   revisionDepth })` that emits the same context events production does
   (`state.changed`, `prompt.typed`) and calls `engine.analyze(text)`, returning
   the captured `gap.detected` payloads.
2. `scenarios.ts` — a corpus of realistic prompts, each with the exact expected
   gap set and a note. Chosen to cover: no-context, fully-specified, single-gap,
   state-modifier effects (coasting suppresses, overload lifts), the `maxSignals`
   cap, marker suppression, and the `minTextLength` floor.
3. `GapPipeline.selftest.ts` — asserts every scenario as an exact-set match, plus
   a confidence-range invariant; `--describe` prints live detections for tuning.

## 4. Invariants

- Raw text is transient — handed to `analyze()`, never evented or persisted
  (Local-First; ADR-019). The pipeline's bus has no store subscriber.
- No existing module is modified; the pipeline lives entirely under
  `engines/gap/pipeline/`.
- No new runtime dependency; the runner is framework-free.

## 5. Out of Scope

- Live DOM / platform wiring (owned by `ChatGPTAdapter` / `PlatformManager`).
- Ghost Text and Enrichment (separate engines that consume `gap.detected`).
- Any change to the rules themselves — this PR only makes them testable.

## 6. Verification

- `npx tsc --noEmit` clean.
- Runner green against the real `gap_rules.json`.
