# Response Analyzer Baseline Evaluation & Improvement Proposal

**Workstream:** WS1 — Response Analyzer Baseline Evaluation
**Author:** Dhanya (AI Systems Engineering, Intelligence Layer Onboarding Sprint)
**Audience:** Cognis Intelligence Layer team / Architecture Lead
**Status:** DRAFT — submitted for review. No production code has been modified.
**Dataset:** `response-analyzer-dataset.json`, 85 labeled entries (70 evaluation / 15 holdout), 6 of 7 prompt categories (`other` not yet labeled)

---

## 1. Executive Summary

All 4 response analyzers were benchmarked against 85 human-labeled, real AI responses (ChatGPT, Claude, Gemini). This is the first empirical evaluation these analyzers have received.

**Two categories of finding emerged, and they need to be read differently:**

1. **A genuine, well-evidenced code-level defect in `StructureAnalyzer`** — it fails almost completely on responses containing code, even in cases where real ground-truth issues exist to be caught. This is a legitimate Improvement Proposal target.
2. **A labeling methodology defect that is currently distorting the numbers for `ReasoningAnalyzer` and `CompletenessAnalyzer`.** Several of the real flags (`has_conclusion`, `step_by_step`, and to a lesser extent flags in the `adversarial_verbose` category) were tagged in ground truth far less often than they likely actually occur — because they describe *common, default* states that a solo labeler naturally under-tags relative to rarer, more "notable" states. This means the low F1 scores for those two analyzers are, right now, **not reliable evidence of a code problem** — they may just as easily be evidence of an incomplete label set. This report treats that distinction carefully rather than proposing analyzer changes based on numbers that may not mean what they appear to.

The RFC's original stated concern — that `ReasoningAnalyzer` overscores verbose responses — was directly tested and **not supported** by the data.

---

## 2. Dataset Summary

| | |
|---|---|
| Total entries | 85 (70 evaluation / 15 holdout) |
| Platforms | ChatGPT 29, Claude 28, Gemini 28 |
| Categories | coding 15, long_form 15, factual 14, reasoning 14, ambiguous 14, adversarial_verbose 13 |
| Category not yet labeled | `other` |
| Response length | 4–1,551 words (avg 130) |
| `containsCode` | 18 of 85 (21%) |

---

## 3. Baseline Metrics — MAE, Precision, Recall, F1

| Analyzer | Split | N | MAE | Precision | Recall | F1 |
|---|---|---|---|---|---|---|
| StructureAnalyzer | evaluation | 70 | 0.352 | 0.254 | 0.674 | 0.369 |
| StructureAnalyzer | holdout | 15 | 0.385 | 0.296 | 0.667 | 0.410 |
| ReasoningAnalyzer | evaluation | 70 | 0.513 | 0.455 | 0.625 | 0.526 |
| ReasoningAnalyzer | holdout | 15 | 0.471 | 0.400 | 0.667 | 0.500 |
| CompletenessAnalyzer | evaluation | 70 | 0.156 | 0.222 | 0.200 | 0.211 |
| CompletenessAnalyzer | holdout | 15 | 0.105 | 1.000* | 0.500* | 0.667* |
| QualityAnalyzer | evaluation | 70 | 0.293 | 0.305 | 0.600 | 0.405 |
| QualityAnalyzer | holdout | 15 | 0.261 | 0.342 | 0.650 | 0.448 |

*Based on very few positive cases — see Section 5.

MAE ranking (best to worst): CompletenessAnalyzer < QualityAnalyzer < StructureAnalyzer < ReasoningAnalyzer. `ReasoningAnalyzer` is the weakest on pure score accuracy, consistently across both splits — this holds regardless of the labeling issue discussed below, since it concerns numeric scores, not flags.

---

## 4. Confirmed Finding: `StructureAnalyzer` fails on code-containing responses

| Breakdown | N | MAE | Precision | Recall | F1 |
|---|---|---|---|---|---|
| containsCode=false | 55 | 0.381 | 0.296 | 0.725 | 0.420 |
| containsCode=true | 15 (eval) | 0.247 | **0.000** | **0.000** | **0.000** |
| promptCategory=coding | 14 | 0.290 | 0.050 | 0.333 | 0.087 |
| promptCategory=long_form | 13 | 0.378 | 0.050 | 0.333 | 0.087 |
| promptCategory=factual | 12 | 0.365 | 0.478 | 0.917 | 0.629 |

**This finding survives the sparsity check.** Of the 18 `containsCode=true` entries in the full dataset, 4 carry a genuine structure-domain ground-truth flag — real positives exist for the analyzer to catch, and it caught none of them (F1 = 0.000, evaluation split). The numeric structure score for this subgroup is actually *better than average* (MAE 0.247 vs. 0.352 overall), meaning the scoring logic and the flag-emission logic are diverging sharply — only one of the two is broken for this input type.

