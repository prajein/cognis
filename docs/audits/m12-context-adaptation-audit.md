# M12 Context-Aware Adaptation: Pre-Implementation Architectural Audit

## 1. Executive Verdict
**M12 HYPOTHESIS IS NOT CURRENTLY TESTABLE**

M12 is premature. The architecture cannot safely support context-aware adaptation because the current contextual telemetry (`origin` + `domRole`) is insufficient, highly susceptible to fragmentation, and critically, only available *after* an intervention is dismissed. Furthermore, we lack the foundational M11 data required to prove that user preferences actually partition meaningfully by context.

## 2. Verified M11 Capabilities
M11 successfully introduced the `ghosttext.measurement.computed` event, safely extracting LCP/LCS text deltas and computing normalized `editDistance` and `lexicalOverlap`. It isolates measurement from adaptation. However, M11 context is purely retrospective.

## 3. Context Telemetry Audit
**M11 -> M12 Boundary Analysis:**
M11 captures `origin` (e.g., `https://chatgpt.com`) and `domRole` (e.g., `textarea[role=textbox]`).
- **Is this sufficient?** No. `origin` is too broad (an app can have multiple completely different surfaces), while `domRole` is too fragile (a minor UI update breaks the identity).
- **Cross-platform grouping:** If a user uses ChatGPT and Claude, `origin` buckets them separately, preventing the system from learning a unified "Chat UX" preference.
- **Conclusion:** The current telemetry cannot support a scientifically defensible context definition. We require a `NormalizedInteractionClass` (e.g., `CHAT`, `LONG_FORM_EDITOR`, `CODE`) supplied by the `PlatformConfig`.

## 4. Challenge the Core M12 Hypothesis
**Hypothesis:** *A user's intervention preference varies by context.*
**Counterargument:** Preference variation observed across origins might actually be driven by **Suggestion Quality** or **Task Complexity**, not the context itself. If our Ghost Text engine performs poorly on coding tasks (StackOverflow) but well on writing tasks (Notion), M12 will misattribute this as "User dislikes Ghost Text on StackOverflow" rather than "Our coding suggestions are bad." M12 risks masking underlying model quality issues by hiding them in contextual preference buckets.

## 5. M10 Persistence Compatibility
If M12 is eventually implemented:
- **Option C** (Keep M10 schema unchanged, introduce a separate contextual store) is the only viable path.
- Existing M10 records represent a **Global Prior**. If we migrate them into a specific context (or a "default" context), we manufacture evidence. 
- **Migration Strategy:** Leave M10 untouched. The `GhostTextAdaptor` must query the `ContextualStore`. If evidence is insufficient (or context is new), it falls back to the M10 `GlobalStore`.

## 6. Event Architecture Analysis
**Critical Flaw:** M11 attaches `context` to `ghosttext.measurement.computed`.
M12 requires the `GhostTextAdaptor` to make suppression decisions *before* an intervention is shown. Therefore, the `GhostTextEngine` or perception layer MUST attach the `contextId` to the `ghosttext.requested` or `ghosttext.generated` event. The current event architecture cannot support proactive context-aware suppression without upstream modifications to the perception layer.

## 7. Adaptation-State Implications
- Contextual states (`ACTIVE`, `SUPPRESSED`, `PROBING`) must remain orthogonal.
- A user suppressed in `Context A` who enters `Context B` for the first time must inherit their **Global State** (M10).
- Evidence generated during a probe in `Context A` should primarily update `Context A`'s store, but also contribute a fractional weight to the Global M10 store to prevent global stagnation.

## 8. Context Fragmentation Risks
Naïvely using `origin + domRole` will cause explosive fragmentation. A user's preference profile will shatter into dozens of micro-contexts, preventing the adaptation engine from ever accumulating enough statistical significance to suppress or probe. 
**Recommended Abstraction:** `InteractionClass` (e.g., `CHAT`, `EDITOR`).

## 9. Scientific / Falsification Analysis
To justify building M12, we must first prove the hypothesis using M11 data.
**Required Evidence:**
1. A statistically significant divergence in `editDistance` or rejection rates for the *same* user and *same* `GapType` across two distinctly identified contexts.
2. The divergence must be stable over a minimum threshold of observations (e.g., N > 50).
Without this proof, M12 is just building buckets for noise.

## 10. Final Recommendation
**BLOCK M12.**
Do not modify the persistence layer or `GhostTextAdaptor`. M11 must run in production to gather the aforementioned evidence. In the meantime, the perception layer must be upgraded to emit deterministic `InteractionClass` metadata *before* generation occurs.
