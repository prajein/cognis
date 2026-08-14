import { EventBus } from '../../core/event-bus/EventBus';
import { PlatformConfig } from '../selectors/interfaces';
import { SessionId } from '../../core/types/session.types';
import { PromptEvents, SessionEvents, CognitiveEvents, ResponseEvents } from '../../core/event-bus/registry';
import { DomainEvent, ReadingEngagementMeasuredPayload, ResponseStartedPayload } from '../../core/event-bus/contracts';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';

type State = 'IDLE' | 'TRACKING';

export class ReadingObserver {
  private state: State = 'IDLE';
  private isDestroyed = false;
  private unsubscribes: Array<() => void> = [];

  // DOM & Scroll State
  private scrollTarget: EventTarget | null = null;
  private scrollHandler: EventListener | null = null;
  private rafId: number | null = null;
  private pendingScrollPos: number | null = null;

  // Correlation
  private activePromptEventId: string | null = null;
  private activePromptHash: string | null = null;

  // Tracking Metrics
  private responseStartedTime: number = 0;
  private lastScrollTime: number = 0;
  private lastScrollPos: number = -1;

  private totalScrollDistancePx: number = 0;
  private totalScrollSampleTimeMs: number = 0;

  private currentDirection: number = 0; // 1 for down, -1 for up, 0 for init
  private lastDirectionChangePos: number = -1;
  private reversals: number = 0;
  private readonly JITTER_THRESHOLD_PX = 50;

  constructor(
    private readonly eventBus: EventBus,
    private readonly config: PlatformConfig,
    private readonly sessionId: SessionId
  ) {}

  public connect(): boolean {
    if (this.isDestroyed) return false;

    this.unsubscribes.push(
      this.eventBus.subscribe(ResponseEvents.STARTED, (event: DomainEvent<ResponseStartedPayload>) => {
        this.handleResponseStarted(event);
      })
    );

    this.unsubscribes.push(
      this.eventBus.subscribe(PromptEvents.TYPED, () => {
        this.finalizeTracking('typed');
      })
    );

    this.unsubscribes.push(
      this.eventBus.subscribe(PromptEvents.SENT, () => {
        this.finalizeTracking('sent');
      })
    );

    this.unsubscribes.push(
      this.eventBus.subscribe(SessionEvents.ENDED, () => {
        this.finalizeTracking('session_ended');
      })
    );

    this.unsubscribes.push(
      this.eventBus.subscribe(SessionEvents.STARTED, () => {
        this.resetState();
      })
    );

    console.log(`[ReadingObserver] Connected to session ${this.sessionId}`);
    return true;
  }

  public disconnect(): void {
    this.unbindScroll();
    this.cancelRaf();
    this.pendingScrollPos = null;

    while (this.unsubscribes.length > 0) {
      this.unsubscribes.pop()?.();
    }
  }

  public destroy(): void {
    this.disconnect();
    this.resetState();
    this.isDestroyed = true;
  }

  private handleResponseStarted(event: DomainEvent<ResponseStartedPayload>): void {
    if (this.state === 'TRACKING') {
      // If a new response starts while we are tracking one, finalize the old one.
      this.finalizeTracking('interrupted');
    }

    const payload = event.payload;
    if (!payload.promptEventId) {
      console.warn('[ReadingObserver] response.started missing promptEventId. Cannot track.');
      return;
    }

    this.resetState();
    this.state = 'TRACKING';
    this.activePromptEventId = payload.promptEventId;
    this.activePromptHash = payload.promptHash;
    this.responseStartedTime = Date.now();

    this.bindScroll();
  }

  private bindScroll(): void {
    this.unbindScroll();

    if (!this.config.selectors.scrollContainer) {
      console.warn('[ReadingObserver] No scrollContainer configured. Tracking will record 0 velocity/reversals.');
      return;
    }

    this.scrollHandler = this.onScrollEvent.bind(this);
    window.addEventListener('scroll', this.scrollHandler, { capture: true, passive: true });

    this.lastScrollPos = -1;
  }

