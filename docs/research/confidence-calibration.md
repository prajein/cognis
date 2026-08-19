# Confidence Calibration — `ConfidenceCalculator` v0.2

**Status:** implemented (v0.2.0, this pass)
**Owner track:** Intelligence Layer / AI Systems Evaluation

## Problem

`ConfidenceCalculator.calculate()` weights each piece of supporting evidence
by its age before folding it into an insight's confidence score. The v0.1
implementation used a 3-tier step function:

| Age            | Weight |
|----------------|--------|
| ≤ 30 days      | 100%   |
| 30–90 days     | 50%    |
| > 90 days      | 10%    |

This has two hard discontinuities. Evidence from day 29 counts for **2x**
evidence from day 31, and evidence from day 89 counts for **5x** evidence
from day 91 — cliffs with no principled justification, just an artifact of
picking two round-number boundaries.

## Options considered

1. **Keep the step function.** Simple, but the cliffs are indefensible: a
   user's confidence score could visibly jump for no behavioral reason as
   evidence crosses a boundary between two scheduled insight passes.
2. **Linear decay to zero.** Removes the cliffs, but decays evidence to
   nothing — loses the v0.1 property that very old evidence should still
   count for *something*, never fully forgotten.
3. **Continuous half-life decay with a floor (chosen).**
   `weight = max(0.5 ^ (age / HALF_LIFE_MS), MIN_EVIDENCE_WEIGHT)`.

## Calibration

`HALF_LIFE_MS = 30 days` was chosen so the new curve passes through the old
function's own reference points, rather than introducing new unjustified
constants:

- `weight(30d) = 0.5` — exactly matches the old midpoint.
- `weight(90d) = 0.125` — close to the old 10% tier (within 2.5 points).
- `MIN_EVIDENCE_WEIGHT = 0.1` — preserves the v0.1 "evidence never fully
  expires" floor. Pure exponential decay would otherwise fade evidence from
  a year ago to ~0.0002, silently dropping a design intent the step function
  had (old identity-relevant evidence should still nudge confidence, just
  weakly). The floor activates smoothly, at ~day 100, rather than as a cliff
  at day 90.

## What changed, concretely

- No discontinuities: evidence a day apart in age now differs by a fraction
  of a percent, not by 2x or 5x.
- The two reference points a strategy author would already expect (30d ≈
  half weight, 90d ≈ a tenth) still hold.
- `calculate()`'s public signature and every other piece of its logic
  (volume multiplier, contradiction penalty) are unchanged.

## Verification

`src/engines/insights/ConfidenceCalculator.selftest.ts` asserts: fresh
evidence at the required count reproduces the baseline score exactly, 30-day
and 90-day evidence land near their old reference weights, day-29 vs. day-31
evidence no longer differs by a cliff, evidence older than ~2 years floors at
10% instead of decaying toward zero, and the pre-existing volume-cap and
contradiction-penalty behavior is untouched.