**Sample entry for manual source-level review** (structure-domain ground truth present, containsCode=true):
- `resp-030` (Gemini, coding) — ground truth: `highly_structured`, `unclosed_markdown`

**Root cause hypothesis:** None of the 18 `containsCode=true` entries carry `no_code` as ground truth (correctly — code is present in all of them), yet `StructureAnalyzer`'s own flag vocabulary includes `no_code` as one of only 3 possible structure flags. If the analyzer's code-detection logic is misfiring and emitting `no_code` on responses that clearly contain code, that alone would explain both the false positives (wrong flag) and the false negatives (real flags like `highly_structured` never emitted, if the code-detection branch short-circuits the rest of the flag logic).

**Recommended fix:** Read the code-detection branch of `StructureAnalyzer.ts` specifically — this looks like an isolated logic bug, not a scoring-formula problem, given the numeric score for this subgroup is healthy.

**Priority: highest.** This is the one finding in this report backed by both a clear mechanism and confirmed real positive cases.

---

## 5. Methodology Issue: Ground-Truth Flag Sparsity (affects Sections 6–7 below)

During review, we found that `has_conclusion` (5/85, 5.9%) and `unclosed_markdown` (7/85, 8.2%) were tagged far less often than they likely apply in reality — most well-formed AI responses do conclude properly, so a "conclusion is present" state is the *default*, not the exception. A solo labeler working through 85 entries naturally tags notable/unusual states more consistently than routine, expected ones — which means the *absence* of a tag in this dataset often means "wasn't flagged," not "verified absent."

**This is not isolated to `CompletenessAnalyzer`.** The same pattern appears in `ReasoningAnalyzer`'s ground truth: `step_by_step` is tagged only twice in the entire dataset (2.4%), and **zero of the 13 `adversarial_verbose` entries carry any reasoning-domain ground-truth flag at all.** This means the `ReasoningAnalyzer` "flag detection collapse on adversarial_verbose" finding from the previous draft of this report was **partly an artifact of this same sparsity issue** — there were no true positives available in that subgroup for the analyzer to find, so F1=0.000 was close to mechanically guaranteed regardless of how the analyzer actually behaves. That finding is downgraded from "confirmed weakness" to "inconclusive, pending relabeling."

**Recommended process fix:** `has_conclusion` and `unclosed_markdown` are both objectively, mechanically determinable from response text (does the last sentence read as a close? are code fences balanced?) — they don't require subjective judgment. These should move from manual labeling into the same auto-computed category as `responseMetadata` (`wordCount`, `containsCode`, `containsMarkdown`), which is already handled this way in the label helper tool. `step_by_step` and `shallow_directive` are more judgment-dependent and likely need to stay manual, but the labeling guidance should be revised to explicitly prompt for these on every entry (not just when "notable") to avoid the same under-tagging pattern.

**This should be resolved before `ReasoningAnalyzer` or `CompletenessAnalyzer` are evaluated for code-level fixes.** Proposing analyzer changes against numbers this uncertain risks fixing code that isn't actually broken, or missing a real problem hidden underneath the labeling noise.

---

## 6. Other Findings

### 6.1 `ReasoningAnalyzer` platform gap (ChatGPT vs. Claude) — flagged, not yet conclusive

| Breakdown | N | Precision | Recall | F1 |
|---|---|---|---|---|
| platform=chatgpt | 24 | 0.714 | 0.714 | 0.714 |
| platform=claude | 24 | 0.200 | 0.429 | 0.273 |
| platform=gemini | 22 | 0.467 | 0.636 | 0.538 |

Equal sample sizes rule out a small-N artifact, but this finding is also downstream of the same reasoning-domain sparsity described in Section 5 — the ground-truth base rate needs to be checked per-platform before concluding this reflects a real per-platform bias in the analyzer rather than uneven labeling across platforms. **Recommended: re-check after the Section 5 relabeling.**

### 6.2 `ReasoningAnalyzer`'s `step_by_step` flag is nearly absent from ground truth (2/85)

Independent of the sparsity concern above, this is worth its own note: either genuine step-by-step reasoning is genuinely rare across this dataset's prompts (plausible — most prompts weren't explicitly asking for step-by-step breakdowns), or the bar for tagging it during labeling was set unusually high. Worth a quick sanity check: re-read a handful of `reasoning`-category responses and ask whether `step_by_step` should have applied more often. If the low count is a true reflection of the prompts, no action needed; if it's a labeling artifact, this needs the same fix as Section 5.

