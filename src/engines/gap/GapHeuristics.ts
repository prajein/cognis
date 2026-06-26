/**
 * GapHeuristics — pure, on-device gap-detection rules
 *
 * What & why: this is the heart of the Week-1 "draft the gap-detection rules and
 * pick the on-device approach" deliverable. It is a pure function over a
 * `GapAnalysisInput` — no EventBus, no storage, no DOM, no network, no clock —
 * which makes it trivially testable and keeps the engine replaceable.
 *
 * On-device approach (v0.1): deterministic lexical-marker heuristics. For each
 * gap type the rule set defines markers whose PRESENCE means the gap is already
 * addressed; their ABSENCE means the gap is likely present. Confidence starts at
 * the rule's base value and is nudged by cognitive state and revision depth.
 * Everything tunable lives in `gap_rules.json` — this module holds no magic
 * numbers or strings. A pretrained stem/NLU model can later replace or augment
 * this class behind the same `detect()` signature (Definition of Done #10).
 *
 * Latency: a handful of substring scans over a single prompt — microseconds,
 * far inside the Ghost Text (<200ms) and enrichment (<100ms) budgets.
 */

import {
  GapRulesConfig,
  getGapRulesConfig,
} from "../../core/config/gap-rules-loader";
import { GapAnalysisInput, GapAnalysisResult, GapSignal } from "./types";

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
    const revisionBoost = this.revisionBoost(input.revisionDepth);
    const stateBoost = this.config.stateModifiers[input.state] ?? 0;

    const signals: GapSignal[] = [];
    for (const rule of this.config.rules) {
      const addressed = rule.satisfiedWhenAnyPresent.some((marker) =>
        haystack.includes(marker.toLowerCase()),
      );
      if (addressed) {
        continue;
      }

      const confidence = clamp01(
        rule.baseConfidence + stateBoost + revisionBoost,
      );
      if (confidence >= settings.emitThreshold) {
        signals.push({ gapType: rule.gapType, confidence });
      }
    }

    signals.sort((a, b) => b.confidence - a.confidence);
    return { signals: signals.slice(0, settings.maxSignals) };
  }

  /** Additive confidence from revision depth, capped per config. */
  private revisionBoost(revisionDepth: number): number {
    const { perRevision, max } = this.config.revisionModifier;
    return Math.min(Math.max(revisionDepth, 0) * perRevision, max);
  }
}

/** Clamps a number into the inclusive [0, 1] confidence range. */
function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
