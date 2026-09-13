# Strategy Design Document — Insight Engine Expansion

**Workstream:** WS2 — Insight Strategy Design & Implementation
**Strategies proposed:** `V1PromptingPatternEvaluator` (Prompting domain), `V1GapResolutionEvaluator` (Gap domain), `V1ReasoningDepthEvaluator` (Reasoning domain)

---

## Summary

The Insight Engine currently has one strategy, covering one of eight taxonomy domains. This document proposes three new strategies covering the Prompting, Gap, and Reasoning domains, each designed against the confirmed real event contracts and confidence-calibration mechanism already in production. All three have been implemented, self-tested, and verified against a 26-entry evaluation dataset.

One implementation dependency was identified during design and is called out at the end of this document — it does not affect the validity of either design, but affects when either strategy can produce output in the live product.

---

## Strategy A: `V1PromptingPatternEvaluator`

**Domain:** Prompting

### Signal Hypothesis

Overall prompt quality can be inferred from the total frequency of detected context gaps across all 8 gap types combined: a decline in gap frequency over time suggests the user is specifying more complete context up front, without needing per-gap-type detail. This is a holistic companion to `V1GapResolutionEvaluator` below, which reports per-gap-type patterns rather than one combined trend.

### Evidence Requirements and Expected Event Types

- **`gap.detected`**, queried per gap type via 8 composite markers (`gap.detected:{gapType}`) and summed into a single combined timeline, since event history access returns timestamps only, not payloads.
- Both a recent-window sample and a historical sample of at least 5 events each are required before any trend is claimed.

**Note on output language:** the RFC's example phrasing references "sessions" (e.g., "over the last 30 sessions"). Session boundaries are not recoverable from timestamp-only event history, so this strategy reports over a fixed 30-day window instead, and states that explicitly in the insight summary rather than claiming an unverifiable session count.

### Confidence Calibration Approach

- **Evidence:** the recent-window combined gap timestamps
- **Required count:** 5
- **Baseline:** 0.75 — gap-frequency trends are more directly observable than inferred score trends, warranting a higher starting baseline than the Reasoning strategy below
- **Contradicts:** not currently set (no contradiction signal identified for this strategy)
- **Existing count:** historical evidence count, to avoid redundant re-surfacing

### Edge Cases and Failure Modes

- **Flat or noisy frequency change:** no insight generated unless the relative change between recent and historical density exceeds a significance threshold, to avoid reporting normal variation as a trend.
- **Multiple gap types changing simultaneously:** correctly aggregated into one combined signal rather than producing duplicate or conflicting insights.
- **New users with no historical baseline:** no insight, since a trend requires evidence on both sides of the comparison window.
- **Directional symmetry:** the strategy reports both improving (declining frequency) and declining (rising frequency) trends, framed constructively in either direction.

---

## Strategy B: `V1GapResolutionEvaluator`

**Domain:** Gap

### Signal Hypothesis

Users under-specify certain categories of context in their prompts at different, individually measurable rates. The taxonomy defines 8 gap types: `intentionality`, `audience`, `constraint`, `stakes`, `assumption`, `mechanism`, `temporal`, `second_order`. Some recur across many sessions ("chronic") while others appear once and resolve. Surfacing which gap types are chronic — and which have measurably improved — gives the user specific, actionable self-knowledge (e.g., *"You consistently miss audience specification — this gap has appeared in 78% of your sessions"*).

### Evidence Requirements and Expected Event Types

- **`gap.detected`** — `{ gapType, confidence }`. A single prompt can emit multiple `gap.detected` events (one per gap type crossing the detection threshold); aggregation groups by session and gap type rather than assuming one gap per prompt.
- **`ghosttext.accepted`** — used to infer resolution. There is no direct event-to-event link between a specific gap and the ghost-text suggestion it produced; resolution is inferred by session + gap type + time-window proximity, consistent with how the Ghost Text Engine itself correlates gaps to suggestions.

**Aggregation:**
```
occurrenceRate(gapType)  = sessions containing gapType / total sessions
resolutionRate(gapType)  = inferred-resolved occurrences / total occurrences
trend                    = recent-window occurrenceRate vs. full-history occurrenceRate
```

### Confidence Calibration Approach

