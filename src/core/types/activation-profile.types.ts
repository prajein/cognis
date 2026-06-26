/**
 * Activation Profile Domain Types
 *
 * Defines the strongly typed structure of the research-derived
 * activation profile configuration used by Cognis.
 *
 * Activation profiles represent baseline brain-region activation
 * for every supported task in the Cognis taxonomy.
 *
 * Producer: Configuration Layer
 * Consumers: Surface B, Projection Layer, Insights Engine
 *
 * These profiles are loaded from versioned JSON configuration
 * and must never be hardcoded in application logic.
 */

// ---------------------------------------------------------------------------
// Basic Domain Types
// ---------------------------------------------------------------------------

/**
 * Stable identifier for a task in the Cognis taxonomy.
 */
declare const __taskIdBrand: unique symbol;
export type TaskId = string & { readonly __brand: typeof __taskIdBrand };
export function toTaskId(id: string): TaskId {
  return id as TaskId;
}

/**
 * Stable identifier for a skill domain.
 */
declare const __skillDomainBrand: unique symbol;
export type SkillDomain = string & { readonly __brand: typeof __skillDomainBrand };
export function toSkillDomain(domain: string): SkillDomain {
  return domain as SkillDomain;
}

/**
 * Approximate deliberate-practice hours.
 */
declare const __hoursBrand: unique symbol;
export type Hours = number & { readonly __brand: typeof __hoursBrand };
export function toHours(hours: number): Hours {
  return hours as Hours;
}

/**
 * Brain-region activation score.
 *
 * 0 = inactive
 * 1 = low
 * 2 = moderate
 * 3 = high
 * 4 = peak
 */
export type RegionScore = 0 | 1 | 2 | 3 | 4;

/**
 * Top-level task categories.
 */
export type TaskCategory =
  | "Cognitive"
  | "Creative"
  | "AI-Assisted Work"
  | "Sport and Movement"
  | "Restorative";

/**
 * Automaticity modelling strategy.
 */
export type AutomaticityType =
  | "cognitive"
  | "creative"
  | "motor"
  | "ai"
  | "restorative";

// ---------------------------------------------------------------------------
// Domain Interfaces
// ---------------------------------------------------------------------------

/**
 * Baseline activation levels for the ten supported brain regions.
 */
export interface RegionProfile {
  readonly DLPFC: RegionScore;
  readonly mPFC: RegionScore;
  readonly M1: RegionScore;
  readonly Parietal: RegionScore;
  readonly Temporal: RegionScore;
  readonly Occipital: RegionScore;
  readonly Cerebellum: RegionScore;
  readonly Hippocampus: RegionScore;
  readonly Amygdala: RegionScore;
  readonly ACC: RegionScore;
}

/**
 * Research-derived activation profile for a single task.
 */
export interface ActivationProfile {
  readonly task_id: TaskId;
  readonly display_name: string;
  readonly category: TaskCategory;
  readonly subclass: string | null;
  readonly skill_domain: SkillDomain;
  readonly region_profile: RegionProfile;
  readonly key_insight: string;
  readonly automaticity_type: AutomaticityType;
  readonly transition_threshold_hours: Hours | null;
}

/**
 * Root activation profile configuration.
 */
export interface ActivationProfilesConfig {
  readonly version: string;
  readonly note?: string;
  readonly profiles: readonly ActivationProfile[];
}