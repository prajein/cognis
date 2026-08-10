# M11 → M12 Statistical Validation Audit

## 1. Executive Verdict
**M12 REQUIRES ADDITIONAL MEASUREMENT**

The M12 hypothesis is not completely identifiable with the current M11 telemetry. While M11 provides rigorous post-dismissal behavioral metrics (edit distance, lexical overlap), it lacks the necessary control variables to distinguish *context-dependent preference* from *context-dependent suggestion quality*. A statistical protocol can be designed, but it requires minor additions to the telemetry and a dedicated observational pilot before M12 architecture is justified.

## 2. Actual M11 Telemetry Inventory
| Variable | Available? | Granularity | Reliable? | Useful for M12? |
| --- | --- | --- | --- | --- |
| user/profile | Yes | Session ID / Profile ID | Yes | Yes (for repeated measures) |
| GapType | Yes | per-intervention | Yes | Yes |
| interventionId | Yes | per-intervention | Yes | Yes |
| context/origin | Yes | Domain string | Yes | No (too noisy/coarse) |
| DOM role | Yes | HTML tag + ARIA role | Yes | No (too fragile) |
| dismissal reason | Yes | String enum | Yes | Yes |
| continuation latency | Yes | milliseconds | Yes | Yes |
| lexical overlap | Yes | Jaccard [0,1] | Yes | Yes |
| edit distance | Yes | Levenshtein integer | Yes | Yes |
| typed length | Yes | integer | Yes | Yes |
| stem length | Yes | integer | Yes | Yes |
| session ID | Yes | UUID | Yes | Yes |
| timestamp | Yes | event timestamp | Yes | Yes |
| acceptance | No* | (Tracked by M7, not M11) | Yes | Yes |
| rejection | No* | (Implied by M8/M11 events) | Yes | Yes |

**Critical Missing Variables:**
- **Baseline Document Length:** M11 captures `baselineText` but discards it without measuring length. We cannot control for "document length/task maturity."
- **Suggestion Quality Proxy:** No confidence score or model entropy is passed down. We cannot mathematically rule out "the model generates worse suggestions in this context."

## 3. Challenge the Context Variable
`origin` and `domRole` do not constitute a valid experimental context. 
- **Origin** is too broad (GitHub contains code editors, search bars, and PR comment boxes) and too specific (Google Docs vs Notion represent the same interaction but different origins).
- **domRole** is fragile and provides zero semantic meaning (`textarea` is ubiquitous).
A deterministic `InteractionClass` (e.g., `CHAT`, `LONG_FORM_EDITOR`) is mandatory to solve fragmentation, but it does *not* solve confounding. If Ghost Text is systematically worse at predicting code than prose, users will reject it more in the `CODE` InteractionClass. M12 would misinterpret this as "aversion to Ghost Text in code" rather than "poor code generation."

## 4. Define the Unit of Analysis
The correct statistical unit is **User × Context × GapType**.
Treating individual interventions as independent observations is statistically invalid due to severe pseudoreplication. A user generating 1,000 dismissals in Context A does not equal 1,000 independent signals of preference. Observations must be aggregated (or modeled hierarchically) at the user level to compare *within-user* variance across contexts.

## 5. Define the Primary Outcome
**Do not use raw rejection rate.** Rejection is heavily confounded by suggestion quality.
**Primary Outcome:** **Probe Acceptance Probability.**
If a user is suppressed in both Context A and Context B, but they accept M9 probes in Context A and universally reject them in Context B, this strongly isolates *preference/aversion* over *quality*.
**Secondary Outcome:** Normalized Edit Distance (to distinguish between "hated the suggestion" vs "wanted to type it themselves").

## 6. Confounder Analysis
| Confounder | Observable in M11? | Can control for it? | Residual risk |
| --- | --- | --- | --- |
| suggestion quality | No | No | **HIGH** |
| task complexity | No | No | **HIGH** |
| text length | No | No (baseline length missing) | MEDIUM |
| input type | Yes (`domRole`) | Partially | MEDIUM |
| application | Yes (`origin`) | Yes | LOW |
| session effects | Yes (`sessionId`) | Yes (mixed models) | LOW |
| user behavior | Yes (`profileId`) | Yes (random intercept) | LOW |
| GapType | Yes | Yes (stratification) | LOW |

