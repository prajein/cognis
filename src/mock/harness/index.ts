/**
 * Mock Harness — Public API barrel export
 *
 * What & why: re-exports the public surface of the Mock Harness module.
 * Consumers import from `mock/harness` rather than reaching into individual
 * files, so internal file organisation can evolve without breaking imports.
 */

export { MockHarness } from './MockHarness';
export { SyntheticEventGenerator } from './SyntheticEventGenerator';
export { StreamSimulator } from './StreamSimulator';
export type { DelayFn } from './StreamSimulator';
export type {
  MockHarnessConfig,
  TypingSimulationOptions,
  StreamSimulationOptions,
  ArcSignalType,
} from './types';
