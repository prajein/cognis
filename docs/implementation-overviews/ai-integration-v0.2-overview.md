# AI Integration v0.2 — Implementation Overview

**Author:** prajein
**Date:** 2026-08-19
**Branch:** `prajein`

## Executive Summary

This pass responds to a combined-sprint request covering Dhanya's (Intelligence Layer evaluation), Riya's (ML response/skill models), Suchit's (Surface B/storage), and Naren's (perception/core engines) tracks, plus four "advanced AI module" upgrades. The request's scope — production-grade on-device NLU, a silent-meta-call LLM pipeline, a new platform adapter, and four people's sprint deliverables, all in one pass — was larger than could be delivered honestly at real quality in one sitting. After reconnaissance surfaced that several of the request's premises were stale (event store is `cognis_v1` with migrations through v4, not `cognis_v3`; `npm test` ran neither a typecheck nor the repo's 34 existing selftests; no ML/LLM dependency exists anywhere in this fully local, deterministic, event-driven codebase), the work was rescoped with the user's explicit sign-off to a **prioritized subset delivered at real quality**, with everything else written up as an explicit punch list rather than silently dropped or faked.

The "AI upgrade" framing throughout is deliberately literal: no `window.ai`/Gemini Nano, no Transformers.js, no real LLM calls were added, because none of that is verifiable in this environment and none of it existed in the architecture already. Every change here is a genuine heuristic/statistical upgrade behind an unchanged public interface, honestly labeled as such.

## What Changed

### 1. `GapHeuristics` v0.2 — weighted multi-signal matcher
- `src/engines/gap/GapHeuristics.ts`, `src/core/config/gap-rules-loader.ts`, `src/core/config/gap_rules.json` (+ its schema), `src/engines/gap/GapHeuristics.selftest.ts` (new).
- Replaced the v0.1 binary "any marker substring present" check with a weighted evidence accumulator: exact matches at full marker weight, a light suffix-stripping stem match and a bounded (single-word, ≤1-edit) fuzzy match at a discount, summed into a `matchScore` compared against a new `settings.addressedThreshold`. Markers can now optionally carry `{marker, weight}` to down-weight generic evidence (demonstrated on the `mechanism`/`temporal` rules). `detect()`'s signature is unchanged; a real model can still slot in behind it later, per the module's own docstring.
- Selftest asserts backward compatibility with plain-string v0.1 configs, stem/fuzzy/weighted-marker behavior, the partial-evidence confidence penalty, and a timing bound (40 `detect()` passes over a ~2900-char prompt complete in well under 200ms).

