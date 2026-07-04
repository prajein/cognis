# Week 2 — Surface A Co-pilot Flow (end-to-end) — Architecture Walkthrough

**Module**: `src/engines/ghosttext/pipeline/` (+ a refinement to `src/engines/ghosttext/GhostTextEngine.ts`)
**Owner**: Yogesh (Gap Detection, Ghost Text)
**Sprint**: Week 2 — finishing + proving the Surface A co-pilot flow
**Status**: Implemented and Verified
**Builds on**: [Gap Detection](./week1-gap-detection-overview.md) · [Ghost Text](./week1-ghost-text-overview.md) · [Gap Pipeline](./week2-gap-pipeline-overview.md)

---

## 1. Executive Summary

The gap engine and the ghost-text engine each had their own tests, but the
*product* is the two of them working together: you type a vague prompt, gaps get
detected, you pause to think, and a helpful stem appears for the thing that
matters most. This adds an end-to-end harness that proves that whole moment with
the **real** engines and **real** config on one bus — and, in building it, fixes
a real weakness in which gap the ghost text addressed.

## 2. What the end-to-end run proves

`SurfaceAPipeline` composes the real `GapDetectionEngine` + real `GhostTextEngine`
exactly as `content/index.ts` wires them, but in-memory. A dry run:

```
You type:   "write a function"
Gaps found: intentionality:0.60, audience:0.55, constraint:0.55
You pause…  ghost text: "My goal here is to "   (addresses: intentionality)

You type:   "My goal is to write a sorting function for a beginner audience;
             it must run fast, using merge sort, and this matters because it is graded."
Gaps found: (none)
You pause…  (no ghost text — prompt is well specified)
```

A vague prompt gets a nudge for its biggest gap; a well-specified prompt is left
alone. That is the Surface A promise, demonstrated without a browser.

## 3. The refinement — nudge the strongest gap, not the last one

A single `analyze()` pass emits several `gap.detected` events, strongest-first.
The ghost-text engine used to keep whichever gap arrived **last**, so it always
landed on the **weakest** one:

| | Before | After |
| --- | --- | --- |
| `"write a function"` | ghost text: *"It needs to"* (constraint, 0.55 — weakest) | ghost text: *"My goal here is to"* (intentionality, 0.60 — strongest) |

The engine now keeps the **strongest gap within the recency window**, so the stem
nudges the most important missing context. Backwards-compatible: all prior
ghost-text behaviour (recency, session scoping, rotation, over-length guard) is
unchanged and still tested.

## 4. Files

- **[NEW]** `engines/ghosttext/pipeline/SurfaceAPipeline.ts` — the end-to-end harness (`type()`, `pause()`, `run()`, plus captured gaps/stems).
- **[NEW]** `engines/ghosttext/pipeline/SurfaceAPipeline.selftest.ts` — 8 end-to-end assertions + a `--demo` trace.
- **[MODIFY]** `engines/ghosttext/GhostTextEngine.ts` — track the strongest recent gap (adds `confidence` to the tracked gap; ~8 lines).
- **[MODIFY]** `engines/ghosttext/GhostTextEngine.selftest.ts` — `emitGap` takes a confidence; new strongest-gap assertion.

## 5. Verification

Full Surface A regression, run against the real configs:

| Suite | Result |
| --- | --- |
| Gap engine | 15/15 |
| Gap pipeline (corpus) | 11/11 |
| Ghost text | 15/15 |
| Surface A end-to-end | 8/8 |

- `npx tsc --noEmit` — clean (strict mode).
- `--demo` prints the co-pilot dry run above.

Privacy note: raw prompt text is handed to `gapEngine.analyze()` in-memory only; the harness bus carries just the `{ gapType, confidence }` / `{ gapType, stem }` conclusions and has no store subscriber (Local-First; ADR-019).

## 6. Definition of Done

- [x] The full Surface A flow (type → gap → pause → stem) is proven with the real engines + config.
- [x] Ghost text nudges the most important gap.
- [x] Deterministic, in-memory, no DOM, no persistence.
- [x] 49 assertions across the Surface A stack, all green; tsc clean.
- [x] Architectural documentation (this file).
