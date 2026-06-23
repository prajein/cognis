/**
 * Gap Domain Types
 *
 * Defines the taxonomy of cognitive gaps detectable by the Gap Detection Engine.
 * Each gap type represents a specific category of missing context or
 * under-specification in a user's prompt.
 *
 * Producer: Gap Detection Engine
 * Consumer: Ghost Text Engine, Enrichment Engine, Storage Layer
 *
 * This taxonomy is extensible. New gap types must be added here
 * and documented in the event registry before use.
 */

/**
 * Classification of cognitive gaps in user prompts.
 *
 * - intentionality: The user has not clarified what they want to achieve.
 * - audience:       The user has not specified who the output is for.
 * - constraint:     The user has not defined boundaries or limitations.
 * - stakes:         The user has not conveyed the importance or consequences.
 * - assumption:     The user has embedded unstated assumptions.
 * - mechanism:      The user has not specified how something should work.
 * - temporal:       The user has not established timeframes or sequencing.
 * - second_order:   The user has not considered downstream effects.
 */
export type GapType =
  | 'intentionality'
  | 'audience'
  | 'constraint'
  | 'stakes'
  | 'assumption'
  | 'mechanism'
  | 'temporal'
  | 'second_order';
