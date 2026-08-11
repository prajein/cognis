## Engineering Sprint Proposal: Intelligence Layer Onboarding (Revised)

Document Type: Staff/Principal-Level Engineering Sprint Proposal Author: Architecture Lead Prepared For: Intern Onboarding — AI Systems Engineering Status: DRAFT — Pending Architecture Lead Review Sprint Duration: 4 Weeks

Start Date: TBD

## 0. Engineering Philosophy

Understand

↓

Measure

↓

Benchmark

↓

Analyze

↓

Research

↓

Propose

↓

Review

↓

Approve

↓

Implement

↓

Benchmark Again

↓

Document

No implementation may begin without prior measurement. No measurement may begin without prior understanding. No change ships without a before/after comparison. The intern is not here to "fix things." She is here to build the scientific foundation that allows the team to make evidence- driven intelligence decisions for years.

[!IMPORTANT] Existing production code is frozen until baseline evaluation is complete and reviewed by the Architecture Lead. This includes all 4 Response

Analyzers and the ConfidenceCalculator.

Every task in this sprint follows a single, non-negotiable workflow:

## 1. High-Level Mission

Cognis' Intelligence Layer currently contains working but minimally validated heuristic analyzers and a single insight strategy. The analyzers use hand-tuned weights, hardcoded marker lists, and linear scoring functions that have never been evaluated against real-world AI interaction data.


The intern's mission is to build the evaluation, research, and benchmarking infrastructure that transforms the Intelligence Layer from "plausible heuristics" into "validated, calibrated,

and measurable intelligence algorithms." She will not immediately modify production code. She will first deeply understand the architecture,

then rigorously measure and benchmark existing algorithms, then research improvements grounded in evidence, then propose changes through formal review, and only then implement approved improvements.

## 2. Overall Sprint Objective

By the end of this sprint, the Cognis Intelligence Layer should have:

- 1. A documented architectural understanding of every module in the Intelligence Layer, produced by the intern as proof of comprehension

- 2. Quantitative baseline measurements of all 4 response analyzers against human-labeled datasets

- 3. At least two new Insight Strategies beyond the single V1AutomaticityEvaluator, each justified by a design rationale document

- 4. A ConfidenceCalculator calibration study with alternative decay proposals reviewed by the Architecture Lead

- 5. A comprehensive evaluation harness that allows any engineer to run benchmarks and see accuracy metrics

- 6. A research knowledge base (docs/research/, docs/evaluation/, docs/benchmarks/, docs/experiments/) that becomes Cognis' internal AI research reference

- 7. Architectural documentation explaining every algorithm's design rationale, limitations, and improvement roadmap

## 3. Engineering Goals

| # | Goal | Priority | Gate |
| --- | --- | --- | --- |
| G0 | Prove architectural | P0 | Must complete before |
|   | comprehension of the |   | any other work |
|   | Intelligence Layer |   |   |
| G1 | Measure and | P0 | Must complete before |
|   | benchmark the 4 |   | proposing changes |
|   | existing Response |   |   |
|   | Analyzers |   |   |
| G2 | Design and implement | P0 | Design rationale must |
|   | 2+ new Insight |   | be reviewed before |
|   | Strategies |   | implementation |


| # | Goal | Priority | Gate |
| --- | --- | --- | --- |
| G3 | Build labeled | P0 | Dataset schema must |
|   | evaluation datasets for |   | be reviewed before |
|   | analyzers and insights |   | labeling |
| G4 | Produce a | P1 | Study must be |
|   | ConfidenceCalculator |   | reviewed before any |
|   | calibration study with |   | code changes |
|   | alternative proposals |   |   |
| G5 | Establish a | P1 | — |
|   | reproducible |   |   |
|   | benchmarking harness |   |   |
| G6 | Conduct research into | P1 | Research-only; no |
|   | lightweight NLP |   | implementation |
|   | approaches for gap |   |   |
|   | detection |   |   |
| G7 | Document all | P1 | Ongoing |
|   | algorithms, |   |   |
|   | experiments, and |   |   |
|   | research findings |   |   |
| G8 | Propose evidence- | P2 | Proposals must include |
|   | based improvements to |   | before/after projections |
|   | existing analyzers |   |   |

## 4. Architectural Boundaries

## 4.1 What She Owns

All work must reside inside the Domain Engines layer (Layer 4 of the Constitution) and the evaluation/research infrastructure.

| Module | Path | Scope |
| --- | --- | --- |
| Response Analyzers | src/engines/ | Benchmark, evaluate, and (after |
|   | response/analyzers/ | approval) improve |
| Response Interfaces | src/engines/ | Read-only |
|   | response/ |   |
|   | interfaces.ts |   |
| Insight Strategies | src/engines/ | Design and implement new |
|   | insights/strategies/ | strategies |
| Confidence Calculator | src/engines/ | Study and calibrate (changes |
|   | insights/ | require approval) |
|   | ConfidenceCalculator. |   |
|   | ts |   |
| Insight Validator | src/engines/ | Evaluate threshold |
|   | insights/ | appropriateness |


| Module | Path | Scope |
| --- | --- | --- |
|   | InsightValidator.ts |   |
| Insight Interfaces | src/engines/ | Read-only |
|   | insights/ |   |
|   | interfaces.ts |   |
| Gap Heuristics | src/engines/gap/ | Research-only (no |
|   | GapHeuristics.ts | modification) |
| Gap Rules Config | src/core/config/ | Read-only |
|   | gap_rules.json |   |
| Evaluation Datasets | src/tests/evaluation/ | Create and own |
| Benchmarking Harness | src/tests/benchmarks/ | Create and own |
| Research Documentation | docs/research/ | Create and own |
| Evaluation Documentation | docs/evaluation/ | Create and own |
| Benchmark Documentation | docs/benchmarks/ | Create and own |
| Experiment Documentation | docs/experiments/ | Create and own |