### 6.3 `CompletenessAnalyzer` and `QualityAnalyzer` — no proposal yet, pending relabeling

Both show error patterns partly explained by the sparsity issue in Section 5. `QualityAnalyzer` additionally inherits errors from all three sub-analyzers as a composite, so its numbers should be re-evaluated only after `StructureAnalyzer` (Section 4) is fixed and the relabeling in Section 5 is complete.

---

## 7. RFC Hypothesis vs. Actual Findings

| RFC's stated concern | Status | What the data shows |
|---|---|---|
| `ReasoningAnalyzer` overscores verbose responses (marker inflation) | **Not supported** | Numeric score MAE is *best* on `adversarial_verbose` (0.342) of any category — the opposite of the hypothesis. |
| `StructureAnalyzer`'s 500-char `prose_heavy` threshold is unvalidated | **Not yet testable** | `wordCount=long(500+)` has only N=2 in the current dataset — needs more long-response entries before this can be validated either way. A different, better-evidenced `StructureAnalyzer` weakness was found instead (Section 4). |
| Analyzers are hand-tuned and never empirically evaluated | **Confirmed** | This is that first evaluation; real, measurable error found in every analyzer. |

The RFC's hypotheses were reasonable inferences from reading the source, but empirical testing surfaced a different and more specific failure mode (`StructureAnalyzer`'s code-content blind spot) than what was anticipated, and revealed that the dataset itself — not just the analyzers — needed a correction before some of the other suspected issues could be evaluated fairly.

---

## 8. Improvement Proposal

*No analyzer code has been modified. The following are proposed for review before any implementation begins, per Workstream 1's engineering gate.*

### 8.1 Fix `StructureAnalyzer`'s code-detection logic — Priority: High

- **Root cause:** Likely mis-triggering of the `no_code` flag (or a related short-circuit) on responses that do contain code, based on the complete absence of true positives in a subgroup with confirmed real ground truth.
- **Proposed fix:** Source-level review of the code-detection branch in `StructureAnalyzer.ts`. No specific line-level fix proposed yet — this requires reading the actual implementation, which is outside what this benchmark alone can determine.
- **Expected impact:** Cannot responsibly project a specific number without seeing the source, but given F1 goes from 0.000 to a plausible 0.4-0.6 range in line with the analyzer's non-code performance, this is likely the single highest-leverage fix available across all 4 analyzers.
- **Validation plan:** Re-run the benchmark harness against the same 18 `containsCode=true` entries after the fix; compare F1 before/after directly.

### 8.2 Fix the dataset labeling process — Priority: High (blocks further proposals)

- **Root cause:** `has_conclusion` and `unclosed_markdown` are objectively determinable but were manually labeled, leading to systematic under-tagging of common/default states.
- **Proposed fix:** Auto-compute `has_conclusion` and `unclosed_markdown` from response text directly in the label helper tool, the same way `responseMetadata` fields already are. Retroactively backfill these two fields across all 85 existing entries using the auto-computed logic. Revise labeling guidance for `step_by_step`/`shallow_directive` to be checked explicitly on every entry rather than only when notable.
- **Expected impact:** This doesn't fix an analyzer -- it fixes measurement quality, which is a prerequisite for trusting any `ReasoningAnalyzer`/`CompletenessAnalyzer` proposal that follows.
- **Validation plan:** Re-run the harness after backfilling; compare F1 for both analyzers before/after. A large jump would confirm the sparsity theory; little change would suggest the low F1 is real and a code-level investigation is warranted after all.

### 8.3 Investigate `ReasoningAnalyzer` platform gap — Priority: Medium, needs more data first

- Not proposing a fix yet. Recommend revisiting after 8.2, with a manual side-by-side read of a handful of Claude vs. ChatGPT responses in the same category to identify whether there's an actual phrasing-convention mismatch worth addressing.

### 8.4 `CompletenessAnalyzer`, `QualityAnalyzer` — Priority: Deferred

- No proposal. Re-benchmark after 8.1 and 8.2 land; only propose changes here if meaningful error remains once the upstream fixes are in place.

---

## 9. Next Steps

1. Submit this document for Architecture Lead review (this gate must pass before any of Section 8 is implemented).
2. Implement the auto-computation fix for `has_conclusion`/`unclosed_markdown` in the label helper (Section 8.2) and backfill the dataset.
3. Re-run the benchmark harness; update Sections 5-6 with corrected numbers.
4. Read `StructureAnalyzer.ts`'s code-detection logic and convert Section 8.1 into a specific, line-level proposed fix with a projected before/after metric.
5. Label the remaining `other` prompt category.
6. Once 8.1 and 8.2 are approved, proceed to implementation (Workstream 5) with before/after benchmark comparison.
