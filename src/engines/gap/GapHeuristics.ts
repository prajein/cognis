/**
 * GapHeuristics — pure, on-device gap-detection rules
 *
 * What & why: this is the heart of the Week-1 "draft the gap-detection rules and
 * pick the on-device approach" deliverable. It is a pure function over a
 * `GapAnalysisInput` — no EventBus, no storage, no DOM, no network, no clock —
 * which makes it trivially testable and keeps the engine replaceable.
 *
 * On-device approach (v0.2): deterministic weighted-evidence heuristics. For
 * each gap type the rule set defines markers whose PRESENCE accumulates
 * evidence that the gap is already addressed. v0.1 was a binary
 * any-marker-present check; v0.2 grades that evidence — an exact marker match
 * counts at full weight, a light stem match (e.g. "assuming" for "assume") or
 * a bounded single-character-edit fuzzy match counts at a discount — and sums
 * it into a `matchScore` in [0, 1]. A gap is addressed once `matchScore`
 * clears `settings.addressedThreshold`; otherwise leftover evidence nudges
 * confidence down slightly rather than leaving it untouched, so a near-miss
 * reads differently from a total miss. Everything tunable lives in
 * `gap_rules.json` — this module holds no magic numbers or strings beyond the
 * matcher's own discount factors, which are algorithmic constants, not
 * content. A pretrained stem/NLU model can later replace or augment this
 * class behind the same `detect()` signature (Definition of Done #10).
 *
 * Latency: bounded substring/stem/edit-distance scans over a single prompt —
 * still comfortably inside the Ghost Text (<200ms) and enrichment (<100ms)
 * budgets (see `GapHeuristics.selftest.ts` for a timing assertion). Fuzzy and
 * stem matching only run for single-word markers that didn't already match
 * exactly, keeping the worst case bounded.
 */

import {
  GapRulesConfig,
  getGapRulesConfig,
  MarkerEntry,
} from "../../core/config/gap-rules-loader";
import { GapAnalysisInput, GapAnalysisResult, GapSignal } from "./types";

/** Default "addressed" cutoff when a config predates `addressedThreshold`. */
const DEFAULT_ADDRESSED_THRESHOLD = 0.5;
/** Evidence discount for a stem match (e.g. "assuming" ~ "assume"). */
const STEM_MATCH_FACTOR = 0.75;
/** Evidence discount for a bounded fuzzy (single-edit) match. */
const FUZZY_MATCH_FACTOR = 0.5;
/** Max Levenshtein distance considered a fuzzy match. */
const MAX_FUZZY_EDIT_DISTANCE = 1;
/** Fuzzy matching only applies to words at least this long, to avoid noise. */
const MIN_FUZZY_WORD_LENGTH = 5;
/** How much unaddressed evidence subtracts from confidence, at matchScore=1. */
const PARTIAL_EVIDENCE_PENALTY = 0.3;

export class GapHeuristics {
  private readonly config: GapRulesConfig;

  /**
   * @param config Gap-rules config. Defaults to the runtime-loaded config;
   *               tests may inject a fixture for determinism.
   */
  constructor(config: GapRulesConfig = getGapRulesConfig()) {
    this.config = config;
  }

  /**
   * Runs every gap rule against the input and returns the signals that clear
   * the configured emit threshold, strongest first, capped at `maxSignals`.
   */
  public detect(input: GapAnalysisInput): GapAnalysisResult {
    const { settings } = this.config;
    const text = input.text;

    // Text rules need enough content to be meaningful. Without text (metric-only
    // pass) we have nothing lexical to reason over, so we emit nothing — the
    // honest v0.1 stance. The in-memory text channel feeds richer passes later.
    if (text === undefined || text.length < settings.minTextLength) {
      return { signals: [] };
    }

    const haystack = text.toLowerCase();
    const haystackWords = tokenize(haystack);
    const revisionBoost = this.revisionBoost(input.revisionDepth);
    const stateBoost = this.config.stateModifiers[input.state] ?? 0;
    const addressedThreshold =
      settings.addressedThreshold ?? DEFAULT_ADDRESSED_THRESHOLD;

    const signals: GapSignal[] = [];
    for (const rule of this.config.rules) {
      const matchScore = this.matchScore(
        haystack,
        haystackWords,
        rule.satisfiedWhenAnyPresent,
      );
      if (matchScore >= addressedThreshold) {
        continue;
      }

      // Leftover (sub-threshold) evidence means the prompt came *close* to
      // addressing the gap — nudge confidence down rather than treating a
      // near-miss identically to a total miss.
      const partialPenalty = matchScore * PARTIAL_EVIDENCE_PENALTY;
      const confidence = clamp01(
        rule.baseConfidence + stateBoost + revisionBoost - partialPenalty,
      );
      if (confidence >= settings.emitThreshold) {
        signals.push({ gapType: rule.gapType, confidence });
      }
    }

    signals.sort((a, b) => b.confidence - a.confidence);
    return { signals: signals.slice(0, settings.maxSignals) };
  }

