/**
 * Normalizes a task ID string into a safe, lowercase alphanumeric slug.
 */
export function normalizeTaskId(taskId: string): string {
  return taskId.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

/**
 * Converts a task ID into its corresponding deterministic asset filename (.svg).
 */
export function taskIdToAssetName(taskId: string): string {
  return `brain-map-${normalizeTaskId(taskId)}.svg`;
}
