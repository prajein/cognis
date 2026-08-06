/**
 * MockHarness — Offline synthetic event producer
 *
 * What & why: the top-level orchestrator for the Week 1 Mock Harness. Provides
 * a high-level API for simulating complete user interactions — typing, pauses,
 * AI response streaming, session lifecycle, and Arc hardware signals — all
 * without requiring live AI platforms, browser DOM, or physical hardware.
 *
 * The harness produces standard `DomainEvent<T>` envelopes and publishes them
 * onto the `EventBus`. Downstream engines, storage, and projections process
 * these events identically to live events. No alternative code paths exist for
 * simulated input.
 *
 * Architectural constraints:
 * - Communicates exclusively through `EventBusContract.publish()`.
 * - All events minted through `createDomainEvent` (via `SyntheticEventGenerator`).
 * - All identifiers use branded types (`SessionId`, `EventId`, `Timestamp`).
 * - Raw prompt text is hashed via cyrb53 before inclusion in payloads.
 * - Never imports engines, storage, platforms, or sidepanel modules.
 * - Never calls engine methods directly (Constitution §2).
 * - Never writes to IndexedDB directly (Constitution §3, §8).
 */

import { EventBusContract } from '../../core/event-bus/types';
import {
  SessionEvents,
  PromptEvents,
  CognitiveEvents,
  HardwareEvents,
} from '../../core/event-bus/registry';
import { SessionId, toSessionId } from '../../core/types/session.types';
import { EventFactoryOptions } from '../../core/event-bus/createDomainEvent';
import { StateLabel } from '../../core/types/state.types';
import { GapType } from '../../core/types/gap.types';
import { SyntheticEventGenerator } from './SyntheticEventGenerator';
import { StreamSimulator, DelayFn } from './StreamSimulator';
import {
  MockHarnessConfig,
  TypingSimulationOptions,
  StreamSimulationOptions,
} from './types';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_PLATFORM = 'mock-harness';

// ---------------------------------------------------------------------------
// MockHarness
// ---------------------------------------------------------------------------

export class MockHarness {
  private readonly eventBus: EventBusContract;
  private readonly platform: string;
  private readonly taskId?: string;
  private readonly eventFactoryOptions: EventFactoryOptions;
  private readonly delayFn?: DelayFn;

  private generator: SyntheticEventGenerator | null = null;
  private streamSimulator: StreamSimulator | null = null;
  private currentSessionId: SessionId | null = null;

  constructor(
    eventBus: EventBusContract,
    config: MockHarnessConfig = {},
    delayFn?: DelayFn,
  ) {
    this.eventBus = eventBus;
    this.platform = config.platform ?? DEFAULT_PLATFORM;
    this.taskId = config.taskId;
    this.eventFactoryOptions = config.eventFactoryOptions ?? {};
    this.delayFn = delayFn;
  }

  // ── Session Lifecycle ──────────────────────────────────────────────────

  /**
   * Starts a new simulated session.
   *
   * Creates a new `SessionId`, initialises the event generator and stream
   * simulator, and publishes a `session.started` event.
   *
   * @returns The `SessionId` of the new session.
   * @throws If a session is already active (call `endSession` first).
   */
  startSession(): SessionId {
    if (this.currentSessionId !== null) {
      throw new Error(
        '[MockHarness] Cannot start a new session while one is active. Call endSession() first.',
      );
    }

    this.currentSessionId = toSessionId(crypto.randomUUID());
    this.generator = new SyntheticEventGenerator(
      this.currentSessionId,
      this.eventFactoryOptions,
    );
    this.streamSimulator = new StreamSimulator(
      this.eventBus,
      this.generator,
      this.delayFn,
    );

    const event = this.generator.sessionStarted(this.platform, this.taskId);
    this.eventBus.publish(SessionEvents.STARTED, event);

    return this.currentSessionId;
  }

  /**
   * Ends the current simulated session.
   *
   * Publishes a `session.ended` event and clears internal state.
   *
   * @param reason The reason for ending the session.
   * @throws If no session is currently active.
   */
  endSession(
    reason: 'tab_closed' | 'navigation' | 'timeout' | 'explicit' = 'explicit',
  ): void {
    const gen = this.requireGenerator();
    const event = gen.sessionEnded(reason);
    this.eventBus.publish(SessionEvents.ENDED, event);

    this.currentSessionId = null;
    this.generator = null;
    this.streamSimulator = null;
  }

  /**
   * Simulates pausing the current session.
   */
  pauseSession(
    reason: 'tab_hidden' | 'idle' | 'explicit' = 'idle',
  ): void {
    const gen = this.requireGenerator();
    const event = gen.sessionPaused(reason);
    this.eventBus.publish(SessionEvents.PAUSED, event);
  }

  /**
   * Simulates resuming the current session after a pause.
   */
  resumeSession(pauseDurationMs: number): void {
    const gen = this.requireGenerator();
    const event = gen.sessionResumed(pauseDurationMs);
    this.eventBus.publish(SessionEvents.RESUMED, event);
  }

