# Gap Detection Accuracy Analysis

**Workstream:** WS4 — Intelligence Research
**Scope:** `GapHeuristics.ts` v0.2 (`gap_rules.json` v0.2.0), read-only research per this workstream's boundary
**Method:** 36 curated, human-labeled prompts run against the real `GapHeuristics.detect()`, spanning all 8 gap types and every marker-matching mechanism (exact, stem, fuzzy, and clean-miss)

---

## 1. Headline result

**31/36 (86.1%) correct overall. Exact, stem, and fuzzy marker matching are 100% accurate (26/26)** — the v0.2 weighted-evidence upgrade's new stem and fuzzy matching work correctly on every test case, including deliberately misspelled markers ("objectove," "readerz," "assumeing," "rippl"). **All 5 errors are false negatives on prompts with no markers at all, and all 5 trace to one shared root cause below.**

## 2. Finding 1 (primary): `maxSignals` cap silently drops threshold-clearing signals for low-`baseConfidence` gap types

`gap_rules.json` sets `maxSignals: 3`. Four gap types have `baseConfidence` below `emitThreshold` (0.5): `stakes` (0.4), `assumption` (0.45), `temporal` (0.35), `second_order` (0.3). A fifth, `mechanism` (0.5), sits exactly at the threshold.

For any sufficiently vague prompt — one that fails to address *any* gap type — every rule's confidence collapses to its raw `baseConfidence` (no boosts, no penalty). Since `intentionality` (0.6), `audience` (0.55), and `constraint` (0.55) always have the three highest `baseConfidence` values, **they win the top-3 cap on every single vague prompt, regardless of what the prompt actually says.** Reproduced directly:

```
"Get me a working login page."          -> [intentionality, audience, constraint]
"Can you help me write a thank-you note?" -> [intentionality, audience, constraint]
```

Identical output for two completely different prompts — the system isn't reading the specific gap pattern in either case, it's returning the same static top-3 every time content doesn't help disambiguate. `mechanism` clears `emitThreshold` exactly (confidence = 0.5) in the login-page example but is silently cut by the cap before it can be reported.

**Practical impact:** `stakes`, `assumption`, `temporal`, `second_order`, and (in ties) `mechanism` can be effectively unreportable for any broadly under-specified prompt, independent of whether they're the *most* relevant gap for that specific case. This is a real, structural limitation, not noise from small sample size — reproduced identically across every generic prompt tested.

**Not proposing a specific fix here** (out of this workstream's scope — `GapHeuristics.ts`/`gap_rules.json` are research-only), but two directions worth flagging to whoever owns this file: raising `maxSignals`, or normalizing/rotating which gap types compete for the cap slots so static `baseConfidence` ranking doesn't permanently favor the same three types.

## 3. Finding 2: a trailing-space marker convention is silently defeated by `.trim()`

`gap_rules.json` defines markers like `{"marker": "how ", "weight": 0.5}` and `{"marker": "when ", "weight": 0.5}` — the trailing space is clearly intentional, meant to require a word boundary after the match (so "how" doesn't accidentally match inside "however" or "somehow"). But `GapHeuristics.matchScore()` does:

```typescript
const markerLower = marker.toLowerCase().trim();
```

`.trim()` strips the trailing space before the substring check runs, silently removing the exact protection the space was added for. Reproduced directly: a prompt containing "however" (with `intentionality`/`audience`/`constraint` separately addressed so they don't crowd the result via Finding 1) returns **zero signals at all** — `mechanism`'s "how " marker false-matched inside "however," pushing its `matchScore` to 0.5 and making the gap look "addressed" when it wasn't.

**This is a genuine, small, isolated bug** — not a design tradeoff, and not related to Finding 1's structural issue. Worth flagging as a one-line fix candidate (don't trim the trailing space, or check for a following non-letter character instead) — though implementing it is outside this workstream's read-only boundary.

## 4. Finding 3: match-mechanism accuracy (v0.2's actual new capability)

| Match mechanism | Accuracy | Notes |
|---|---|---|
| Exact substring | 19/19 (100%) | Baseline v0.1 behavior, unaffected by the v0.2 upgrade |
| Stem match | 1/1 (100%) | Only one stem case in this sample ("avoiding" → "avoid") — worth a larger follow-up sample |
| Fuzzy (1-edit) match | 6/6 (100%) | All 6 deliberately-misspelled markers matched correctly |
| No marker present | 5/10 (50%) | Every failure here is Finding 1, not a matching-mechanism problem |

The new v0.2 weighted-evidence matching (the actual subject of this sprint's "draft the gap-detection rules" deliverable) performs flawlessly on every case tested. The accuracy problem is entirely in the *aggregation/emission* logic (`maxSignals`, `emitThreshold` vs. static `baseConfidence`), not in the matching logic itself.

## 5. Limitations of this analysis

- 36 prompts is a reasonable first pass but not exhaustive — particularly thin coverage on stem matches (n=1) and no coverage yet of prompts addressing multiple gap types with mixed match mechanisms simultaneously.
- All tests used a neutral `stretch` cognitive state and zero revision depth. `stateModifiers.overload` (+0.1) would push `mechanism` (0.5) and get `stakes`/`assumption` closer to clearing threshold on their own — worth testing whether Finding 1 is state-dependent or persists across all states.
- This analysis is read-only per the workstream boundary — no changes to `GapHeuristics.ts` or `gap_rules.json` were made or are proposed here as concrete diffs; findings are handed off for whoever owns that file to act on.

## 6. Recommendation

Findings 1 and 2 are worth a direct conversation with the Gap Detection Engine's owner — both are concrete, reproducible, and outside this workstream's authority to fix. Finding 1 especially deserves attention given it affects roughly half of the taxonomy (4-5 of 8 gap types) for a common, realistic input pattern (a broadly vague prompt), not an edge case.