## 4.2 What She Must Never Modify

| Module | Path | Reason |
| --- | --- | --- |
| EventBus | src/core/event-bus/ | Protected foundation |
|   |   | (Constitution Section 10) |
| Event Contracts | src/core/event-bus/ | Immutable public contracts |
|   | contracts.ts | (Constitution Section 4) |
| Event Registry | src/core/event-bus/ | Frozen event names |
|   | registry.ts |   |
| Storage Layer | src/storage/ | Owned by storage engineer |
| Projection Builders | src/storage/ | Owned by storage engineer |
|   | projections/ |   |
| Platform Adapters | src/platforms/ | Owned by Architecture Lead |
| Side Panel | src/sidepanel/ | Presentation layer |
| Background Script | src/background/ | Composition root |
|   | index.ts |   |
| Content Script | src/content/index.ts | Composition root |
| PersistenceMapper | src/storage/ | ADR-019 boundary |
|   | indexeddb/ |   |
|   | PersistenceMapper.ts |   |
| CognisDatabase | src/storage/ | IndexedDB lifecycle |
|   | indexeddb/ |   |
|   | CognisDatabase.ts |   |


## 4.3 Dependency Rules

```
✅ She may import from: src/engines/response/interfaces.ts
✅ She may import from: src/engines/insights/interfaces.ts
✅ She may import from: src/core/types/*.ts (read-only type references)
❌ She may NOT import from: src/storage/
❌ She may NOT import from: src/core/event-bus/EventBus.ts
❌ She may NOT import from: src/platforms/
❌ She may NOT import from: src/sidepanel/
```

## 5. Dependencies on Existing Systems

| Dependency | What She Needs From It | Access Level |
| --- | --- | --- |
| ResponseAnalyzer | The | Read-only |
| interface | analyze(responseText, |   |
|   | promptHash): |   |
|   | AnalysisResult contract |   |
| InsightStrategy interface The execute(context: |   | Read-only |
|   | ReasoningContext): |   |
|   | InsightCandidate[] |   |
|   | contract |   |
| ConfidenceCalculator | The decay/weighting algorithm | Study → Propose → Review → |
|   | she will study and propose | Modify |
|   | changes to |   |
| AnalysisPipeline | Orchestrates analyzers; must | Read-only |
|   | understand but not modify |   |
| ReasoningPipeline | Orchestrates strategies; must | Read-only |
|   | understand but not modify |   |
| GapHeuristics | The lexical gap detection rules | Read-only |
|   | she will research |   |
| gap_rules.json | Configuration driving gap | Read-only |
|   | detection |   |

## 6. Detailed Workstreams

## Workstream 0: Intelligence Layer Familiarization

Objective: Before touching a single line of production code, demonstrate a complete understanding of the architecture.

Rationale: The Cognis Intelligence Layer is deeply integrated with an event-sourced, CQRS architecture governed by a strict Engineering Constitution. An engineer who modifies intelligence algorithms without understanding how events flow, how analysis results are persisted (as metadata, never raw text), and how projections consume those results will inevitably create architectural


violations. This workstream exists to prevent that. Architecture: Read-only study of the entire src/engines/ directory, the Constitution, all

ADRs, and all implementation overviews.

## Expected Outputs:

- 1. Intelligence Layer Architecture Notes (docs/research/intelligence-layer- architecture-notes.md):

- Module-by-module summary of every file in src/engines/response/ and src/engines/insights/

- Explanation of how the Response Intelligence Engine works end-to-end (EventBus subscription → ReconstructorBuffer → AnalysisPipeline → Analyzers → domain event emission)

- Explanation of how the Insight Engine works end-to-end (InsightScheduler  ReasoningPipeline → Strategies → ConfidenceCalculator → InsightValidator → domain event emission)

- Explanation of the ADR-019 boundary and why raw text never reaches storage

- 2. Module Dependency Diagram (Mermaid or ASCII):

- Shows which modules import from which other modules

- Clearly marks the forbidden import boundaries

- 3. Event Flow Diagram (Mermaid or ASCII):

- Traces a single AI response from response.chunk through the ReconstructorBuffer, through all 4 analyzers, through the AnalysisPipeline, to the response.analysis.completed event, through the EventStoreSubscriber/PersistenceMapper boundary, into projections

- 4. Questions, Observations, Assumptions, and Unknowns:

- A structured list of anything the intern found unclear, surprising, potentially problematic, or underdocumented during her review

- These will be discussed in the first Design Review

## Estimated Complexity: Low (2 days) Dependencies: None Engineering Gate: Workstream 0 deliverables must be reviewed and approved by the Architecture

Lead before any subsequent workstream begins.

## Review Checkpoints:

-  Architecture notes demonstrate accurate understanding of event flow

-  Dependency diagram correctly identifies all import boundaries

-  Event flow diagram traces the full lifecycle from perception to persistence


- \- Questions/unknowns list has been discussed and resolved

## Workstream 1: Response Analyzer Baseline Evaluation

