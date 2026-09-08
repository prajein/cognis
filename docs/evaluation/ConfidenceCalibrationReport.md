# Confidence Calibration Report

**Workstream:** WS3 — Confidence Calculator Calibration Study
**Status:** DRAFT — submitted for review. No changes to `ConfidenceCalculator.ts` have been made.
**Companion document:** `AlternativeDecayStrategies.md`

---

## 1. Method

18 scenarios were run against the real `ConfidenceCalculator.calculate()`, each with a human-judged expected confidence range representing what a reasonable output should look like for that evidence pattern. Scenarios specifically targeted the two decay boundaries (30 and 90 days) and the contradiction-penalty boundary (2x evidence ratio), since discontinuities are most visible exactly at threshold crossings.

**Result: 15 of 18 scenarios (83%) fell within the expected range.** The 3 that didn't all cluster around the same root cause — the stepped decay function's discontinuities — and are detailed below with exact numbers.

---

## 2. The 30-day discontinuity

| Age | Confidence | 
|---|---|
| 29 days | 0.800 |
| 31 days | 0.400 |

**A 2-day difference in evidence age produces a 50% relative drop in confidence.** Identical evidence — same count, same strategy, same baseline — loses half its weight for crossing midnight on day 30. This is not a gradual decline reflecting genuinely lower certainty; it's an artifact of the stepped function's boundary.

## 3. The 90-day discontinuity — more severe

| Age | Confidence |
|---|---|
| 89 days | 0.400 |
| 91 days | 0.080 |

**A 2-day difference produces an 80% relative drop.** This is worse than the 30-day cliff in relative terms, and lands at a value (0.08) that would fail `InsightValidator`'s 0.75 confidence threshold by a wide margin even for a strategy with a strong 0.8 baseline — meaning evidence that's 89 days old could pass validation while evidence that's 2 days older, from the same pattern, cannot.

## 4. Interaction between decay and the contradiction penalty

| Scenario | Confidence |
|---|---|
| New evidence 1.9x old evidence count | 0.480 |
| New evidence 2.0x old evidence count | 0.800 |

**A 40% relative jump exactly at the 2x line**, compounding the same discontinuity problem in a second dimension. More importantly, a distinct correctness question was surfaced: `weightedEvidenceCount` (age-decayed) is compared against `existingEvidenceCount * 2`, where `existingEvidenceCount` is passed in as a raw, undecayed number by the calling strategy. In a constructed scenario with 20 raw new events all aged 95 days (weighted count = 2.0, since each carries only 10% weight) against an existing count of 10, the comparison evaluates as `2.0 < 20` — the penalty applies — despite the new evidence having twice the raw event count of the old. **Whether this asymmetry (decayed vs. undecayed comparison) is intentional or an oversight could not be determined from the code alone** and is worth a direct question to whoever wrote the original contradiction logic, since both a "yes, intentional" and "no, bug" answer are plausible and change the corrective action.

---

## 5. Impact on `InsightValidator`'s 0.75 threshold

Given the confirmed real threshold (`MINIMUM_CONFIDENCE = 0.75`), the 30-day cliff is directly consequential: a candidate insight with baseline 0.8 evidence at 29 days (confidence 0.8, passes) would be rejected outright at 31 days (confidence 0.4, fails) — for evidence a human would consider essentially equally strong. The 90-day cliff has a smaller practical impact on this specific threshold, since 0.4 already fails validation regardless of the drop to 0.08 — but it matters for any strategy with a lower baseline where the 89-day value might still have cleared 0.75 initially.

**Concretely, for the three WS2 strategies:** `V1GapResolutionEvaluator`'s chronic-gap baseline (0.8) sits exactly at the point where the 30-day cliff would flip a passing insight to failing, if any of its evidence ages past 30 days between generation and validation — worth checking whether that's a realistic timing scenario in production.

---

## 6. Recommendation

Do not attempt to fix the discontinuities by hand-tuning the existing stepped thresholds — the problem is structural (a step function inherently has cliffs somewhere), not a matter of choosing better cutoff days. See `AlternativeDecayStrategies.md` for smooth-decay alternatives that avoid this class of problem entirely, with a specific recommendation.

The decayed-vs-undecayed contradiction comparison (Section 4) should be resolved as a design decision before any decay-curve change is implemented, since changing the decay curve changes `weightedEvidenceCount`'s scale and would shift this interaction's behavior regardless of which decay alternative is chosen.
