# Insight Strategy Algorithm Design

**Workstream:** WS2 — Insight Strategy Design & Implementation
**Companion to:** `docs/research/insight-strategy-design-rationale.md` (business-facing design document)
**Scope:** Technical algorithm detail for `V1PromptingPatternEvaluator`, `V1GapResolutionEvaluator`, `V1ReasoningDepthEvaluator`

This document covers the *how*, at implementation level of detail, for engineers reading or maintaining the strategy code. The design rationale document covers the *why* and *what*, for review purposes.

---

## 1. Shared foundation: the evidence-access constraint

All three algorithms are shaped by one confirmed constraint: `ReasoningContext.getEventHistory(marker: string): readonly number[]` returns **timestamps only**, never event payloads. This was confirmed directly from `ReasoningPipeline.ts`'s real context-builder implementation, not assumed.

Two consequences drive every algorithm below:

1. **Per-category evidence requires per-category markers.** Where a signal needs to be broken down by `gapType` (8 values), the strategy queries 8 separate composite markers (`gap.detected:{gapType}`) rather than filtering a single event stream by payload. This convention is centralized in `gapEventMarkers.ts` and shared by `V1GapResolutionEvaluator` and `V1PromptingPatternEvaluator`.
2. **All trend/pattern detection is necessarily frequency-based** (timestamp density over time), not value-based. No algorithm here can operate on a numeric score series, because no numeric per-event values are retrievable through the confirmed API.

---

## 2. Shared primitive: density-based trend detection

All three strategies compare event frequency between a "recent" window and a "historical" (earlier) window, using the same underlying primitives:

```
LOOKBACK_DAYS = 30
lookbackStart = now - LOOKBACK_DAYS * MS_PER_DAY

recent  = timestamps where t >= lookbackStart
earlier = timestamps where t <  lookbackStart

spanDaysEndingAt(timestamps, end):
    if timestamps is empty: return 1        # avoids division by zero
    earliest = min(timestamps)
    return max(1, (end - earliest) / MS_PER_DAY)

density(timestamps, end) = count(timestamps) / spanDaysEndingAt(timestamps, end)

relativeChange = (recentDensity - earlierDensity) / earlierDensity
```

**Evidence gate, applied uniformly:** no trend is claimed unless **both** `recent.length >= 5` and `earlier.length >= 5`. This is stricter than just requiring 5 total events — a comparison needs a real sample on both sides, or the "trend" is an artifact of one side being empty. This gate is what several evaluation-dataset entries (`reasoning-005`, `reasoning-006`, `prompting-004` in its flat-not-empty form) specifically exercise.

**Significance threshold:** `|relativeChange| >= 0.25` (25%) before a trend is reported. Below this, the change is treated as normal variation, not a pattern worth surfacing. This single constant is the entire "is this noise or a real trend" decision for the two frequency-trend strategies (`V1PromptingPatternEvaluator`, `V1ReasoningDepthEvaluator`) — deliberately simple, tunable in one place, and validated against both directions (increase and decrease) in the evaluation dataset.

---

## 3. `V1PromptingPatternEvaluator` — algorithm detail

```
FOR each gapType in ALL_GAP_TYPES (8 total):
    allTimestamps += getEventHistory(buildGapMarker(gapType))

apply the shared density/trend primitive (Section 2) to the COMBINED allTimestamps array
IF gate fails or change is below threshold: return []
ELSE:
    isImproving = relativeChange < 0   # declining gap frequency = improving prompts
    percentChange = round(abs(relativeChange) * 100)
    RETURN one InsightCandidate, domain=Prompting
```

Single combined timeline across all 8 gap types — this strategy deliberately does not distinguish which gap type contributed to the trend; that's `V1GapResolutionEvaluator`'s job. `evidenceCount` on the resulting candidate is the recent-window combined count.

**Confidence:** `calculator.calculate(recent, requiredCount=5, baseline=0.75, contradicts=false, existingCount=earlier.length, now)`.

---

## 4. `V1GapResolutionEvaluator` — algorithm detail

This one is per-gap-type (not aggregated) and has two independent branches, evaluated separately for each of the 8 gap types on every `execute()` call:

