# Ghost Text Engine — Architecture Walkthrough

**Module**: `src/engines/ghosttext/`
**Owner**: Yogesh (Gap Detection, Ghost Text, Taxonomy)
**Status**: Implemented and Verified
**Depends on**: `gap.detected` (Gap Detection Engine) — see PR for the gap engine
**Constitution Reference**: Sections 2 (Local-First, Deterministic Runtime), 3 (Layer separation), 4 (Event Contract Law), 9 (Arc Readiness)

---

## 1. Executive Summary

The Ghost Text Engine closes the second half of the Surface A perception loop.
When the user pauses to think mid-prompt, it offers a short **stem** — a gentle
opener the user can continue — that nudges them to address the gap the Gap
Detection Engine most recently surfaced. It turns a detected gap into a helpful,
non-intrusive suggestion exactly when the user is receptive (a thinking pause),
and never while they are actively typing.

Stems are **on-device templates** loaded from versioned config. There is no
network call and no model in v0.1; a small pretrained stem model is post-August
and slots in behind the same engine surface.

## 2. The Flow

```
prompt.typed / state.changed ─▶ Gap Engine ─▶ gap.detected ─┐
                                                            ▼
                          pause.detected ─▶ Ghost Text Engine ─▶ ghosttext.generated
                                                            │
                              (perception layer renders it, then emits
                               ghosttext.displayed / accepted / dismissed)
```

A stem is published only when **all** of these hold:
1. the pause is at least `pauseThresholdMs` (a real thinking pause, default 1200ms);
2. a gap was detected within the last `gapRecencyMs` (default 8s); and
3. that gap belongs to the same session as the pause.

## 3. Files Created and Modified

### Engine (`src/engines/ghosttext/`)
- **[MODIFY]** `GhostTextEngine.ts` — replaced the placeholder. Consumes `gap.detected` + `pause.detected`, selects a stem, and publishes `ghosttext.generated`. Rotates through a gap type's stems so repeated suggestions vary.
- **[NEW]** `GhostTextEngine.selftest.ts` — framework-free self-test (13 assertions).

### Configuration (`src/core/config/`)
- **[NEW]** `ghosttext_stems.json` — versioned stems keyed by gap type + timing settings.
- **[NEW]** `ghosttext_stems.schema.json` — JSON Schema (draft-07).
- **[NEW]** `ghosttext-stems-loader.ts` — typed runtime loader.
- **[MODIFY]** `index.ts` — re-export the loader.
- **[MODIFY]** `scripts/validate-schemas.mjs` — now also validates the stems config.

> Reuses `shared/events/createDomainEvent.ts` introduced alongside the Gap engine.

## 4. The Golden Rule — "nothing happens while the user waits"

Stem selection is a synchronous map lookup (O(1)) performed **during** a pause.
There is no spinner, no blocking, and no network in the path, so the work is
inherently inside the <200ms ghost-text budget (Constitution §2). A runtime timer
would cost more than the lookup it measures, so the budget is honoured by
construction rather than by instrumentation; the rationale is recorded here.

Display and the user's accept/dismiss decision are the perception layer's
responsibility and return to the system as their own registered events
(`ghosttext.displayed`, `ghosttext.accepted`, `ghosttext.dismissed`).

## 5. Preservation of Invariants

- **Event Contract Law**: emits only `ghosttext.generated` with the documented `{ gapType, stem }` payload; consumes only registered events.
- **Local-First**: no raw prompt text touches this engine — it works purely from a gap type and timing metadata.
- **Deterministic Runtime**: synchronous, in-memory, no network; comfortably inside budget.
- **Arc Readiness**: no platform/DOM coupling; injectable clock + id keep it deterministic and identical when hardware drives the same events.
- **No hardcoded copy**: every stem and threshold lives in `ghosttext_stems.json`.

## 6. Verification

- `npx tsc --noEmit` — clean (strict mode, zero diagnostics).
- `node scripts/validate-schemas.mjs` — `ghosttext_stems.json` validates against its schema.
- Self-test: **13/13 assertions pass** (trigger threshold, recency window, session scoping, rotation, the no-gap case, and the over-length-stem guard).

## 7. Definition of Done Checklist

- [x] Emits documented events (`ghosttext.generated`).
- [x] Consumes documented events (`gap.detected`, `pause.detected`).
- [x] Typed contracts + payload/config schema.
- [x] Ships a self-test.
- [x] Meets latency budgets (<200ms; synchronous lookup).
- [x] Platform-agnostic and hardware-ready.
- [x] Architectural documentation (this file).
- [x] Replaceable without downstream changes (config-/injection-driven).
