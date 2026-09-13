# Strategy Design Document — Insight Engine Expansion

**Workstream:** WS2 — Insight Strategy Design & Implementation
**Author:** Dhanya
**Status:** Submitted for review
**Strategies proposed:** `V1GapResolutionEvaluator` (Gap domain), `V1ReasoningDepthEvaluator` (Reasoning domain)

---

## Summary

The Insight Engine currently has one strategy, covering one of eight taxonomy domains. This document proposes two new strategies covering the Gap and Reasoning domains, each designed against the confirmed real event contracts and confidence-calibration mechanism already in production.

One implementation dependency was identified during design and is called out at the end of this document — it does not affect the validity of either design, but affects when either strategy can produce output in the live product.

---

## Strategy 1: `V1GapResolutionEvaluator`

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

## Strategy 2: `V1ReasoningDepthEvaluator`

**Domain:** Reasoning

### Signal Hypothesis

Rather than a flat average comparison of reasoning scores over time, this strategy applies a statistical trend test to determine whether reasoning depth in the responses a user receives is genuinely improving or declining — and calibrates its own confidence against the known reliability profile of its upstream data source, established during the Response Analyzer baseline evaluation (WS1).

### Evidence Requirements and Expected Event Types

- **`response.analysis.completed`** — `{ promptHash, structuralScore, reasoningScore, qualityScore, flags }`. `reasoningScore` is used directly as the trend signal.

**Trend detection:**
```
slope, R² = linearRegression(sessionOrderedReasoningScores)

if R² below significance threshold:
    no insight generated — data too noisy to support a trend claim
else:
    insight generated in the supported direction (improving / declining),
    framed descriptively, not evaluatively
```

A linear-regression approach over a naive before/after average avoids reporting a confident trend off 2-3 outlier scores in a small sample, and runs well within on-device latency constraints.

### Confidence Calibration Approach

- **Evidence:** `response.analysis.completed` events, using `reasoningScore`
- **Required count:** 5 (Insight Validator's real floor); the trend logic additionally requires a minimum R² before firing, so a technically-sufficient but statistically noisy 5-point sample does not produce a low-quality insight
- **Baseline:** set conservatively, reflecting the WS1 baseline finding that `ReasoningAnalyzer` is the lowest-accuracy of the four response analyzers on pure score error — an explicit, blanket acknowledgment of known upstream measurement uncertainty rather than an attempt to selectively discount individual data points
- **Contradicts:** set when the regression's confidence interval is wide relative to the slope
- **Existing count:** prior reasoning-depth insights surfaced to this user

### Edge Cases and Failure Modes

- **Insufficient or statistically noisy evidence:** no insight below the evidence floor, and no insight when R² is too low even above it.
- **Genuine short-term regression during difficult material:** framed descriptively, not as a concerning decline.
- **Trend-reversal sensitivity:** hysteresis applied so a slope oscillating near zero doesn't re-trigger a new insight every session.

---

## Implementation Dependency

Both strategies are designed against confirmed real event contracts and are ready for implementation and self-testing against injected evaluation fixtures, consistent with this workstream's required mock-based evaluation dataset.

Separately: the production context-builder that supplies real event history to strategies is not yet implemented — it currently returns a hardcoded placeholder for a single unrelated marker and an empty result for all others, including the events both strategies above depend on. This is infrastructure outside this workstream's ownership boundary. Neither strategy can produce live insights in production until it exists. Recommend this be tracked and assigned independently of this document's approval.