  /**
   * Weighted evidence score in [0, 1] for how "addressed" a gap's markers are
   * in the prompt. Exact substring hits count at the marker's full weight;
   * single-word markers that don't hit exactly also get a discounted stem or
   * fuzzy pass. Multi-word markers only ever match exactly (fuzzy/stem
   * matching a whole phrase isn't meaningfully cheap or reliable at this
   * layer, so it's left to a future NLU pass behind the same signature).
   */
  private matchScore(
    haystack: string,
    haystackWords: readonly string[],
    markers: readonly MarkerEntry[],
  ): number {
    let score = 0;
    for (const entry of markers) {
      const marker = typeof entry === "string" ? entry : entry.marker;
      const weight = typeof entry === "string" ? 1 : (entry.weight ?? 1);
      const markerLower = marker.toLowerCase().trim();

      if (haystack.includes(markerLower)) {
        score += weight;
        continue;
      }

      if (markerLower.includes(" ") || markerLower.length === 0) {
        continue; // multi-word markers: exact match only
      }

      if (this.stemMatch(haystackWords, markerLower)) {
        score += weight * STEM_MATCH_FACTOR;
      } else if (this.fuzzyMatch(haystackWords, markerLower)) {
        score += weight * FUZZY_MATCH_FACTOR;
      }
    }
    return Math.min(score, 1);
  }

  /** True if any haystack word shares a stem with the (single-word) marker. */
  private stemMatch(haystackWords: readonly string[], marker: string): boolean {
    const markerStem = stem(marker);
    if (markerStem.length < 3) return false;
    return haystackWords.some((word) => stem(word) === markerStem);
  }

  /** True if any haystack word is within one edit of the (single-word) marker. */
  private fuzzyMatch(haystackWords: readonly string[], marker: string): boolean {
    if (marker.length < MIN_FUZZY_WORD_LENGTH) return false;
    return haystackWords.some(
      (word) =>
        word.length >= MIN_FUZZY_WORD_LENGTH &&
        Math.abs(word.length - marker.length) <= MAX_FUZZY_EDIT_DISTANCE &&
        boundedEditDistance(word, marker, MAX_FUZZY_EDIT_DISTANCE) <=
          MAX_FUZZY_EDIT_DISTANCE,
    );
  }

  /** Additive confidence from revision depth, capped per config. */
  private revisionBoost(revisionDepth: number): number {
    const { perRevision, max } = this.config.revisionModifier;
    return Math.min(Math.max(revisionDepth, 0) * perRevision, max);
  }
}

/** Splits lowercase text into word tokens (letters, digits, apostrophes). */
function tokenize(text: string): string[] {
  return text.split(/[^a-z0-9']+/).filter(Boolean);
}

/**
 * Strips a handful of common English suffixes, e.g. "assuming" -> "assum",
 * then a trailing silent "e" so "assume" also normalizes to "assum" (the
 * usual English spelling shift when adding "-ing" to an e-ending verb).
 */
function stem(word: string): string {
  return word.replace(/(ing|tion|edly|ed|es|s)$/i, "").replace(/e$/i, "");
}

/**
 * Levenshtein distance between two short strings, short-circuited to
 * `maxDistance + 1` as soon as it's clear the bound is exceeded. Only ever
 * called on single words under ~20 characters, so this stays microseconds.
 */
function boundedEditDistance(a: string, b: string, maxDistance: number): number {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let prev: number[] = new Array(b.length + 1);
  let curr: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Clamps a number into the inclusive [0, 1] confidence range. */
function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