## 7. Design the Minimum Evidence Protocol
Because baseline variance is unknown, we cannot arbitrarily require "N=50". We require a **Pilot Study** to estimate variance, followed by a powered study.
- **Population:** Active users with at least $K$ interventions in *both* Context A and Context B.
- **Comparability:** Comparisons must strictly pair the *same* user and *same* GapType across the two contexts.
- **Sample Size:** Must be powered to detect a 20% relative difference in Probe Acceptance Probability or Normalized Edit Distance, using the intra-class correlation (ICC) derived from the pilot.

## 8. Statistical Method
A **Hierarchical Generalized Linear Mixed Model (GLMM)**.
- **Fixed Effects:** Context (`InteractionClass`), `GapType`.
- **Random Effects:** User ID (random intercept).
A naïve t-test is strictly forbidden as it ignores within-user correlation. A paired non-parametric test (Wilcoxon) on user-aggregated marginal means is an acceptable fallback.

## 9. Define "Contextual Divergence"
M12's hypothesis is proven ONLY IF:
1. The GLMM shows a statistically significant fixed effect for Context ($p < 0.05$).
2. The practical effect size is large enough to routinely cross the M8 suppression thresholds (e.g., $\Delta > 0.2$ in acceptance probability). If the difference is 5% vs 7%, both lead to suppression, making the contextual split architecturally useless.

## 10. Distinguish Three Possible Outcomes
- **A. Contextual preference supported:** Significant, practical divergence found. *Proceed to M12.*
- **B. No contextual effect detected:** Variance is primarily between users, not between contexts. *Kill M12.*
- **C. Context effect is confounded:** Differences exist, but perfectly correlate with unobserved suggestion quality. *Block M12.*

## 11. Challenge the Entire M12 Roadmap
Even if behavior differs, splitting persistence by context introduces severe risks:
- **Storage Explosion:** $N$ users $\times M$ GapTypes $\times C$ contexts.
- **Cold Starts:** Every time a user enters a new context, they suffer the default experience until suppressed, annoying the user and wasting inference.
- **Underutilization:** Global M10 evidence becomes heavily fragmented, reducing the system's ability to generalize.
M12 must prove that splitting the state actually *improves user experience* (by keeping helpful Ghost Text active in Context A while suppressing it in Context B), rather than just "storing data more accurately."

## 12. Define the M12 Gate
**M12 UNBLOCKED only if:**
1. A GLMM proves significant within-user behavioral divergence across deterministic `InteractionClasses`.
2. The effect size is large enough to necessitate different binary adaptation states (`ACTIVE` vs `SUPPRESSED`).
3. Suggestion quality confounding is mathematically isolated or controlled.
4. The Perception Layer is upgraded to proactively emit `InteractionClass` prior to generation.

**M12 REMAINS BLOCKED if:**
1. Divergence is indistinguishable from noise or suggestion quality.
2. The practical effect size does not alter the resulting adaptation state.
3. Users do not naturally generate enough cross-context data to overcome cold starts.

## 13. Additional Telemetry Requirements
Before the statistical validation protocol can begin, the following must be added to telemetry:
1. `baselineTextLength`: To control for document maturity.
2. `InteractionClass`: A deterministic taxonomy (e.g., `CHAT`, `LONG_FORM`) provided by the platform adapter.
3. `confidenceScore`: A model-derived proxy for suggestion quality attached to `ghosttext.generated`, enabling the model to control for "bad suggestions."

## 14. Final Verdict
**M12 REQUIRES ADDITIONAL MEASUREMENT**
We cannot scientifically justify context-aware adaptation with the current telemetry. M12 must remain blocked while we add the missing control variables, execute the pilot study, and measure true contextual divergence.
