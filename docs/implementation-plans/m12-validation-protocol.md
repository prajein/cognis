# Adversarial Review of M12 Validation Protocol

This document serves as a hostile statistical and architectural review of the proposed M12 validation protocol. Its purpose is to ensure that Cognis does not mistakenly build a persistent contextual adaptation layer based on statistical illusions, unverified causal assumptions, or arbitrary thresholds.

## 1. The `suggestionConfidence` Fallacy
The previous protocol proposed using a model-derived `suggestionConfidence` score to mathematically isolate suggestion quality from user preference. **This is a scientific error.** A model's confidence or entropy is not equivalent to ground-truth suggestion quality. A model can be highly confident in a terrible suggestion, or uncertain about a brilliant one. Controlling for confidence merely controls for a generation artifact; it does not prove that "quality" has been held constant.
**Correction:** Rename this metric to `generationConfidence`. Treat it strictly as an exploratory covariate, not a validated quality control. M12 must never claim to have mathematically isolated suggestion quality based on this variable alone.

## 2. The Probe Acceptance Fallacy
The previous protocol positioned "M9 Probe Acceptance" as a pure, unconfounded measure of preference. **This is false.** A probe is still Ghost Text. The causal path `Context A → altered probe generation quality → altered probe acceptance` remains entirely possible.
**Correction:** Probe acceptance is a valuable outcome, but it is not ground-truth preference. It must be strictly classified as: *Probe acceptance conditional on comparable probe-generation characteristics.*

## 3. The Missing Within-User × Context Interaction
The previously proposed GLMM included a random intercept for `User ID`. This only models the fact that "some users are generally more hostile than others." It does NOT answer the core M12 question: *Does the SAME user respond differently to the SAME GapType across DIFFERENT contexts?*
**Correction:** The statistical model must explicitly test the `User × Context` interaction (or a random slope for context). If the variance is purely population-level (e.g., all users accept less in `Context B`), then context is just a proxy for task difficulty, not a split in individual user preference. M12 requires proving **within-user contextual divergence**.

## 4. The Arbitrary Thresholds Problem
Specifying `K=20` observations or a "20% relative difference" as the threshold for unblocking M12 is statistically ungrounded. These numbers cannot be declared as validated requirements without knowing the baseline variance.
**Correction:** The protocol must follow a rigorous sequence:
1. **Pilot Study:** Gather unstructured M11 data.
2. **Estimate Variance:** Determine the within-user and between-user variance for edit distance and acceptance.
3. **Define Minimum Meaningful Effect:** Calculate what effect size would actually alter adaptation state.
4. **Powered Confirmatory Study:** Run the actual M12 hypothesis test.

## 5. The Predictive Architectural Question (M12 vs M10)
Even if we prove that `Context A ≠ Context B` with perfect statistical significance, **that does not prove M12 is worth building.** Splitting state introduces cold starts, storage explosion, and evidence fragmentation. 
If the M10 Global Preference model predicts future behavior with 72% accuracy, and an M12 Contextual model predicts it with 73% accuracy, M12 is architectural bloat. M12 is only justified if it *materially improves prediction* over M10 (e.g., 61% vs 82%).
**Correction:** The final validation step must be a model comparison. Does a context-aware model predict the next intervention's outcome significantly better than the existing global M10 model? This comparison must be **explicitly out-of-sample**. It must be tested on held-out future interventions or users to ensure the contextual model isn't merely overfitting due to having more degrees of freedom.

## 6. Premature Taxonomy (`InteractionClass`)
The previous protocol demanded the creation of a deterministic `InteractionClass` taxonomy *before* statistical validation. This is dangerous. If we manually map `origin + domRole` to an `InteractionClass`, and then find a statistical difference, we might just be measuring the artifact of our own taxonomy.
**Correction:** 
- **Phase A (Exploratory):** Use existing raw `origin + domRole` to determine if *any* contextual heterogeneity exists.
- **Phase B (Taxonomy):** If and only if heterogeneity exists, define `InteractionClass`.
- **Phase C (Validation):** Test whether `InteractionClass` explains the behavioral variance better than raw origin.

---

# Revised Minimal Validation Gate for M12

Do not write code for M12. Do not introduce new database schemas. M12 remains **BLOCKED** until this precise evidence gate is passed.

### M12 UNBLOCKED only if:

1. **Within-user divergence exists:** The data proves that the *same* user behaves differently toward the *same* GapType across different contexts.
2. **Confounding is constrained:** The divergence survives adjustment for observable covariates (e.g., `baselineTextLength`, `generationConfidence`), acknowledging that true quality remains partially unobserved.
3. **The effect is practically significant:** The divergence is large enough to actually flip adaptation behavior (e.g., ACTIVE in Context A, SUPPRESSED in Context B).
4. **The effect is repeatable:** The divergence is consistent across a large portion of the user base, not driven by a few hyper-active outliers.
5. **Predictive Superiority:** Contextual state *materially improves prediction* of future intervention behavior compared to the existing M10 global model, evaluated strictly **out-of-sample** on held-out data.
6. **Data Density:** Cross-context data density is naturally sufficient to avoid severe cold-start fragmentation.
7. **No Plausible Falsification:** No major unmeasured confounder remains plausible enough to invalidate the interpretation of the results.

### M12 REMAINS BLOCKED if:
1. Contextual divergence is primarily population-level rather than within-user.
2. The predictive accuracy of the contextual model is marginally better or worse than the M10 global model.
3. Users do not generate enough cross-context data to overcome cold starts, meaning M12 would just force most users into an un-adapted default state.