Objective: Measure, benchmark, and produce a rigorous engineering review of all 4 response analyzers (StructureAnalyzer, ReasoningAnalyzer, CompletenessAnalyzer, QualityAnalyzer) against human-labeled data — without modifying any production code. Rationale: The current analyzers use hand-tuned linear weights and hardcoded marker lists. The ReasoningAnalyzer counts occurrences of words like "because" and "therefore" — but these markers are trivially inflated by verbose AI responses. The StructureAnalyzer penalizes "prose_heavy" responses above 500 characters, but this threshold has never been validated. Without empirical evaluation, these heuristics may produce misleading quality scores that propagate into projections and insights.

[!CAUTION] Existing analyzers remain frozen until baseline evaluation is complete and reviewed. No modifications to StructureAnalyzer.ts, ReasoningAnalyzer.ts, CompletenessAnalyzer.ts, or

QualityAnalyzer.ts are permitted during this workstream.

## Architecture:

- Analyzers implement the pure ResponseAnalyzer interface: analyze(responseText, promptHash): AnalysisResult

- They are completely stateless and deterministic  perfect for batch evaluation

- The QualityAnalyzer is a composite that delegates to the other three (40% Completeness, 40% Reasoning, 20% Structure)

## Engineering Workflow:

Read implementations → Understand each algorithm → Build evaluation dataset

→ Benchmark baseline → Identify systematic weaknesses → Produce engineering

review

→ Architecture Lead approves → (Future) Implement improvements

## Expected Outputs:

- 1. Labeled Evaluation Dataset (src/tests/evaluation/datasets/response- analyzer-dataset.json):

- 506100 real AI responses sourced from ChatGPT, Claude, and Gemini

- Each labeled with: expectedStructureScore, expectedReasoningScore, expectedCompletenessScore, expectedQualityScore, expectedFlags[]

- Dataset split: 70% evaluation, 30% holdout

- 2. Benchmark Harness (src/tests/benchmarks/intelligence- benchmark.ts):


- Loads datasets, runs analyzers against labeled examples Computes: accuracy, precision, recall, MAE (for scores), flag detection F1 Prints a summary table to stdout

- Returns exit code 0/1 for CI integration

## 3. Baseline Evaluation Report (docs/evaluation/response-analyzer-

baseline-report.md):

- Baseline MAE per analyzer

- Flag detection precision/recall/F1

- Identified systematic biases (e.g., "ReasoningAnalyzer overscores verbose responses by +0.2 on average")

- Distribution analysis of predicted vs. expected scores

- Specific failure cases with analysis

## 4. Improvement Proposal (docs/evaluation/response-analyzer- improvement-proposal.md):

- For each identified weakness: root cause, proposed fix, expected impact

- Proposed weight/threshold changes with projected before/after metrics

- This document must be approved before any analyzer code is modified

Estimated Complexity: Medium-High (1.5 weeks including dataset creation) Dependencies: Workstream 0 completed and approved Engineering Gate: Improvement Proposal must be reviewed and approved by the Architecture Lead before any analyzer modifications begin.

## Review Checkpoints:

-  Dataset schema approved before labeling begins

- Dataset includes platform diversity (ChatGPT, Claude, Gemini)

- \- Baseline report identifies at least 3 systematic weaknesses with evidence

-  Improvement proposals include projected before/after metrics

- \- No production code was modified during this workstream

## Workstream 2: Insight Strategy Design & Implementation

Objective: Design and implement at least 2 new InsightStrategy implementations beyond the existing V1AutomaticityEvaluator, covering different TaxonomyDomain categories. Rationale: The Insight Engine currently has a single strategy that only covers the Automaticity domain. The taxonomy defines 8 domains: Behavioral, Learning, Automaticity, Gap,


Prompting, Writing, Reasoning, and Identity. A production system needs broader

coverage to deliver meaningful longitudinal insights to users.

## Architecture:

- All strategies implement the InsightStrategy interface

- Strategies receive a ReasoningContext providing sessionId, now, and getEventHistory(marker) for accessing historical evidence

- Strategies return InsightCandidate[] which are validated by InsightValidator (minimum 0.75 confidence, minimum 5 evidence count)

- Strategies must be pure and deterministic - no network calls, no storage access, no DOM interaction

## Engineering Workflow:

Study existing V1AutomaticityEvaluator → Study TaxonomyDomains and event types

→ Write strategy design rationale document → Architecture Lead reviews

design

→ Implement strategy → Write self-test → Benchmark against evaluation

dataset

→ Document algorithm design → Architecture Lead reviews implementation

## Suggested Strategies (she may propose alternatives with justification):

## Strategy A: V1PromptingPatternEvaluator

- Domain: Prompting

- Signal: Detects whether the user's prompt quality is improving over time by analyzing gap detection frequency trends

- Evidence: Historical gap.detected event counts (declining frequency = improving prompt quality)

- Output: Insight like "Your prompts have become 40% more specific over the last 30 sessions"

## Strategy B: V1GapResolutionEvaluator

- Domain: Gap

- Signal: Detects which cognitive gap types the user chronically struggles with vs. which they've resolved

- Evidence: Historical gap.detected events grouped by gapType, cross-referenced with ghosttext.accepted events

- Output: Insight like "You consistently miss audience specification  this gap has appeared in 78% of your sessions"

## Strategy C: V1ReasoningDepthEvaluator

- Domain: Reasoning


- Signal: Detects whether the AI responses the user receives are trending toward deeper or shallower reasoning

- Evidence: Historical response.analysis.completed events with reasoning scores

- Output: Insight like "Your recent AI responses show 25% deeper reasoning chains than your first week"