Fed into the standard `ConfidenceCalculator`:
- **Evidence:** matching `gap.detected` events for the candidate gap type
- **Required count:** 5 sessions minimum (matches the Insight Validator's evidence-count floor)
- **Baseline:** scaled by `occurrenceRate` — a gap type present in 80%+ of sessions carries a higher baseline than one at 20%
- **Contradicts:** set when `resolutionRate` is trending upward, signaling the "chronic" framing may be outdated
- **Existing count:** prior insights already surfaced for this (user, gap type) pair, to avoid redundant re-surfacing

### Edge Cases and Failure Modes

- **Declining-but-still-present vs. genuinely static:** a gap type dropping from 90% to 10% occurrence needs different framing than one flat at 80% throughout — evaluated by comparing recent-window rate against full-history rate, not a single aggregate number.
- **Multiple co-occurring gap types on one prompt:** handled by per-type aggregation rather than treating a single multi-gap prompt as inflating all types equally.
- **Resolution is inferred, not exact:** stated explicitly in the insight's own metadata rather than presented as a confirmed causal link.
- **Gap-free users:** no evidence produces no candidate, not a false "0% chronic" insight.

---

## Strategy C: `V1ReasoningDepthEvaluator`

**Domain:** Reasoning

### Signal Hypothesis

**Scope note:** the originally proposed design (a linear-regression trend over per-response `reasoningScore` values) was found not to be implementable during implementation — `ReasoningContext.getEventHistory()` returns event timestamps only, with no payload access, so `reasoningScore` cannot be retrieved per event through the current API. Rather than ship a strategy that claims to measure reasoning "depth" while actually measuring something else, this strategy was descoped to a frequency-based signal: the trend in how often the user has exchanges substantial enough to trigger full response analysis. This is an honest, working proxy for reasoning *engagement*, explicitly distinguished from reasoning *quality* in both the code and its output — and it should be upgraded to the original score-trend design once payload-level event access is available (see Implementation Dependency, below).

### Evidence Requirements and Expected Event Types

- **`response.analysis.completed`**, queried as a timestamp-only event history (no payload access currently available). A minimum of 5 events on each side of a 30-day comparison window is required before any trend is claimed.

**Trend detection:**
```
recentDensity   = count(events in the last 30 days) / days spanned
earlierDensity  = count(events before that) / days spanned
relativeChange  = (recentDensity - earlierDensity) / earlierDensity

if |relativeChange| below a significance threshold:
    no insight generated — change too small to be a meaningful trend
else:
    insight generated in the supported direction (increasing / decreasing
    engagement), framed descriptively, not evaluatively
```

### Confidence Calibration Approach

- **Evidence:** the recent-window `response.analysis.completed` timestamps
- **Required count:** 5 on both sides of the comparison window (matches the Insight Validator's real evidence floor)
- **Baseline:** set conservatively (0.6), reflecting the WS1 baseline finding that `ReasoningAnalyzer` is the lowest-accuracy of the four response analyzers on pure score error — an explicit, blanket acknowledgment of known upstream measurement uncertainty, applied uniformly rather than attempting to selectively discount individual data points (which would require exactly the payload access this strategy doesn't have)
- **Contradicts:** not currently set
- **Existing count:** prior reasoning-engagement insights surfaced to this user

### Edge Cases and Failure Modes

- **No historical baseline or no recent evidence:** no insight when either side of the comparison window falls below 5 events — a trend cannot be claimed from only one side of a comparison.
- **Flat or noisy frequency change:** no insight when the relative change between recent and historical density is too small to be meaningful.
- **Genuine short-term dip during difficult material:** framed descriptively as an observed change in engagement, not as a quality judgment — this strategy makes no claim about whether a decline is good or bad.

---

## Implementation Dependency (not a design issue — flagging for visibility)

All three strategies are designed against confirmed real event contracts, and have been implemented, self-tested, and verified against a 26-entry evaluation dataset run against the actual strategy code (not just described on paper).

Separately: the production context-builder that supplies real event history to strategies is not yet implemented — it currently returns a hardcoded placeholder for a single unrelated marker and an empty result for all others, including every event all three strategies above depend on. This is infrastructure outside this workstream's ownership boundary. None of the three strategies can produce live insights in production until it exists. Recommend this be tracked and assigned independently of this document's approval.

Separately, and specific to Strategy C: once payload-level event access exists, `V1ReasoningDepthEvaluator` should be revisited and upgraded from its current frequency-based signal to the originally intended `reasoningScore` trend design, which is the more valuable signal once it's implementable.