/**
 * Mock Harness — Types & Configuration Interfaces
 *
 * What & why: defines the configuration DTOs and simulation parameters for the
 * Mock Harness. These types are consumed by `MockHarness`, `SyntheticEventGenerator`,
 * and `StreamSimulator`. No runtime code lives here — only shapes.
 *
 * Architectural constraints:
 * - No imports from engines, storage, platforms, or sidepanel.
 * - Depends only on `core/event-bus` and `core/types` (the event infrastructure).
 */

import { EventFactoryOptions } from '../../core/event-bus/createDomainEvent';

// ---------------------------------------------------------------------------
// Harness Configuration
// ---------------------------------------------------------------------------

/**
 * Top-level configuration for the MockHarness.
 *
 * Every field is optional; sensible defaults are applied by `MockHarness`
 * when values are omitted. Tests inject deterministic overrides via
 * `eventFactoryOptions`.
 */
export interface MockHarnessConfig {
  /** Platform string stamped on `session.started` events (default: 'mock-harness'). */
  readonly platform?: string;

  /** Optional task identifier for session events. */
  readonly taskId?: string;

  /** Overrides for the event envelope factory (clock, id source). */
  readonly eventFactoryOptions?: EventFactoryOptions;
}

// ---------------------------------------------------------------------------
// Typing Simulation Options
// ---------------------------------------------------------------------------

/**
 * Options controlling a single `simulateTyping` invocation.
 */
export interface TypingSimulationOptions {
  /** Simulated word count (default: derived from text). */
  readonly wordCount?: number;

  /** Simulated revision depth (default: 0). */
  readonly revisionDepth?: number;
}

// ---------------------------------------------------------------------------
// Response Streaming Options
// ---------------------------------------------------------------------------

/**
 * Options controlling a single `simulateResponse` invocation.
 */
export interface StreamSimulationOptions {
  /** Size of each streaming chunk in characters (default: 12). */
  readonly chunkSize?: number;

  /** Delay between chunks in milliseconds (default: 50). */
  readonly chunkDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Hardware Simulation Types
// ---------------------------------------------------------------------------

/**
 * Pre-defined hardware signal types matching the Arc specification.
 * Extensible: any string is accepted by `HardwareSignalReceivedPayload`,
 * but these are the documented signal types.
 */
export type ArcSignalType =
  | 'eeg_alpha'
  | 'eeg_beta'
  | 'eeg_theta'
  | 'ppg_heart_rate'
  | 'imu_motion'
  | 'temperature';