## Expected Outputs:

- 1. Strategy Design Document (docs/research/insight-strategy-design- rationale.md):

- Signal hypothesis for each strategy

- Evidence requirements and expected event types

- Confidence calibration approach

- Edge cases and failure modes

- 2. 2+ new strategy files in src/engines/insights/strategies/

- 3. Self-test for each strategy (following the GapDetectionEngine.selftest.ts pattern)

- 4. Insight Strategy Evaluation Dataset

(src/tests/evaluation/datasets/insight-strategy-dataset.json):

- 20130 mock session event histories

- Each labeled with: expected insight domain, expected insight presence/absence, expected confidence range

- 5. Algorithm design documentation in docs/research/

Estimated Complexity: Medium (1.5 weeks) Dependencies: Workstream 0 completed and approved

Engineering Gate: Strategy Design Document must be reviewed before implementation begins.

## Review Checkpoints:

-  Strategy design rationale approved before implementation

-  Each strategy's confidence calibration reviewed

-  Self-tests pass deterministically

-  Strategies produce no side effects beyond returning InsightCandidate[]

- \- Evaluation dataset covers edge cases (empty histories, contradictory evidence)

## Workstream 3: Confidence Calculator Calibration Study

Objective: Analyze, document, and propose calibration changes to the ConfidenceCalculator's decay curves, contradiction penalties, and volume multipliers —


without modifying production code until the study is reviewed and approved. Rationale: The current ConfidenceCalculator uses a stepped decay function (100% for <30 days, 50% for 30–90 days, 10% for >90 days) and a fixed 40% contradiction penalty. These constants were chosen without empirical justification. For a system that builds long-term behavioral

models, miscalibrated confidence leads to:

- Over-confidence: Premature insights that mislead the user

- Under-confidence: Valid insights that never surface because they can't pass the 0.75 InsightValidator threshold

[!CAUTION] The intern must not directly modify ConfidenceCalculator.ts until the calibration study is reviewed and approved. The workflow is: Evidence →

Proposal → Review → Implementation.

## Architecture:

- The ConfidenceCalculator is a pure function: calculate(evidence[], requiredCount, baseline, contradicts, existingCount, now) → number

- It is consumed by all InsightStrategy implementations

- Changes here affect every insight in the system

## Engineering Workflow:

Study current implementation → Build calibration dataset

→ Run calibration experiments → Analyze decay behavior → Research

alternative strategies

→ Write ConfidenceCalibrationReport.md → Write AlternativeDecayStrategies.md → Architecture Lead reviews → Implement approved changes → Benchmark again →

Document

## Expected Outputs:

- 1. Confidence Calibration Dataset

(src/tests/evaluation/datasets/confidence-calibration-

dataset.json):

- 15420 scenarios with varying evidence counts, ages, and contradiction states

- Each labeled with expected confidence range

- 2. Confidence Calibration Report

(docs/evaluation/ConfidenceCalibrationReport.md):

- Analysis of the current stepped decay curve behavior with tables showing confidence vs. evidence age

- Identification of discontinuities (the cliff at 30 days and 90 days)

- Calibration error measurement (difference between predicted confidence and expected correctness)

- Impact analysis: how does miscalibration affect the InsightValidator's 0.75


- threshold?

- 3. Alternative Decay Strategies

(docs/research/AlternativeDecayStrategies.md):

- Exponential decay: weight = e^(-age/halfLife) with proposed halfLife values

- Sigmoid decay with configurable steepness

- Evidence-ratio-based contradiction penalty (replacing the fixed 40%)

- Comparison table showing each strategy's behavior across the calibration dataset

- Recommendation with justification

- 4. Implementation (after approval only):

- Updated ConfidenceCalculator with version bump

- Before/after benchmark comparison No changes to the calculate() method signature

## Estimated Complexity: Medium (1 week including study and implementation) Dependencies: Workstream 0 completed Engineering Gate: Both the Calibration Report and Alternative Decay Strategies documents must

be reviewed and approved before any code changes to ConfidenceCalculator.ts.

## Review Checkpoints:

-  Calibration dataset reviewed for scenario diversity

- \- Calibration report identifies specific discontinuities with evidence

-  Alternative strategies include quantitative comparison

- ‐ Recommendation is justified with data, not intuition

-  Implementation (if approved) includes before/after benchmark

## Workstream 4: Intelligence Research

Objective: Conduct structured research into the theoretical foundations, alternative approaches, and future improvement paths for Cognis' intelligence algorithms. Produce well-written RFCs and research documents — not code. Rationale: Cognis currently relies entirely on lexical substring matching and linear heuristics. The intern's ML/DL background makes her uniquely positioned to evaluate whether more sophisticated approaches (embeddings, TF-IDF, sentence transformers) are feasible within the browser extension's latency and compute constraints. This research will guide the Intelligence Layer roadmap for quarters to come.

## Research Topics:


