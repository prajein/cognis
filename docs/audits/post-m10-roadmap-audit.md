# Post-M10 Architectural Audit & Roadmap Definition (Revised)

**Date:** 2026-08-10
**Role:** Principal Engineer / Architecture Auditor
**Target:** M11-M14 Roadmap Planning

---

## 1. Executive Verdict
Milestone 10 successfully transitions Cognis from a session-amnesic script into a system with durable behavioral memory. However, the system's "intelligence" remains strictly localized and deterministic. 

The initial roadmap proposed moving directly to **Multi-Signal Personalization** (generalizing rejections across all gap types). **This is scientifically flawed.** Our current telemetry cannot distinguish *why* a user rejected an intervention. If we generalize rejections blindly, we risk assuming the user "hates interventions" when in reality our ghost text generation might just be terrible. We must halt personalization until we can accurately measure the behavioral signatures of a rejection.

---

## 2. Verified Architectural State (M7–M10)

| Area | Status | Classification | Details |
|---|---|---|---|
| **Response Measurement (M7)** | Active | **FACT** | `ResponseIntelligenceEngine` captures metrics and correlates them to sessions. |
| **Local Adaptation (M8/M9)** | Active | **FACT** | `GhostTextAdaptor` manages `ACTIVE\|SUPPRESSED\|PROBING` state transitions per `GapType`. |
| **Probe Attribution (M9)** | Active | **FACT** | Probes use `activeProbeInterventionId` to prevent fabrication from stray events. |
| **Persistent User Model (M10)** | Active | **FACT** | `adaptation_preferences` IndexedDB store durably records explicit rejections, exposures, and acceptances. |

---

## 3. The Flaw in the Telemetry (Why M11 Personalization fails)

Can existing telemetry distinguish between the following rejection cases?

1. **Intervention preference** (“Don't interrupt me.”)
2. **Intervention quality** (“This suggestion was bad.”)
3. **Context mismatch** (“This suggestion might be useful, but not here.”)
4. **Task state** (“I already knew what I wanted to say.”)

**Audit Finding: NO.** 
The current `ghosttext.dismissed` event captures `reason: 'continued_typing' | 'caret_moved'`. We also know the proposed `stem`. However, we have absolutely no telemetry measuring the distance between the proposed `stem` and what the user *actually* typed immediately afterward. Furthermore, none of the prompt or ghost text events capture environmental metadata (DOM element, URL context). 

Therefore, every rejection is currently lumped into a single bucket. If we generalize this bucket (as originally proposed), Cognis will “learn” that the user hates AI assistance, when the actual truth might be that our prompt engineering for the `audience` gap is just yielding poor completions.

---

## 4. Strongest Counterarguments to the "More Adaptation" Trajectory

**"More adaptation" built on noisy attribution is a downward spiral.**
If we build complex multi-signal personalization on top of an unresolved quality vs. preference conflation, we will amplify errors. The system will aggressively suppress features to optimize for "least annoyance," but it won't actually know if it's improving the user experience or just hiding its own bad generations. 

**The requirement before personalization:**
We must build attribution and measurement infrastructure capable of extracting *measurable features* associated with intervention aversion versus poor suggestion quality.

---

## 5. Proposed M11–M14 Roadmap (Finalized)

The roadmap answers: *What does Cognis need to prove next to move from a deterministic adaptive system into a genuinely robust cognitive system?*

### **M11: Attribution & Measurement (The Missing Link)**
* **Purpose**: Measure and capture the observable behavioral signatures surrounding an intervention rejection without changing adaptation behavior.
* **Core Claim**: Cognis can measure and classify observable rejection patterns using intervention content, subsequent user behavior, and interaction context, creating stronger evidence for distinguishing likely causes of rejection.
* **Architectural Change**: Enrich telemetry to record environmental context and raw measurable features (e.g., continuation latency, lexical overlap, edit distance between stem and typed text). Do not prematurely force causal labels.
* **Falsification**: If extracted features (like stem-to-actual-text distance or continuation latency) show uniform random distributions across all dismissals with no measurable clusters, then the distinctions cannot be inferred from passive inline telemetry.

### **M12: Context-Aware Adaptation**
* **Purpose**: Prove preference is dependent on the environment, using M11's enriched metadata.
* **Core Claim**: Cognis can maintain diverging preferences for the same feature across different contexts (e.g., long-form prose vs. short-form inputs).
* **Architectural Change**: Expand the persistence key to `profileId::context::gapType`.
* **Falsification**: If preferences remain identical across all contexts, context-awareness is unnecessary overhead.

### **M13: Closed-Loop Outcome Optimization**
* **Purpose**: Connect M7 (Quality) with M10 (Adaptation).
* **Core Claim**: Cognis adapts to maximize user success, not just to minimize intervention rejection.
* **Architectural Change**: `GhostTextAdaptor` subscribes to M7 `InsightEvents` (quality metrics) to weigh suppression decisions. If quality drops when suppressed, it forces a probe.
* **Falsification**: If incorporating quality metrics results in lower user retention/satisfaction due to annoyance, then immediate preference trumps output quality.

### **M14: Multi-Signal Personalization (Generalization)**
* **Purpose**: Only now that we have strong evidentiary backing distinguishing true *intervention aversion* from quality and context noise, we can safely generalize that aversion across features.
* **Core Claim**: Cognis can infer a global "intervention tolerance" cleanly extracted from noise.
* **Architectural Change**: A global evaluator reading filtered `PersistedGapPreference` records to adjust global threshold multipliers.
* **Falsification**: If users reject proactively suppressed features at the same rate anyway, global generalization fails.

---

## 6. What explicitly should NOT be built yet

* **Global Personalization**: Deferred to M14. We cannot generalize preferences until we can prove we are actually measuring preferences, not just generation failures.
* **Causal Classification Systems**: We must not prematurely build semantic analyzers that attempt to assert *why* a user rejected text. M11 must strictly output raw, observable data.
* **Control Loop Changes**: M11 is a measurement-only milestone. It must not alter suppression logic.

---

## 7. Recommended M11 Starting Point

**M11 (Attribution & Measurement) is the required next step.**
We must update the event contracts (`GhostTextDismissedPayload`, `PromptTypedPayload`, etc.) and the perception layer to capture the context and text deltas necessary to construct behavioral signatures. M11 must improve the *quality of the evidence*, not change adaptation behavior yet.