  private unbindScroll(): void {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler, { capture: true } as EventListenerOptions);
    }
    this.scrollHandler = null;
  }

  private onScrollEvent(event: Event): void {
    const target = event.target;
    let isMatch = false;

    if (this.config.selectors.scrollContainer === 'window') {
      isMatch = (target === window || target === document);
    } else if (this.config.selectors.scrollContainer) {
      if (target instanceof Element && target.matches(this.config.selectors.scrollContainer)) {
        isMatch = true;
      }
    }

    if (!isMatch) return;

    let currentPos = 0;
    if (target === window || target === document) {
      currentPos = window.scrollY;
    } else {
      currentPos = (target as HTMLElement).scrollTop;
    }

    // Capture the latest position for the pending RAF.
    // Week 6 uses frame-sampled displacement. Intermediate scroll events
    // within the same RAF window are coalesced; displacement is measured
    // only between successive RAF samples.
    this.pendingScrollPos = currentPos;

    if (this.rafId !== null) return;

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      if (this.state !== 'TRACKING' || this.pendingScrollPos === null) return;

      const pos = this.pendingScrollPos;
      this.pendingScrollPos = null;
      const now = Date.now();

      if (this.lastScrollPos === -1) {
        this.lastScrollPos = pos;
        this.lastScrollTime = now;
        this.lastDirectionChangePos = pos;
        return;
      }

      const deltaPos = Math.abs(pos - this.lastScrollPos);
      const deltaTime = now - this.lastScrollTime;

      // Ignore zero-movement frames for velocity, but process for reversals if position jumped
      if (deltaPos > 0) {
        // Use repository-approved metric definition: accumulate distance and time, ignoring zero-delta
        if (deltaTime > 0) {
          this.totalScrollDistancePx += deltaPos;
          this.totalScrollSampleTimeMs += deltaTime;
        }

        const dir = Math.sign(pos - this.lastScrollPos);

        if (this.currentDirection === 0) {
          this.currentDirection = dir;
          this.lastDirectionChangePos = pos;
        } else if (dir !== this.currentDirection) {
          const distanceInNewDir = Math.abs(pos - this.lastDirectionChangePos);
          if (distanceInNewDir >= this.JITTER_THRESHOLD_PX) {
            this.reversals++;
            this.currentDirection = dir;
            this.lastDirectionChangePos = pos;
          }
        } else {
          // Moving in same direction, only update the baseline if we push the extremum further
          if (this.currentDirection === 1 && pos > this.lastDirectionChangePos) {
            this.lastDirectionChangePos = pos;
          } else if (this.currentDirection === -1 && pos < this.lastDirectionChangePos) {
            this.lastDirectionChangePos = pos;
          }
        }
      }

      this.lastScrollPos = pos;
      this.lastScrollTime = now;
    });
  }

  private cancelRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private resetState(): void {
    this.state = 'IDLE';
    this.unbindScroll();
    this.cancelRaf();

    this.activePromptEventId = null;
    this.activePromptHash = null;
    this.responseStartedTime = 0;
    this.lastScrollTime = 0;
    this.lastScrollPos = -1;
    this.totalScrollDistancePx = 0;
    this.totalScrollSampleTimeMs = 0;
    this.currentDirection = 0;
    this.lastDirectionChangePos = -1;
    this.reversals = 0;
  }

  private finalizeTracking(actionType: 'typed' | 'sent' | 'session_ended' | 'interrupted'): void {
    if (this.state !== 'TRACKING' || !this.activePromptEventId) {
      return;
    }

    const readingDurationMs = Date.now() - this.responseStartedTime;
    let scrollVelocityPxPerSec = 0;

    if (this.totalScrollSampleTimeMs > 0) {
      scrollVelocityPxPerSec = Math.round(this.totalScrollDistancePx / (this.totalScrollSampleTimeMs / 1000));
    }

    const payload: ReadingEngagementMeasuredPayload = {
      promptEventId: this.activePromptEventId,
      promptHash: this.activePromptHash ?? 'unknown',
      readingDurationMs,
      scrollVelocityPxPerSec,
      scrollReversals: this.reversals,
      actionType
    };

    this.eventBus.publish(CognitiveEvents.READING_ENGAGEMENT_MEASURED, createDomainEvent(
      CognitiveEvents.READING_ENGAGEMENT_MEASURED,
      this.sessionId,
      'reading-observer',
      payload
    ));

    // Exactly once finalization - transition immediately to IDLE and clear state
    this.resetState();
  }
}