```
FOR each gapType in ALL_GAP_TYPES:
    all = getEventHistory(buildGapMarker(gapType))
    IF all.length < 5: skip this gapType (never enough evidence to say anything)

    recent  = all where t >= lookbackStart
    earlier = all where t <  lookbackStart
    recentDensity = recent.length / LOOKBACK_DAYS

    # --- Branch 1: Chronic ---
    IF recent.length >= 5 AND recentDensity >= CHRONIC_DENSITY_THRESHOLD (0.15/day):
        resolutions = getEventHistory(buildResolutionMarker(gapType)) filtered to recent window
        resolutionRatio = resolutions.length / recent.length
        IF resolutionRatio < 0.5:
            EMIT "Chronic gap: {gapType}", confidence baseline=0.8

    # --- Branch 2: Improving ---
    IF earlier.length >= 5:
        historicalDensity = earlier.length / spanDaysEndingAt(earlier, lookbackStart)
        IF historicalDensity >= CHRONIC_DENSITY_THRESHOLD AND recentDensity <= historicalDensity * 0.5:
            EMIT "Improving gap: {gapType}", confidence baseline=0.65
```

**Why `CHRONIC_DENSITY_THRESHOLD = 0.15/day` specifically:** at the 30-day lookback window, this works out to roughly 5 occurrences in the window — deliberately aligned with the same evidence floor used everywhere else, so "chronic" isn't a separate, disconnected threshold from "enough evidence to trust at all."

**Why two independent branches instead of one combined chronic/improving decision:** a gap type can be evaluated on its recent behavior (branch 1) and, separately, on how its recent behavior compares to history (branch 2) — these ask different questions and can both be false, or (design-time bug, caught and fixed during implementation) accidentally both true if the thresholds aren't chosen carefully relative to each other. The current constants were verified via the self-test suite specifically to keep the two branches mutually exclusive across the test scenarios exercised.

**Resolution correlation caveat, load-bearing for the confidence framing:** `ghosttext.accepted:{gapType}` timestamps are correlated to `gap.detected:{gapType}` only by falling in the same recent window — there is no direct event-to-event link (confirmed from `GhostTextEngine.ts`'s own recency-window correlation logic, which uses the same inference model). The candidate's `metadata.resolutionInferredNotExact: true` flag exists specifically so downstream consumers of the insight don't treat resolution as a verified fact.

---

## 5. `V1ReasoningDepthEvaluator` — algorithm detail

```
all = getEventHistory('response.analysis.completed')
IF all.length < 5: return []

apply the shared density/trend primitive (Section 2)
IF gate fails or change below threshold: return []
ELSE:
    isIncreasing = relativeChange > 0
    RETURN one InsightCandidate, domain=Reasoning, metadata.signalType='engagement_frequency'
```

The simplest of the three algorithms, by necessity — this is the strategy most directly limited by the evidence-access constraint (Section 1), since its originally designed algorithm (linear regression over `reasoningScore` values) is not implementable at all against the current API. See the design rationale document's Strategy C section for the full scope-change explanation. `metadata.signalType` is deliberately set to `'engagement_frequency'`, never anything implying quality or depth, so the distinction between what this strategy actually measures and what it was originally meant to measure stays visible in the data itself, not just in a comment.

**Confidence baseline of 0.6** (lowest of the three strategies) is a direct, static reflection of the WS1 Baseline Report's finding that `ReasoningAnalyzer` is the least accurate of the four response analyzers — applied as a blanket discount rather than a per-event one, because per-event discounting would require exactly the payload access this strategy doesn't have (see design rationale document, Section on Confidence Calibration, for the rejected alternative design and why it was rejected).

---

## 6. Verification methodology

Every algorithm above was verified by execution, not just review:

1. Each strategy has a standalone `.selftest.ts` (17, 16, and 17 assertions respectively — 50 total) covering: expected-positive cases in both directions, evidence-floor rejection, missing-baseline rejection, multi-category independence, and structural validity of every emitted candidate.
2. The 26-entry evaluation dataset (`insight-strategy-dataset.json`) was run against the real strategy implementations via a purpose-built verification script, checking expected presence/absence, expected domain, and expected confidence range per entry, before being finalized.
3. One real logic bug (`V1GapResolutionEvaluator`'s chronic/improving threshold math initially allowed both branches to fire on the same input under certain conditions) was caught during this process, before delivery — not discovered later.

**Known limitation of this verification:** the `ConfidenceCalculator` used during verification is a local stub matching the confirmed method signature, not the real WS3-owned implementation (whose internal formula hasn't been confirmed). Confidence *ranges* in the evaluation dataset should be treated as directional pending revalidation against the real calculator once available — the *presence/absence* and *domain* checks are unaffected by this, since they depend only on this workstream's own logic.
