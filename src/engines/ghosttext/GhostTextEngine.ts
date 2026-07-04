/**
 * GhostTextEngine — Surface A gentle "stem" suggestions
 *
 * What & why: when the user pauses to think mid-prompt, Cognis offers a short
 * ghost-text stem (an opener the user can continue) that nudges them to address
 * the most recently detected gap. It owns no DOM and no storage; it consumes
 * `gap.detected` and `pause.detected` and publishes `ghosttext.generated`
 * (Module Boundaries: "Ghost Text Engine consumes gaps + pauses, produces
 * ghosttext events").
 *
 * The golden rule — "nothing happens while the user waits": a stem is generated
 * only DURING a thinking pause, synchronously, from a config lookup. There is no
 * spinner, no network, no blocking. Selection is O(1), trivially inside the
 * <200ms ghost-text budget (Constitution §2). Display + accept/dismiss are the
 * perception layer's job and arrive back as their own events.
 *
 * Arc-ready: no platform/DOM coupling; an injectable clock + id keep it
 * deterministic in tests and identical when hardware drives the same events.
 */

import {
  EventBusContract,
  Clock,
  EventIdFactory,
  createDomainEvent,
} from "../../core/event-bus";
import { GapType } from "../../core/types/gap.types";
import { SessionId, Timestamp } from "../../core/types/session.types";
import {
  GhostTextStemsConfig,
  getGhostTextStemsConfig,
} from "../../core/config/ghosttext-stems-loader";

/** Construction options; all optional, with runtime-standard defaults. */
export interface GhostTextEngineOptions {
  /** Stem config. Defaults to the runtime-loaded config; tests inject fixtures. */
  readonly config?: GhostTextStemsConfig;
  /** `source` stamped on emitted events. */
  readonly source?: string;
  /** Clock override (tests / hardware). */
  readonly clock?: Clock;
  /** Event-id override (tests / hardware). */
  readonly idFactory?: EventIdFactory;
}

/** The most recent gap the engine could offer a stem for. */
interface RecentGap {
  readonly gapType: GapType;
  readonly atTimestamp: Timestamp;
  readonly sessionId: SessionId;
}

const DEFAULT_SOURCE = "ghost-text-engine";

export class GhostTextEngine {
  private readonly eventBus: EventBusContract;
  private readonly config: GhostTextStemsConfig;
  private readonly source: string;
  private readonly clock: Clock | undefined;
  private readonly idFactory: EventIdFactory | undefined;

  /** The latest gap seen, used to choose a stem on the next pause. */
  private recentGap: RecentGap | null = null;
  /** Per-gap rotation cursor so repeated stems vary deterministically. */
  private readonly rotation = new Map<GapType, number>();

  private readonly unsubscribes: Array<() => void> = [];
  private started = false;

  constructor(eventBus: EventBusContract, options: GhostTextEngineOptions = {}) {
    this.eventBus = eventBus;
    this.config = options.config ?? getGhostTextStemsConfig();
    this.source = options.source ?? DEFAULT_SOURCE;
    this.clock = options.clock;
    this.idFactory = options.idFactory;
  }

  /**
   * Subscribes to the trigger events. Idempotent. Returns a dispose function.
   */
  public start(): () => void {
    if (this.started) {
      return () => this.dispose();
    }
    this.started = true;

    this.unsubscribes.push(
      this.eventBus.subscribe("gap.detected", (event) => {
        this.recentGap = {
          gapType: event.payload.gapType,
          atTimestamp: event.timestamp,
          sessionId: event.sessionId,
        };
      }),
    );

    this.unsubscribes.push(
      this.eventBus.subscribe("pause.detected", (event) => {
        this.onPause(event.payload.durationMs, event.timestamp, event.sessionId);
      }),
    );

    return () => this.dispose();
  }

  /**
   * Decides whether a pause should surface a stem, and if so publishes
   * `ghosttext.generated`. A stem is offered only when:
   *   - the pause is long enough to be a thinking pause, AND
   *   - a gap was detected recently (within the recency window), AND
   *   - that gap belongs to the same session as the pause.
   */
  private onPause(durationMs: number, pauseAt: Timestamp, sessionId: SessionId): void {
    const { settings } = this.config;
    if (durationMs < settings.pauseThresholdMs) {
      return;
    }

    const gap = this.recentGap;
    if (gap === null || gap.sessionId !== sessionId) {
      return;
    }
    if (pauseAt - gap.atTimestamp > settings.gapRecencyMs) {
      return;
    }

    const stem = this.selectStem(gap.gapType);
    if (stem === null) {
      return;
    }

    const event = createDomainEvent(
      "ghosttext.generated",
      sessionId,
      this.source,
      { gapType: gap.gapType, stem },
      { clock: this.clock, idFactory: this.idFactory },
    );
    this.eventBus.publish("ghosttext.generated", event);
  }

  /**
   * Picks the next stem for a gap type, rotating through the configured list so
   * repeated prompts get varied suggestions. Respects `maxStemLength`.
   */
  private selectStem(gapType: GapType): string | null {
    const stems = this.config.stems[gapType] ?? [];
    if (stems.length === 0) {
      return null;
    }

    const cursor = this.rotation.get(gapType) ?? 0;
    this.rotation.set(gapType, cursor + 1);

    const stem = stems[cursor % stems.length];
    if (stem === undefined || stem.length > this.config.settings.maxStemLength) {
      return null;
    }
    return stem;
  }

  /** Removes all subscriptions. Safe to call multiple times. */
  public dispose(): void {
    while (this.unsubscribes.length > 0) {
      const unsub = this.unsubscribes.pop();
      unsub?.();
    }
    this.started = false;
  }
}
