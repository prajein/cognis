# Post-M11 / M12 Readiness Boundary

**IMPORTANT:** This is a readiness and design-boundary document, NOT an implementation plan. M12 is currently BLOCKED pending statistical evidence from M11.

## M12 Objective
To prove that intervention preference is dependent on interaction context, and to adapt Ghost Text suppression independently per context (e.g., suppressing in Context A while remaining active in Context B for the same user and GapType).

## Current Architectural Starting Point (Post-M11)
- **Adaptation:** `GhostTextAdaptor` suppresses based on a global `profileId::gapType` key.
- **Persistence:** `AdaptationPreferenceRepository` stores global cross-session aggregate evidence.
- **Measurement:** `GhostTextMeasurementObserver` securely extracts LCP/LCS behavioral deltas post-dismissal.
- **Telemetry:** `ghosttext.measurement.computed` contains retrospective context (`origin`, `domRole`). Context is currently unavailable at generation time.

## Proposed Design Boundary
If and when M12 is implemented, the architecture must abide by the following boundaries:
1. **Context Abstraction:** Context must be abstracted to a deterministic `InteractionClass` (e.g., `CHAT`, `LONG_FORM`) provided by the Platform Layer, rather than relying on raw `origin + domRole` which fragments excessively.
2. **Proactive Context:** Context must be attached to the `ghosttext.requested` or `ghosttext.generated` events. The `GhostTextAdaptor` cannot adapt to context if it is only observed after a dismissal.
3. **Storage Separation:** A new `ContextualPreferenceStore` must be created. The existing M10 Global Store must remain untouched as a fallback.

## Components Likely to Change
- `PlatformConfig` / Platform Adapters (to inject `InteractionClass` or `ContextId`).
- `GhostTextEngine` (to forward context on generation events).
- `GhostTextAdaptor` (to query contextual storage first, then global storage).
- `AdaptationPreferenceRepository` (to manage dual-tier persistence: Global vs Contextual).

## Invariants That Must Survive
- **M9 Reversibility:** Probing loops must still function per context.
- **M10 Data Integrity:** Existing global preferences must not be maliciously migrated into fabricated contexts. Existing users must retain their established suppression states as global defaults.
- **M11 Measurement:** The `GhostTextMeasurementObserver` must continue to measure purely observable features without injecting causal labels.

## Evidence Required (To Unblock M12)
M12 cannot begin implementation until M11 telemetry proves the underlying hypothesis. We require:
1. Significant variance in behavioral signatures (`editDistance`, rejection rates) across two distinct contexts for the *same* user and *same* `GapType`.
2. A large enough sample size (e.g., N > 50 interventions per context) to rule out noise, suggestion quality, or task complexity as the driving factors.

## Unresolved Decisions
- What is the exact taxonomy of `InteractionClass`? (e.g., `Chat`, `Document`, `Code`, `Form`).
- How much fractional weight should a contextual dismissal apply to the Global M10 Store?
- Should global probes randomly sample across all contexts, or be restricted to contexts where the user is currently suppressed?

## Explicit Things M12 Must NOT Implement
- **NO ML / Heuristics:** M12 must not attempt to infer context automatically via DOM structure analysis. Context mapping must remain deterministic and explicitly configured.
- **NO M10 Data Mutation:** M12 must not run a migration that rewrites M10 global preference records into contextual records.
- **NO Upstream Causal Claims:** M12 must not label telemetry as "bad suggestion" vs "dislikes ghost text". It must only react to empirical continuation distances.