  // ── Typing Simulation ─────────────────────────────────────────────────

  /**
   * Simulates the user typing a prompt.
   *
   * Publishes a `prompt.typed` event with the text length, word count,
   * prompt hash, and revision depth. The raw text is never included.
   */
  simulateTyping(text: string, options: TypingSimulationOptions = {}): void {
    const gen = this.requireGenerator();
    const event = gen.promptTyped(text, options.revisionDepth ?? 0);
    this.eventBus.publish(PromptEvents.TYPED, event);
  }

  /**
   * Simulates the user sending a prompt.
   */
  simulatePromptSent(text: string, wasEnriched = false): void {
    const gen = this.requireGenerator();
    const event = gen.promptSent(text, wasEnriched);
    this.eventBus.publish(PromptEvents.SENT, event);
  }

  /**
   * Simulates the user cancelling a prompt.
   */
  simulatePromptCancelled(text: string): void {
    const gen = this.requireGenerator();
    const event = gen.promptCancelled(text);
    this.eventBus.publish(PromptEvents.CANCELLED, event);
  }

  // ── Cognitive Event Simulation ─────────────────────────────────────────

  /**
   * Simulates a cognitive pause being detected.
   */
  simulatePause(durationMs: number, textLength: number): void {
    const gen = this.requireGenerator();
    const event = gen.pauseDetected(durationMs, textLength);
    this.eventBus.publish(CognitiveEvents.PAUSE_DETECTED, event);
  }

  /**
   * Simulates a cognitive state transition.
   */
  simulateStateChange(
    previousState: StateLabel,
    currentState: StateLabel,
    confidence: number,
  ): void {
    const gen = this.requireGenerator();
    const event = gen.stateChanged(previousState, currentState, confidence);
    this.eventBus.publish(CognitiveEvents.STATE_CHANGED, event);
  }

  /**
   * Simulates a cognitive gap being detected.
   */
  simulateGapDetected(gapType: GapType, confidence: number): void {
    const gen = this.requireGenerator();
    const event = gen.gapDetected(gapType, confidence);
    this.eventBus.publish(CognitiveEvents.GAP_DETECTED, event);
  }

  // ── Response Streaming Simulation ──────────────────────────────────────

  /**
   * Simulates a complete AI response stream.
   *
   * Publishes `response.started` → N × `response.chunk` → `response.completed`
   * with configurable chunk size and inter-chunk delay.
   *
   * @param promptText The prompt that triggered this response (hashed for promptHash).
   * @param responseText The full response text to stream.
   * @param options Chunk size and delay overrides.
   */
  async simulateResponse(
    promptText: string,
    responseText: string,
    options: StreamSimulationOptions = {},
  ): Promise<void> {
    const gen = this.requireGenerator();
    const sim = this.requireStreamSimulator();

    // Hash the prompt text (never store raw text)
    const promptHash = gen.promptSent(promptText).payload.promptHash;
    await sim.stream(promptHash, responseText, options);
  }

  // ── Hardware Simulation ────────────────────────────────────────────────

  /**
   * Simulates an Arc hardware device connecting.
   */
  simulateHardwareConnect(
    deviceId: string,
    deviceType: string,
    firmwareVersion: string,
  ): void {
    const gen = this.requireGenerator();
    const event = gen.hardwareConnected(deviceId, deviceType, firmwareVersion);
    this.eventBus.publish(HardwareEvents.CONNECTED, event);
  }

  /**
   * Simulates an Arc hardware device disconnecting.
   */
  simulateHardwareDisconnect(
    deviceId: string,
    reason: 'explicit' | 'timeout' | 'error' = 'explicit',
  ): void {
    const gen = this.requireGenerator();
    const event = gen.hardwareDisconnected(deviceId, reason);
    this.eventBus.publish(HardwareEvents.DISCONNECTED, event);
  }

  /**
   * Simulates receiving a raw biosignal from Arc hardware.
   *
   * Emits a `hardware.signal.received` event in the exact payload shape
   * that future Arc BLE hardware will produce, validating the hardware-ready
   * seam without physical devices.
   */
  simulateHardwareSignal(
    deviceId: string,
    signalType: string,
    value: number,
    confidence: number,
  ): void {
    const gen = this.requireGenerator();
    const event = gen.hardwareSignalReceived(deviceId, signalType, value, confidence);
    this.eventBus.publish(HardwareEvents.SIGNAL_RECEIVED, event);
  }

  // ── Accessors ──────────────────────────────────────────────────────────

  /** Returns the current active session ID, or null if no session is active. */
  getSessionId(): SessionId | null {
    return this.currentSessionId;
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private requireGenerator(): SyntheticEventGenerator {
    if (this.generator === null) {
      throw new Error(
        '[MockHarness] No active session. Call startSession() first.',
      );
    }
    return this.generator;
  }

  private requireStreamSimulator(): StreamSimulator {
    if (this.streamSimulator === null) {
      throw new Error(
        '[MockHarness] No active session. Call startSession() first.',
      );
    }
    return this.streamSimulator;
  }
}
