# WS1 Improvement Proposal — Addendum

**Purpose:** convert the original proposal's `StructureAnalyzer` hypothesis into a concrete, reviewable diff, now that real source has been confirmed. Append to `response-analyzer-improvement-proposal.md`; does not replace it.

---

## 8.1 (revised) `StructureAnalyzer` code-detection logic — Priority: High, now confirmed

**Root cause, confirmed exactly (previously a hypothesis):**

// StructureAnalyzer.ts, current:
const totalStructuralMarkers = headers + lists + numberedLists;


`codeBlocks` is computed but never included in `totalStructuralMarkers`, which feeds both `structureDensity` (the `highly_structured` flag) and the `prose_heavy` check. A response that is pure code with no markdown headers or bullet lists satisfies neither flag condition — `highly_structured` requires density above 0.05 (impossible with `totalStructuralMarkers = 0`), and `prose_heavy` is correctly excluded since `codeBlocks > 0`. The response silently gets no structural flag at all, explaining the confirmed WS1 baseline finding (F1 = 0.000 on `containsCode=true`, with real ground-truth positives available to catch).

**Proposed fix, one line:**


// Proposed:
const totalStructuralMarkers = headers + lists + numberedLists + codeBlocks;

**Why this is low-risk:** the numeric score calculation already checks `codeBlocks > 0` independently (`if (flags.includes('highly_structured') || codeBlocks > 0) score += 0.2;`), so this change only affects flag emission, not the score path that WS1 confirmed is already healthy for this subgroup. No other analyzer or downstream consumer reads `totalStructuralMarkers` directly (confirmed — it's a local variable, not part of `AnalysisResult`'s public shape).

**Expected impact:** projected from re-running the 18 code-containing evaluation-dataset entries with this change applied offline (not touching the real file) — recommend doing this exact simulation before finalizing the number, following the same before/after discipline used elsewhere this sprint, rather than asserting a specific percentage here without having run it.

**Validation plan:** re-run `intelligence-benchmark.ts`'s `containsCode=true` stratified breakdown before and after; confirm F1 moves off 0.000 without regressing the `containsCode=false` subgroup.

---

## 8.5 (new) `ReasoningAnalyzer`'s factual-response penalty — Priority: Needs a product decision, not proposing a unilateral fix

**Confirmed mechanism (previously unexplained):**

```typescript
if (chainLength === 0 && branching === 0) flags.push('shallow_directive');
...
if (flags.includes('shallow_directive')) finalScore = 0.3;
```

Any response with zero reasoning-connector words and zero branching words is hard-capped to a 0.3 score — including short, entirely correct factual answers where no reasoning was ever called for. This is the confirmed mechanism behind WS1's finding that `ReasoningAnalyzer` performed worst specifically on the `factual` category (MAE 0.588, the single worst cell across the whole baseline).

**Not proposing a fix, deliberately.** Whether this is a bug or intentional scope depends on a product question outside this document's authority to answer: does `ReasoningAnalyzer` exist to measure *visible reasoning depth* (in which case a terse factual answer correctly scores low, because it visibly has none) or *reasoning appropriateness given the question* (in which case it's wrongly penalizing correct brevity)? Recommend this be raised directly with the Architecture Lead and, if relevant, whoever owns the product's insight-facing copy, rather than resolved unilaterally in this proposal.

**If the team decides this is a bug:** the most surgical fix would condition the `shallow_directive` penalty on the prompt category (e.g., don't penalize when the analyzer can infer a factual/short-answer context), which would require passing additional signal into the analyzer that it doesn't currently receive — a larger change than 8.1's one-liner, and worth scoping separately if approved.