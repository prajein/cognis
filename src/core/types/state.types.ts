/**
 * State Domain Types
 *
 * Defines the cognitive state labels used by the State Engine.
 * These labels represent the inferred cognitive load of the user
 * during an AI interaction session.
 *
 * Producer: State Engine
 * Consumer: Gap Detection Engine, Enrichment Engine, Storage Layer
 *
 * This type is Arc-stable. Future hardware providers must emit
 * state.changed events using these same labels.
 */

/**
 * Cognitive state classification.
 *
 * - stretch:  User is operating at the edge of competence.
 *             Productive struggle; ideal learning zone.
 * - coasting: User is operating well within competence.
 *             Low cognitive engagement; risk of offloading.
 * - overload: User is operating beyond current capacity.
 *             High cognitive load; risk of abandonment.
 */
export type StateLabel = 'stretch' | 'coasting' | 'overload';
