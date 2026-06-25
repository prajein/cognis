import activationProfilesJson from "./activation_profiles.json";

import type {
  ActivationProfile,
  ActivationProfilesConfig,
  TaskCategory,
} from "../types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const activationProfiles =
  activationProfilesJson as ActivationProfilesConfig;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the complete activation profile configuration.
 */
export function getActivationProfilesConfig(): ActivationProfilesConfig {
  return activationProfiles;
}

/**
 * Returns every activation profile in the taxonomy.
 */
export function getAllActivationProfiles(): readonly ActivationProfile[] {
  return activationProfiles.profiles;
}

/**
 * Returns the activation profile for a specific task.
 */
export function getActivationProfile(
  taskId: string
): ActivationProfile | undefined {
  return activationProfiles.profiles.find(
    profile => profile.task_id === taskId
  );
}

/**
 * Returns all activation profiles belonging to a category.
 */
export function getActivationProfilesByCategory(
  category: TaskCategory
): readonly ActivationProfile[] {
  return activationProfiles.profiles.filter(
    profile => profile.category === category
  );
}

/**
 * Returns true if an activation profile exists.
 */
export function hasActivationProfile(taskId: string): boolean {
  return activationProfiles.profiles.some(
    profile => profile.task_id === taskId
  );
}