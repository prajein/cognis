import activationProfilesJson from "./activation_profiles.json";

import {
  ActivationProfile,
  ActivationProfilesConfig,
  TaskCategory,
  TaskId,
  toTaskId,
  toSkillDomain,
  toHours,
} from "../types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const rawConfig = activationProfilesJson as any;

const mappedProfiles: ActivationProfile[] = rawConfig.profiles.map((p: any) => ({
  ...p,
  task_id: toTaskId(p.task_id),
  skill_domain: toSkillDomain(p.skill_domain),
  transition_threshold_hours: p.transition_threshold_hours !== null ? toHours(p.transition_threshold_hours) : null,
}));

const activationProfiles: ActivationProfilesConfig = {
  ...rawConfig,
  profiles: mappedProfiles,
};

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
  taskId: TaskId
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
export function hasActivationProfile(taskId: TaskId): boolean {
  return activationProfiles.profiles.some(
    profile => profile.task_id === taskId
  );
}