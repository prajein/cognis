# Alternative Decay Strategies

**Workstream:** WS3 — Confidence Calculator Calibration Study
**Status:** DRAFT — research and simulation only. No changes to `ConfidenceCalculator.ts` have been made.
**Companion document:** `ConfidenceCalibrationReport.md`

---

## 1. Method and an honest caveat about the comparison metric

Each alternative below was simulated offline against the real 18-scenario calibration dataset, keeping the volume-multiplier and overall structure identical to the real `ConfidenceCalculator` and swapping only the decay weight function.

**A naive "how many scenarios fall in the expected range" comparison would be misleading here, and it's worth saying why before presenting numbers.** The calibration dataset's expected ranges for non-boundary scenarios were set with the current stepped function's own output in mind (e.g., "89 days old" was scored expecting something close to the current 50%-weight value). Measured this way, every smooth alternative "underperforms" the current stepped function — not because the alternatives are worse, but because the dataset partly encodes the current formula's behavior as its own ground truth away from the cliffs. That comparison is included below for transparency, but **it is not the right basis for a recommendation** — the actual defect being fixed (cliff severity) is measured directly in Section 3, which is the metric that should drive the decision.

## 2. Naive in-range comparison (included for transparency, not decision-relevant)

| Candidate | In-range rate |
|---|---|
| Stepped (current) | 15/18 |
| Exponential, half-life 30 days | 7/18 |
| Exponential, half-life 45 days | 9/18 |
| Exponential, half-life 60 days | 10/18 |
| Sigmoid, midpoint 60 days, steepness 0.05 | 8/18 |
| Sigmoid, midpoint 45 days, steepness 0.08 | 8/18 |

As expected, the current function scores highest against a dataset partly calibrated to its own output. See Section 3 for the metric that actually matters.

## 3. Smoothness comparison — the metric that matters

Maximum single-day confidence swing, swept across a 0-150 day age range:

| Candidate | Max single-day weight change | Where it occurs |
|---|---|---|
| Stepped (current) | **0.500** | Day 30 (the cliff) |
| Exponential, half-life 30 days | 0.023 | Day 0 |
| Exponential, half-life 45 days | 0.015 | Day 0 |
| Exponential, half-life 60 days | 0.012 | Day 0 |
| Sigmoid, midpoint 60 days, steepness 0.05 | 0.013 | Day 60 |
| Sigmoid, midpoint 45 days, steepness 0.08 | 0.020 | Day 44 |

**Every smooth alternative reduces the worst-case single-day swing by roughly 25-40x.** This is the direct, quantitative fix for the discontinuities documented in the Calibration Report — a one-day age difference can no longer produce anywhere close to a 50-80% confidence change, regardless of which smooth candidate is chosen.

## 4. Direct comparison at the two known-bad boundaries

| Age | Stepped (current) | Exponential (half-life 45d) | Sigmoid (mid=60, k=0.05) |
|---|---|---|---|
| 29 days | 1.000 | 0.640 | 0.825 |
| 31 days | 0.500 | 0.620 | 0.810 |
| 89 days | 0.500 | 0.254 | 0.190 |
| 91 days | 0.100 | 0.246 | 0.175 |

At the 30-day boundary, both alternatives change by roughly 0.01-0.02 across the 2-day gap, versus the current function's 0.5 drop. At the 90-day boundary, both alternatives change by roughly 0.01, versus the current function's 0.4 drop. Both candidates directly solve the problem documented in the Calibration Report.

## 5. Evidence-ratio-based contradiction penalty (replacing the fixed 40%/2x cliff)

Proposed: `penalty = min(1.0, 0.6 + 0.2 * (weightedEvidenceCount / existingEvidenceCount))`, replacing the current hard step at exactly 2x.

| Evidence ratio | Stepped (current) | Ratio-based (proposed) |
|---|---|---|
| 1.50 | 0.600 | 0.900 |
| 1.80 | 0.600 | 0.960 |
| 1.90 | 0.600 | 0.980 |
| 1.95 | 0.600 | 0.990 |
| 2.00 | 1.000 | 1.000 |
| 2.05 | 1.000 | 1.000 |
| 2.10 | 1.000 | 1.000 |

The proposed function converges to the same value (1.0, no penalty) at and above the 2x line, but removes the discontinuity below it — evidence at 1.95x is treated almost the same as evidence at 2.0x, rather than receiving the full 40% penalty right up until the exact threshold.

## 6. Recommendation

**Exponential decay with a 45-day half-life**, for two reasons: it produces the smallest maximum single-day swing among the exponential candidates tested while staying computationally trivial (`Math.exp`, no added dependency), and a 45-day half-life sits intuitively between the two boundaries the current stepped function already uses (30 and 90 days), making the transition easier to reason about and explain to the team relative to the sigmoid alternative's two independent tuning parameters (midpoint and steepness).

**Pair this with the ratio-based contradiction penalty from Section 5** — both changes solve the same underlying problem (hard cliffs at arbitrary thresholds) and should be evaluated together, since the Calibration Report's Section 4 finding (decayed vs. undecayed evidence comparison in the contradiction check) means the two are not fully independent — changing the decay function changes the scale of `weightedEvidenceCount`, which feeds directly into the contradiction ratio.

**Before implementation:** this recommendation should be validated against real historical insight data if available, not just the 18 constructed scenarios here — the half-life of 45 days is a reasoned starting point based on the existing thresholds, not empirically derived from real user behavior, which no one has measured yet.
