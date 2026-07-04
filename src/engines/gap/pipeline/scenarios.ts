/**
 * Gap pipeline scenario corpus
 *
 * What & why: a golden set of prompts with the gaps the current rules are
 * expected to flag. Running these through `GapPipeline` pins the behaviour of
 * `gap_rules.json`, so anyone tuning the rules immediately sees which prompts
 * changed. It doubles as living documentation of what the heuristics do and a
 * script for the Friday demo (no live site needed).
 *
 * `expect` is the exact set of gap types the engine should emit (order-
 * independent — the pipeline sorts strongest-first, but the corpus asserts the
 * set). Keep prompts realistic and comment the intent of each case.
 */

import { GapType } from "../../../core/types/gap.types";
import { StateLabel } from "../../../core/types/state.types";

export interface GapScenario {
  readonly name: string;
  readonly text: string;
  readonly state?: StateLabel;
  readonly revisionDepth?: number;
  /** Exact set of gap types expected (order-independent). */
  readonly expect: readonly GapType[];
  /** What this scenario is meant to demonstrate. */
  readonly note: string;
}

export const GAP_SCENARIOS: readonly GapScenario[] = [
  {
    name: "bare-imperative",
    text: "Write a function",
    expect: ["intentionality", "audience", "constraint"],
    note: "No context at all. Top three highest-priority gaps fire; mechanism (0.5) is capped out by maxSignals=3.",
  },
  {
    name: "fully-specified",
    text: "My goal is to write a sorting function for a beginner audience; it must run in n log n time, using merge sort, and this matters because it is for a graded exam.",
    expect: [],
    note: "Intent, audience, constraint, mechanism and stakes markers are all present — nothing to flag.",
  },
  {
    name: "audience-missing",
    text: "My goal is to refactor this using the strategy pattern, and it must stay simple.",
    expect: ["audience"],
    note: "Intent, mechanism and constraint are addressed; only the audience is left unstated.",
  },
  {
    name: "audience-missing-coasting",
    text: "My goal is to refactor this using the strategy pattern, and it must stay simple.",
    state: "coasting",
    expect: [],
    note: "Same prompt as audience-missing, but coasting (-0.1) drops audience (0.55→0.45) below the emit threshold.",
  },
  {
    name: "constraint-frees-mechanism-slot",
    text: "Summarize this article, keep it concise, in no more than three bullets.",
    expect: ["intentionality", "audience", "mechanism"],
    note: "Constraint is satisfied, which frees a top-3 slot for mechanism (0.5) alongside intent and audience.",
  },
  {
    name: "explain-how",
    text: "Explain how neural networks actually learn from data.",
    expect: ["intentionality", "audience", "constraint"],
    note: "'how' satisfies mechanism; the three top-priority gaps remain.",
  },
  {
    name: "well-scoped-but-no-stakes-or-assumption-stretch",
    text: "My goal is to optimize this query for a data team using an index, and it must return quickly.",
    state: "stretch",
    expect: [],
    note: "Intent/audience/constraint/mechanism satisfied; stakes (0.4) and assumption (0.45) stay below threshold in stretch.",
  },
  {
    name: "well-scoped-but-no-stakes-or-assumption-overload",
    text: "My goal is to optimize this query for a data team using an index, and it must return quickly.",
    state: "overload",
    expect: ["assumption", "stakes"],
    note: "Same prompt under overload (+0.1): assumption (0.55) and stakes (0.5) now clear the threshold. Shows the state modifier.",
  },
  {
    name: "too-short",
    text: "help me",
    expect: [],
    note: "Below minTextLength (12) — the pipeline does not analyse fragments.",
  },
  {
    name: "revision-pressure-overload",
    text: "Handle the edge cases in the parser correctly.",
    state: "overload",
    revisionDepth: 4,
    expect: ["intentionality", "audience", "constraint"],
    note: "Overload + repeated revisions raise every confidence, but maxSignals=3 still keeps only the strongest three.",
  },
];
