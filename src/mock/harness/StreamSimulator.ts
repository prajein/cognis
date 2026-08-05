/**
 * StreamSimulator — Asynchronous AI response streaming simulator
 *
 * What & why: simulates a live AI platform streaming a response token by token.
 * Breaks the response text into chunks of configurable size and emits
 * `response.started` → N × `response.chunk` → `response.completed` events
 * onto the EventBus with configurable inter-chunk delay.
 *
 * Architectural constraints:
 * - Communicates exclusively through `EventBusContract.publish()`.
 * - Never imports engines, storage, platforms, or sidepanel modules.
 * - Accepts an injectable delay function so tests can run synchronously.
 */

import { EventBusContract } from '../../core/event-bus/types';
import { ResponseEvents } from '../../core/event-bus/registry';
import { SyntheticEventGenerator } from './SyntheticEventGenerator';
import { StreamSimulationOptions } from './types';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CHUNK_SIZE = 12;
const DEFAULT_CHUNK_DELAY_MS = 50;

// ---------------------------------------------------------------------------
// Delay abstraction
// ---------------------------------------------------------------------------

/**
 * Injectable delay function. The default uses `setTimeout` wrapped in a
 * `Promise`. Tests can substitute a zero-delay or synchronous implementation.
 */
export type DelayFn = (ms: number) => Promise<void>;

export const defaultDelay: DelayFn = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// StreamSimulator
// ---------------------------------------------------------------------------

export class StreamSimulator {
  private readonly delay: DelayFn;

  constructor(
    private readonly eventBus: EventBusContract,
    private readonly generator: SyntheticEventGenerator,
    delay?: DelayFn,
  ) {
    this.delay = delay ?? defaultDelay;
  }

  /**
   * Streams a simulated AI response onto the EventBus.
   *
   * Execution:
   * 1. Publishes `response.started` with the prompt hash.
   * 2. Splits `responseText` into fixed-size chunks.
   * 3. For each chunk, waits `chunkDelayMs`, then publishes `response.chunk`
   *    with the chunk text, chunk length, and running total length.
   * 4. After the final chunk, publishes `response.completed` with the full
   *    response length and total elapsed duration.
   *
   * The total duration reported in `response.completed` is computed from the
   * number of chunks × delay, not from wall-clock time, so the output is
   * deterministic regardless of timer precision.
   *
   * @param promptHash   Hash of the prompt that triggered this response.
   * @param responseText The full response text to stream.
   * @param options      Chunk size and inter-chunk delay overrides.
   */
  async stream(
    promptHash: string,
    responseText: string,
    options: StreamSimulationOptions = {},
  ): Promise<void> {
    const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const chunkDelayMs = options.chunkDelayMs ?? DEFAULT_CHUNK_DELAY_MS;

    // 1. response.started
    const startedEvent = this.generator.responseStarted(promptHash);
    this.eventBus.publish(ResponseEvents.STARTED, startedEvent);

    // 2. Split into chunks and stream
    let totalLength = 0;
    const chunks: string[] = [];
    for (let i = 0; i < responseText.length; i += chunkSize) {
      chunks.push(responseText.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      await this.delay(chunkDelayMs);
      totalLength += chunk.length;
      const chunkEvent = this.generator.responseChunk(chunk, totalLength);
      this.eventBus.publish(ResponseEvents.CHUNK, chunkEvent);
    }

    // 3. response.completed
    const durationMs = chunks.length * chunkDelayMs;
    const completedEvent = this.generator.responseCompleted(totalLength, durationMs);
    this.eventBus.publish(ResponseEvents.COMPLETED, completedEvent);
  }
}