### 2. `GhostTextEngine` v0.2 — wider template rotation
- `src/engines/ghosttext/GhostTextEngine.ts`, `src/core/config/ghosttext_stems.json`.
- Each gap type's stem list widened from 2 to 4 static, hand-written variants; the existing rotation cursor now cycles through all of them (no-immediate-repeat).
- **A topic-interpolation stretch goal (filling a `{topic}` slot from a phrase guessed out of the user's live prompt text) was built, then reverted during self-review.** The stem is published on `ghosttext.generated`, which travels over the EventBus and can be persisted — so any user-text fragment folded into it would have violated ADR-019's "raw prompt text never touches the EventBus" rule. This is architecturally different from `GapDetectionEngine`'s transient-text pattern, which only ever publishes a *derived signal*, never the text itself. The interpolation code, its `captureTransientText`/`ghostEngine` threading through `TypingObserver` → `PlatformManager` → the platform adapters, and its `{topic}` config entries were all removed before this branch was finalized. See "Caught During Self-Review" below.

### 3. `EnrichmentEngine` — highest-leverage-gap signal
- `src/engines/enrichment/EnrichmentEngine.ts`, `src/core/event-bus/contracts.ts` + `registry.ts` (new `enrichment.leverageGap` event / `EnrichmentEvents`), `src/core/config/leverage_gap_questions.json`.
- The Build Brief's "silent meta-call" (ask an LLM what 3 context items would most change the response) has no LLM to call in this architecture. Implemented instead: `activeGaps` is now tracked with confidence, and on every `gap.detected` the engine ranks the single highest-confidence unaddressed gap and publishes `{gapType, confidence, questionTemplateId}` — a static question id/text pair, never prompt text.
- Scoped to the engine/event layer only: investigation confirmed no pre-send overlay UI seam exists yet (`SubmitInterceptor` renders nothing; `GhostTextObserver`'s overlay only fires mid-typing). Rendering it is on the punch list, not silently skipped.

### 4. Gemini platform adapter
- `src/platforms/gemini/GeminiAdapter.ts` (rewritten from a 12-line `throw new Error('Not implemented')` stub), new `src/platforms/selectors/gemini-v1.ts`, `src/platforms/selectors/registry.ts`, `src/platforms/manager/PlatformManager.ts`, `src/content/content-script.ts` (hostname allowlist), `manifest.json` (content script match pattern).
- The old adapter implemented a different, dead interface (`AIPlatformAdapter`) than the one ChatGPT/Claude actually use. It's now a structural match of `ChatGPTAdapter`/`ClaudeAdapter` (composition root, same five observers, generic `ResponseObserver`). Every selector string in `gemini-v1.ts` carries an inline `UNVERIFIED — confirm against live gemini.google.com DOM before shipping` comment — there was no live browser access available to inspect Gemini's actual markup, so these are best-effort placeholders, not verified selectors.

### 5. Two new `InsightStrategy` implementations
- `src/engines/insights/strategies/FormulationGapTrendStrategy.ts`, `CognitiveStateProxyStrategy.ts`, registered in `InsightEngine.ts`. Selftest: `InsightStrategies.selftest.ts`.
- `FormulationGapTrendStrategy` reads the existing per-gap-type `GapProfileReadModel` counts (no new read model) to detect whether a recurring gap's ghost-text nudges are landing (low rejection ratio) or being tuned out (high rejection ratio).
- `CognitiveStateProxyStrategy` was descoped from a full per-cognitive-state time-distribution model (which would need a brand-new `state.changed` projection builder — not built) to a coarser, explicitly-labeled proxy using the `totalPauseDurationMs`/session-duration ratio already on `SessionReadModel`.

### 6. `ConfidenceCalculator` calibration
- `src/engines/insights/ConfidenceCalculator.ts`, `src/engines/insights/ConfidenceCalculator.selftest.ts` (new), `docs/research/confidence-calibration.md`.
- Replaced the 3-tier step decay (100%/50%/10% at 30d/90d cliffs) with continuous half-life decay (`0.5 ^ (age / 30 days)`, floored at the old 10% permanent-evidence floor) — reproduces the old function's two reference points exactly/approximately while removing the day-29-vs-day-31-style discontinuities.

### 7. Response analyzer eval harness
- `docs/benchmarks/response-analyzer-fixtures.json`, `docs/benchmarks/run-analyzer-eval.ts`, `package.json` (`eval:analyzers` script).
- Runs the real `StructureAnalyzer`/`ReasoningAnalyzer`/`CompletenessAnalyzer`/`QualityAnalyzer` (composite) against 6 hand-authored fixtures (shallow directive, well-structured/reasoned, truncated code block, dense reasoning chain, hedged/uncertain, empty). **Honesty note carried in the fixture file itself:** these are regression bands calibrated against the real analyzer output and reviewed for face plausibility, not independently human-labeled ground truth — there is no labeling pipeline in this repo to draw real ground truth from.

### 8. Selftest runner
- `scripts/run-selftests.ts`, `package.json` (`selftest` script).
- The repo had 34 (now 37, after this pass's additions) `*.selftest.ts` files, none wired into any npm script. This discovers every `**/*.selftest.ts` file and runs it via `npx tsx <file>` (each file already auto-runs and exits 0/1 on its own, per its own header comment's documented manual invocation) — no coupling to per-file export naming conventions, which turned out to be inconsistent across the 37 files.

## Caught During Self-Review

The `GhostTextEngine` topic-interpolation feature (item 2 above) was implemented, wired end-to-end (including cross-cutting changes to `TypingObserver`, `PlatformManager`, and all three platform adapters), and then reverted in full before this branch was finalized, once re-reading `GhostTextEngine`'s own publish path made clear that interpolating live user text into a stem meant that text would ride `ghosttext.generated` onto the EventBus — the exact thing ADR-019 exists to prevent. Recorded here rather than silently squashed out of the history, since it's a concrete example of the kind of mistake this task's "heuristic upgrades only, nothing unverifiable" scoping was meant to guard against, and it slipped through the initial design pass anyway.

## Explicit Punch List (deferred, not silently dropped)

- Real on-device NLU (`window.ai`/Gemini Nano or Transformers.js) for gap classification — no live Chrome environment available here to verify either; `GapHeuristics.detect()`'s signature is unchanged specifically so this can slot in later.
- A real LLM-backed "silent meta-call" enrichment pipeline — no LLM available in this environment or architecture.
- A pre-send inline overlay UI for the `enrichment.leverageGap` signal (a `LeverageGapObserver` mirroring `GhostTextObserver`'s rendering pattern) — the signal exists, the UI does not.
- Semantic skill-domain classifier (System Design/Algorithms/Writing/Data Science) feeding `V1AutomaticityEvaluator`.
- Active Reading Analyzer (core-claim distillation, load-bearing-assumption extraction, missing-context gaps from live streaming chunks).
- A full `CognitiveStateDistributionStrategy` backed by a real `state.changed` time-in-state projection builder (current `CognitiveStateProxyStrategy` is a coarser, explicitly-labeled stand-in).
- Manual verification of every `gemini-v1.ts` selector against the live gemini.google.com DOM.
- Track C (Surface B visualizer/storage): reconnaissance found this substantially already implemented (48 brain-map SVGs, `verify-assets.ts`, IndexedDB migrations v1–v4, both `SessionProjectionBuilder`/`GapProfileProjectionBuilder`) — no gap identified worth new work here in this pass.

## Test Results

- **VERIFIED**: `npm run selftest` (new) — 37/37 selftest files pass, including the 3 added in this pass (`GapHeuristics`, `ConfidenceCalculator`, `InsightStrategies`).
- **VERIFIED**: `npm test` (existing `validate:schemas && build:brain-maps`) — passes, including the updated `gap_rules.json`/`gap_rules.schema.json` (the schema needed updating for the new `addressedThreshold` setting and weighted-marker object shape — caught by actually running the existing validator, not assumed).
- **VERIFIED**: `npm run eval:analyzers` (new) — 15/15 fixture checks land inside their expected bands.
- **VERIFIED**: `npx tsc --noEmit` — 0 errors.
- **VERIFIED**: `npm run build` — succeeds; built `manifest.json` confirmed to include the `gemini.google.com` content-script match.

## Acceptance Against the Original Request

- **NOT ATTEMPTED, BY DESIGN**: "production-grade" on-device NLU via a real browser/ML API, the real silent-meta-call LLM pipeline, and full coverage of all four people's sprint deliverables in one pass — the request's own bar (0 errors, 34/34 passing, production-grade AI, four sprints) was larger than one pass could deliver honestly; rescoped with the user upfront rather than faking completion.
- **IMPLEMENTED**: heuristic v0.2 upgrades to gap detection and ghost-text template selection, a local substitute for the enrichment meta-call, a real interface migration for the Gemini adapter, two new insight strategies, a confidence-calibration fix with a written rationale, a runnable analyzer eval harness, and a selftest runner that makes "N/37 passed" an honestly-checkable claim instead of an assumed one.
