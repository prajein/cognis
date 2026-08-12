# Post-M10 High-Level Roadmap (Finalized)

This document outlines the high-level sequence of remaining milestones for Cognis based on the finalized Post-M10 architectural audit. 

---

## 1. M11: Attribution & Measurement (The Missing Link)
* **Purpose**: Measure and capture the observable behavioral signatures surrounding an intervention rejection to improve evidence quality, without altering adaptation behavior.
* **Core Claim**: Cognis can measure and classify observable rejection patterns using intervention content, subsequent user behavior, and interaction context, creating stronger evidence for distinguishing likely causes of rejection.
* **Main Architectural Change**: Enrich telemetry (e.g., `PromptTypedPayload`, `GhostTextDismissedPayload`) with environmental context (URL, DOM role) and introduce systems to compute raw measurable features (lexical overlap, continuation latency, edit distance) between the rejected stem and the user's subsequent input.
* **Evidence Required**: Telemetry showing distinct, measurable clusters of rejection patterns (e.g., high lexical overlap + low latency vs low overlap + high latency).
* **Exit Criteria**: Every eligible dismissal receives an observable attribution profile with measurable features and an explicit confidence/unknown state; the system does not force a causal label when telemetry is insufficient.

## 2. M12: Contextual Intervention Selection
* **Purpose**: Prove that user preferences are dependent on the interaction environment.
* **Core Claim**: Cognis maintains context-dependent preferences (e.g., aggressive autocomplete in an IDE, none in an email) rather than a single universal setting.
* **Main Architectural Change**: Expansion of the persistent model key to `profileId::contextId::gapType`, leveraging the context tags added in M11.
* **Evidence Required**: Measurement showing divergent preference states for the same `GapType` across different contexts for the same user.
* **Exit Criteria**: The system can simultaneously hold an `ACTIVE` state for a gap in Context A and a `SUPPRESSED` state for the same gap in Context B.

## 3. M13: Closed-Loop Outcome Optimization
* **Purpose**: Connect adaptation logic to actual outcome quality (M7 metrics), preventing the system from optimizing purely for "least annoyance" at the expense of "best output."
* **Core Claim**: Cognis adapts to maximize user success, not just to minimize intervention rejection.
* **Main Architectural Change**: `GhostTextAdaptor` subscribes to M7 `InsightEvents`. The policy weights suppression decisions against post-intervention response quality metrics.
* **Evidence Required**: Telemetry proving that outcome-based adaptation yields statistically better user text quality than pure rejection-based adaptation.
* **Exit Criteria**: The system triggers a probe for a `SUPPRESSED` feature if background analysis detects a sustained drop in output quality that correlates with the suppression.

## 4. M14: Multi-Signal Personalization (Generalization)
* **Purpose**: Synthesize true intervention aversion into a global profile, generalizing preference across unseen features.
* **Core Claim**: Having isolated noise via M11-M13, Cognis can infer a global "intervention tolerance" and proactively adjust policies for unseen features without requiring explicit rejection training per feature.
* **Main Architectural Change**: A global policy evaluator that aggregates across all `PersistedGapPreference` records (filtered by attribution type) to dynamically scale suppression thresholds.
* **Evidence Required**: Telemetry showing that globally-adjusted thresholds accurately predict user rejection behavior on new gap types.
* **Exit Criteria**: A new gap type is suppressed faster for a user with a verified history of intervention aversion, compared to a fresh user.

---

*Note: Proceeding to M11 requires explicit authorization. Do not begin implementation without a detailed, approved implementation plan.*