| Topic | Key Questions | Output Document |
| --- | --- | --- |
| Lexical Heuristics vs. | Can cosine similarity over | docs/research/ |
| Semantic Embeddings | sentence embeddings | lexical-vs-semantic- |
|   | outperform substring matching | gap-detection.md |
|   | for gap detection? What is the |   |
|   | latency cost? |   |
| Sentence Transformers in | Can lightweight sentence | docs/research/ |
| Browser Extensions | transformers (e.g., all-MiniLM- | browser-extension-ml- |
|   | L6-v2, 22MB) run in a browser | feasibility.md |
|   | extension service worker? What |   |
|   | is inference latency? |   |
| TF-IDF for Prompt | Can TF-IDF features improve | docs/research/tfidf- |
| Classification | gap type classification accuracy | gap-classification.md |
|   | without requiring a neural |   |
|   | model? |   |
| Confidence Estimation | How do calibration techniques | Covered in Workstream 3 |
| Theory | (Platt scaling, isotonic |   |
|   | regression, temperature scaling) |   |
|   | apply to heuristic confidence |   |
|   | scores? |   |
| Explainability for Cognitive | How can SHAP values or | docs/research/ |
| Insights | feature attribution explain why | insight- |
|   | an insight was generated, for | explainability.md |
|   | user-facing transparency? |   |
| Lightweight Ranking Systems | Can learning-to-rank | docs/research/ |
|   | approaches improve how the | ranking-for-quality- |
|   | QualityAnalyzer weights sub- | scoring.md |
|   | scores? |   |
| Automaticity Theory | Is Fitts & Posner's 3-phase | docs/research/ |
|   | model the right cognitive | automaticity- |
|   | framework? Should we | theoretical- |
|   | consider Anderson's ACT-R or | grounding.md |
|   | Dreyfus skill acquisition? |   |

## Expected Outputs:

- Each research document should include: problem statement, literature review (335 sources minimum), feasibility assessment, latency/compute analysis (for on-device approaches), recommendation, and next steps

- A gap detection accuracy analysis: curate 30+ diverse prompts, run GapHeuristics against them, measure precision/recall, identify false positives and false negatives

Estimated Complexity: Medium (distributed across Weeks 2–4, ~2 days/week)

Dependencies: Workstream 0 completed

## Review Checkpoints:

-  Research methodology reviewed before each investigation


- \- All proposals account for browser extension constraints (no server calls, <200ms latency, limited memory)

- \- Each document reviewed by Architecture Lead and relevant engine owner

## Workstream 5: Analyzer Improvement Implementation (Gated)

## Objective: Implement the approved improvements from Workstream 1's engineering review.

[!IMPORTANT] This workstream may only begin after Workstream 1's Improvement Proposal has been reviewed and approved by the Architecture Lead.

## Rationale: By this point, the intern will have: (1) fully understood each analyzer, (2) measured baseline performance, (3) identified systematic weaknesses with evidence, and (4) proposed

specific improvements with projected before/after metrics. Implementation is the final step, not the

first.

## Engineering Workflow:

Approved Improvement Proposal → Implement changes → Run benchmark harness

→ Compare before/after metrics → Document delta → Submit for review

## Expected Outputs:

- improvement-delta.md) 3. Updated algorithm design documentation 4. All self-tests pass; tsc --noEmit clean Estimated Complexity: Medium (0.5–1 week, depending on approved scope) Dependencies: Workstream 1 approval gate Review Checkpoints: 1. Improved analyzers (version-bumped to v1.1.0) for each approved change 2. Before/after benchmark comparison report (docs/benchmarks/analyzer-

- \- Every change corresponds to an approved item in the Improvement Proposal  Before/after metrics show measurable improvement  No regression on holdout dataset

-  d( Latency budgets preserved (latencyBudgetMs per analyzer)

## 7. Recurring Design Reviews

Every Friday, the intern presents a structured engineering review to the Architecture Lead:

Section Completed Work

Content What was delivered this week (documents,


| Section | Content |
| --- | --- |
|   | datasets, code, benchmarks) |
| Benchmark Results | Quantitative metrics from evaluation runs |
| Evaluation Metrics | Accuracy, MAE, F1, calibration error — |
|   | whatever is relevant |
| Discovered Weaknesses | Systematic biases, edge cases, failure modes |
|   | found in existing algorithms |
| Proposed Improvements | Evidence-backed proposals for changes (not |
|   | implemented yet) |
| Architectural Questions | Anything unclear about boundaries, contracts, or |
|   | design decisions |
| Research Findings | Summaries of research topics investigated that |
|   | week |
| Next Week's Plan | Specific tasks, expected deliverables, and any |
|   | approval gates needed |

[!IMPORTANT] Engineering decisions are reviewed before implementation. The Design Review is the formal gate where proposals are approved, modified, or rejected. The intern should never implement a significant change without first presenting the

justification in a Design Review.

## 8. Documentation Ownership

The intern owns and maintains the following documentation directories, which together form Cognis' internal AI research knowledge base:

| Directory | Purpose | Examples |
| --- | --- | --- |
| docs/research/ | Research findings, literature | lexical-vs-semantic- |
|   | reviews, feasibility studies, | gap-detection.md, |
|   | theoretical analysis | automaticity- |
|   |   | theoretical- |
|   |   | grounding.md |
| docs/evaluation/ | Evaluation reports, calibration | response-analyzer- |
|   | studies, accuracy analyses | baseline-report.md, |
|   |   | ConfidenceCalibration |
|   |   | Report.md |
| docs/benchmarks/ | Benchmark results, before/after | analyzer-improvement- |
|   | comparisons, regression | delta.md |
|   | analyses |   |
| docs/experiments/ | Experimental logs, hypothesis | reasoning-marker- |
|   | testing, parameter sweeps | expansion- |
|   |   | experiment.md |


Every algorithm, benchmark, experiment, calibration study, and research finding must be

documented. This documentation is as important as the code.

## 9. Detailed Task Breakdown

## Week 1: Architecture Understanding & Dataset Foundation

| Day | Task | Deliverable | Gate |
| --- | --- | --- | --- |
| 1 | Read Constitution, all | Understanding of | — |
|   | ADRs, all | constraints |   |
|   | implementation |   |   |
|   | overviews |   |   |
| 1 | Study all files in | — | — |
|   | src/engines/res |   |   |
|   | ponse/ and |   |   |
|   | src/engines/ins |   |   |
|   | ights/ line-by-line |   |   |
| 2 | Study | — | — |
|   | GapHeuristics, |   |   |
|   | gap_rules.json, |   |   |
|   | and the self-test |   |   |
| 2 | Produce Intelligence | intelligence- | WS0 Gate |
|   | Layer Architecture | layer- |   |
|   | Notes, dependency | architecture- |   |
|   | diagram, event flow | notes.md |   |
|   | diagram |   |   |
| 3 | WS0 Review with | Questions/unknowns | Approved → |
|   | Architecture Lead | resolved | proceed |
| 3–4 | Design evaluation | Draft dataset (25+ | Schema reviewed |
|   | dataset schema; begin | responses) |   |
|   | collecting and labeling |   |   |
|   | AI responses |   |   |
| 5 | Complete response | response- | — |
|   | analyzer dataset (50+ | analyzer- |   |
|   | responses); begin | dataset.json |   |
|   | benchmark harness | (draft) |   |
| 5 | Friday Design Review | Present: architecture | — |
|   | #1 | understanding, dataset |   |
|   |   | progress, initial |   |
|   |   | observations |   |


*Week 2: Baseline Evaluation & Strategy Design*

| Day | Task | Deliverable | Gate |
| --- | --- | --- | --- |
| 1–2 | Complete benchmark | intelligence- | — |
|   | harness for response | benchmark.ts |   |
|   | analyzers |   |   |
| 2 | Run baseline | response- | — |
|   | evaluation; document | analyzer- |   |
|   | results | baseline- |   |
|   |   | report.md |   |
| 3 | Identify systematic | response- | WS1 Gate |
|   | weaknesses; write | analyzer- |   |
|   | Improvement Proposal | improvement- |   |
|   |   | proposal.md |   |
| 3–4 | Design new insight | insight- | WS2 Gate |
|   | strategies (write design | strategy- |   |
|   | rationale) | design- |   |
|   |   | rationale.md |   |
| 4–5 | Begin | confidence- | — |
|   | ConfidenceCalculator | calibration- |   |
|   | calibration study; build | dataset.json |   |
|   | calibration dataset |   |   |
| 5 | Friday Design Review | Present: baseline | — |
|   | #2 | results, weaknesses |   |
|   |   | found, strategy designs, |   |
|   |   | calibration progress |   |

## Week 3: Strategy Implementation & Calibration

| Day | Task | Deliverable | Gate |
| --- | --- | --- | --- |
| 1 | WS1 Gate Review: | — | or iterate |
|   | Improvement Proposal |   |   |
|   | approved/modified |   |   |
| 1–2 | Implement Strategy A | New strategy file | — |
|   | (per approved design) |   |   |
|   | + self-test |   |   |
| 2–3 | Implement Strategy B | New strategy file | — |
|   | (per approved design) |   |   |
|   | + self-test |   |   |
| 3–4 | Complete | ConfidenceCalib | WS3 Gate |
|   | ConfidenceCalculator | rationReport.md, |   |
|   | calibration report and | AlternativeDeca |   |
|   | alternative decay | yStrategies.md |   |
|   | proposals |   |   |
| 4–5 | Begin research work: | Research docs (drafts) — |   |
|   | lexical vs. semantic, |   |   |


| Day | Task | Deliverable | Gate |
| --- | --- | --- | --- |
|   | browser ML feasibility |   |   |
| 5 | Friday Design Review | Present: strategies, | — |
|   | #3 | calibration findings, |   |
|   |   | research progress |   |

## Week 4: Implementation, Research Completion & Documentation

| Day | Task | Deliverable | Gate |
| --- | --- | --- | --- |
| 1 | WS3 Gate Review: | — | or iterate |
|   | Calibration proposals |   |   |
|   | approved/modified |   |   |
| 1–2 | Implement approved | Modified files with | — |
|   | analyzer improvements | version bumps |   |
|   | (WS5) + implement |   |   |
|   | approved |   |   |
|   | ConfidenceCalculator |   |   |
|   | changes |   |   |
| 2–3 | Run full benchmark | analyzer- | — |
|   | suite: before/after | improvement- |   |
|   | comparison | delta.md |   |
| 3–4 | Complete research | Research docs finalized — |   |
|   | documents (gap |   |   |
|   | detection, |   |   |
|   | explainability, ranking) |   |   |
| 4 | Final integration: tsc | All checks green | — |
|   | --noEmit, all self- |   |   |
|   | tests, full benchmark |   |   |
| 5 | Write final algorithm | intelligence- | — |
|   | design documentation | layer- |   |
|   |   | algorithm- |   |
|   |   | design.md |   |
| 5 | Friday Design Review | Present: all | — |
|   | #4 (Final) | deliverables, |   |
|   |   | benchmark results, |   |
|   |   | research findings, |   |
|   |   | sprint retrospective |   |


## 10. Expected Engineering Deliverables

## Code Deliverables

| # | Deliverable | Path | Type | Gate |
| --- | --- | --- | --- | --- |
| D1 | New Insight | src/ | New | Design rationale |
|   | Strategy A | engines/ |   | approved |
|   |   | insights/ |   |   |
|   |   | strategies/ |   |   |
| D2 | New Insight | src/ | New | Design rationale |
|   | Strategy B | engines/ |   | approved |
|   |   | insights/ |   |   |
|   |   | strategies/ |   |   |
| D3 | Self-tests for new | src/ | New | — |
|   | strategies | engines/ |   |   |
|   |   | insights/ |   |   |
|   |   | strategies/ |   |   |
|   |   | *.selftest.t |   |   |
|   |   | s |   |   |
| D4 | Improved | src/ | Modified | Improvement |
|   | Analyzers (v1.1.0) | engines/ |   | Proposal approved |
|   |   | response/ |   |   |
|   |   | analyzers/ |   |   |
| D5 | Calibrated | src/ | Modified | Calibration Study |
|   | ConfidenceCalcul | engines/ |   | approved |
|   | ator | insights/ |   |   |
|   |   | ConfidenceCa |   |   |
|   |   | lculator.ts |   |   |
| D6 | Response | src/tests/ | New | Schema approved |
|   | Analyzer Dataset | evaluation/ |   |   |
|   |   | datasets/ |   |   |
|   |   | response- |   |   |
|   |   | analyzer- |   |   |
|   |   | dataset.json |   |   |
| D7 | Insight Strategy | src/tests/ | New | — |
|   | Dataset | evaluation/ |   |   |
|   |   | datasets/ |   |   |
|   |   | insight- |   |   |
|   |   | strategy- |   |   |
|   |   | dataset.json |   |   |
| D8 | Confidence | src/tests/ | New | — |
|   | Calibration | evaluation/ |   |   |
|   | Dataset | datasets/ |   |   |
|   |   | confidence- |   |   |
|   |   | calibration- |   |   |
|   |   | dataset.json |   |   |
| D9 | Intelligence | src/tests/ | New | — |
|   | Benchmark | benchmarks/ |   |   |
|   | Harness | intelligence |   |   |


| # | Deliverable | Path | Type | Gate |
| --- | --- | --- | --- | --- |
|   |   | - |   |   |
|   |   | benchmark.ts |   |   |

## Documentation Deliverables

| # | Deliverable | Path |
| --- | --- | --- |
| D10 | Intelligence Layer Architecture | docs/research/ |
|   | Notes | intelligence-layer- |
|   |   | architecture-notes.md |
| D11 | Response Analyzer Baseline | docs/evaluation/ |
|   | Report | response-analyzer- |
|   |   | baseline-report.md |
| D12 | Response Analyzer | docs/evaluation/ |
|   | Improvement Proposal | response-analyzer- |
|   |   | improvement- |
|   |   | proposal.md |
| D13 | Analyzer Improvement Delta | docs/benchmarks/ |
|   | Report | analyzer-improvement- |
|   |   | delta.md |
| D14 | Insight Strategy Design | docs/research/ |
|   | Rationale | insight-strategy- |
|   |   | design-rationale.md |
| D15 | Confidence Calibration Report | docs/evaluation/ |
|   |   | ConfidenceCalibration |
|   |   | Report.md |
| D16 | Alternative Decay Strategies | docs/research/ |
|   |   | AlternativeDecayStrat |
|   |   | egies.md |
| D17 | Lexical vs. Semantic Gap | docs/research/ |
|   | Detection | lexical-vs-semantic- |
|   |   | gap-detection.md |
| D18 | Browser Extension ML | docs/research/ |
|   | Feasibility | browser-extension-ml- |
|   |   | feasibility.md |
| D19 | Insight Explainability Research | docs/research/ |
|   |   | insight- |
|   |   | explainability.md |
| D20 | Algorithm Design | docs/research/ |
|   | Documentation | intelligence-layer- |
|   |   | algorithm-design.md |


## 11. Research Work Required

| Topic | Questions to Answer | Output |
| --- | --- | --- |
| Reasoning Markers | Are the current 15 reasoning | Improved marker list (with |
|   | markers sufficient? What | evidence) |
|   | markers do |   |
|   | ChatGPT/Claude/Gemini |   |
|   | actually use? |   |
| Structure Scoring | Is the 500-char "prose_heavy" | Data-driven threshold (with |
|   | threshold valid? What is the | distribution analysis) |
|   | actual distribution of response |   |
|   | lengths? |   |
| Completeness Detection | Can unclosed markdown | Enhanced completeness |
|   | detection be improved beyond | algorithm (proposed) |
|   | backtick counting? |   |
| Decay Curves | Is stepped decay better than | Calibration analysis (with |
|   | exponential decay for | quantitative comparison) |
|   | behavioral evidence? |   |
| Lexical vs. Semantic | Can lightweight embeddings | Feasibility document |
|   | replace substring matching |   |
|   | within <200ms? |   |
| Sentence Transformers | Can all-MiniLM-L6-v2 (22MB) | Feasibility document |
|   | run in a service worker? |   |
| TF-IDF | Can TF-IDF features improve | Research document |
|   | gap type classification? |   |
| Explainability | How can SHAP/feature | Research document |
|   | attribution explain insight |   |
|   | generation? |   |
| Ranking Systems | Can learning-to-rank improve | Research document |
|   | quality score weighting? |   |
| Automaticity Theory | Is Fitts & Posner correct, or | Theoretical grounding |
|   | should we use ACT-R/Dreyfus? | document |

## 12. Algorithm Design Tasks

| Algorithm | Current State | Design Task |
| --- | --- | --- |
| Structure Scoring | Linear: baseline 0.5 ± | Propose non-linear scoring that |
|   | adjustments | accounts for response type |
| Reasoning Depth | Marker count × weights, capped Propose scoring that penalizes |   |
|   |   | marker stuffing |
| Completeness | Default 0.8 ± adjustments | Propose multi-signal |
|   |   | completeness detection |
| Composite Quality | Fixed weights: 40/40/20 | Propose and validate alternative |


| Algorithm | Current State | Design Task |
| --- | --- | --- |
|   |   | weight distributions using |
|   |   | labeled data |
| Confidence Decay | Stepped: 100%/50%/10% | Propose exponential or sigmoid |
|   |   | decay with justification |
| Contradiction Penalty | Fixed 40% unless 2× evidence Propose evidence-ratio-based |   |
|   |   | penalty curve |

[!IMPORTANT] All design tasks produce proposals, not implementations. Implementation follows review and approval.

## 13. Evaluation Methodology

## Response Analyzers

- Metric: Mean Absolute Error (MAE) between predicted score and human-labeled score

- Metric: Flag Detection F1 (precision + recall of structural/reasoning/completeness flags)

- Baseline: Current v1.0.0 analyzers against the labeled dataset

- Target: e15% reduction in MAE and e10% improvement in flag F1

## Insight Strategies

- Metric: Insight Relevance (does the strategy produce insights for scenarios where a human would agree?)

- Metric: Confidence Calibration (is a 0.9 confidence insight actually correct ~90% of the time?)

- Method: Run strategies against mock session histories with known expected outcomes

## Confidence Calculator

- Metric: Calibration Error (difference between predicted confidence and observed correctness)

- Method: Generate synthetic evidence distributions and compare calculator output to expected ranges

## 14. Testing Strategy

| Test Type | What It Covers | Location |
| --- | --- | --- |
| Self-tests | Individual strategy correctness | *.selftest.ts |
|   |   | (framework-free, following |
|   |   | GapDetectionEngine pattern) |


| Test Type | What It Covers | Location |
| --- | --- | --- |
| Evaluation benchmarks | Accuracy against labeled | src/tests/ |
|   | datasets | benchmarks/ |
|   |   | intelligence- |
|   |   | benchmark.ts |
| Type checking | Compilation correctness | tsc --noEmit |
| Architecture validation | No forbidden imports | Manual review |

## 15. Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Dataset bias | Medium | High | Require platform |
|   |   |   | diversity; review |
|   |   |   | schema before labeling |
| Overfitting heuristics | Medium | Medium | Split dataset into |
|   |   |   | evaluation (70%) and |
|   |   |   | holdout (30%) |
| Premature | Medium | High | Strict engineering gates |
| implementation |   |   | at every workstream |
|   |   |   | boundary |
| Scope creep into | Low | Critical | Architectural |
| infrastructure |   |   | boundaries explicitly |
|   |   |   | documented and |
|   |   |   | reviewed |
| Latency regression | Low | High | Benchmark latency |
|   |   |   | before/after; respect |
|   |   |   | latencyBudgetMs |
| Interface drift | Very Low | High | ResponseAnalyze |
|   |   |   | r and |
|   |   |   | InsightStrategy |
|   |   |   | interfaces are stable |

## 16. Success Metrics

| Metric | Threshold | Measurement |
| --- | --- | --- |
| Architecture comprehension WS0 deliverables approved |   | Architecture Lead review |
| Response analyzer MAE | ≥15% reduction vs. v1.0.0 | Benchmark harness |
| improvement |   |   |
| Flag detection F1 improvement ≥10% improvement vs. v1.0.0 Benchmark harness |   |   |
| New insight strategies delivered ≥2 with self-tests |   | Code review |


| Metric | Threshold | Measurement |
| --- | --- | --- |
| Evaluation dataset size | ≥50 labeled responses, ≥20 | File inspection |
|   | session histories |   |
| Confidence calibration error | <0.15 mean calibration error | Calibration dataset |
| Research documents delivered ≥5 |   | Directory inspection |
| Design Reviews completed | 4 (weekly) | Meeting attendance |
| TypeScript compilation | Zero errors | tsc --noEmit |
| Architectural boundary | Zero | Import analysis |
| violations |   |   |

## 17. Definition of Done

This sprint is complete when:

- \- WS0: Intelligence Layer architecture notes, dependency diagram, and event flow diagram delivered and approved

- \- WS1: All 4 response analyzers evaluated against a labeled dataset with documented baseline, systematic weaknesses identified, and improvement proposal reviewed

- \- WS2: At least 2 new InsightStrategy implementations exist, each with design rationale, self-tests, and evaluation data

-  WS3: ConfidenceCalculator calibration study complete with alternative decay proposals reviewed; approved changes implemented with before/after benchmarks

- ‐ WS4: At least 5 research documents delivered covering NLP feasibility, explainability, and theoretical grounding

-  WS5: Approved analyzer improvements implemented with measurable before/after delta

- ‐ All code compiles with zero errors (tsc --noEmit)

- All self-tests pass

- ‒ No code imports from src/storage/, src/platforms/, src/core/event- bus/EventBus.ts, or src/sidepanel/

-  4 weekly Design Reviews completed

-  All documentation directories (docs/research/, docs/evaluation/, docs/benchmarks/, docs/experiments/) populated

- All work has been reviewed by the Architecture Lead

This proposal is submitted for Architecture Lead review. Upon approval, it will be converted into an official Cognis PRD and broken into trackable engineering tickets.
