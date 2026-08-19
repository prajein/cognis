import { InsightStrategy, ReasoningContext } from '../interfaces';
import { TaxonomyDomain, InsightCandidate } from '../../../core/types/insight.types';
import { ConfidenceCalculator } from '../ConfidenceCalculator';

/** Minimum session length before a pause ratio is meaningful, not noise. */
const MIN_SESSION_DURATION_MS = 5 * 60 * 1000;
/** Paused this fraction of the session or more reads as heavy deliberation/overload. */
const HIGH_PAUSE_RATIO = 0.4;
/** Paused this fraction of the session or less reads as sustained flow. */
const LOW_PAUSE_RATIO = 0.05;

/**
 * CognitiveStateProxyStrategy
 *
 * What & why: this is a deliberately descoped stand-in for a real
 * per-cognitive-state time distribution ("how much of this session was spent
 * in Deep Focus vs. Hesitation vs. Struggling vs. Flow"). Building that
 * properly needs a new `state.changed` projection builder tracking
 * time-in-state, which doesn't exist yet (see punch list). What *does*
 * already exist on `SessionReadModel` is `totalPauseDurationMs` — the total
 * time the user spent paused (not typing) during the session. The fraction
 * of the session spent paused is a coarse, honest proxy for the same
 * underlying question (heavy deliberation/overload vs. uninterrupted flow),
 * not a replacement for the real thing.
 *
 * Session-scoped only (ReasoningContext carries one session's read models,
 * no cross-session data), and requires `MIN_SESSION_DURATION_MS` of session
 * time before treating the ratio as meaningful.
 */
export class CognitiveStateProxyStrategy implements InsightStrategy {
  public readonly version = 'v1.0.0';
  public readonly strategyName = 'CognitiveStateProxyStrategy';
  public readonly taxonomyDomains: ReadonlyArray<TaxonomyDomain> = ['Behavioral'];

  private readonly calculator = new ConfidenceCalculator();

  public execute(context: ReasoningContext): InsightCandidate[] {
    const { sessionMetrics, now, sessionId } = context;
    const sessionEnd = sessionMetrics.endTime ?? now;
    const sessionDurationMs = sessionEnd - sessionMetrics.startTime;

    if (sessionDurationMs < MIN_SESSION_DURATION_MS) {
      return []; // too little session time for the ratio to mean anything
    }

    const pauseRatio = sessionMetrics.totalPauseDurationMs / sessionDurationMs;
    const evidence = [sessionEnd];
    const minutesObserved = Math.round(sessionDurationMs / 60000);

    if (pauseRatio >= HIGH_PAUSE_RATIO) {
      const confidence = this.calculator.calculate(evidence, 1, Math.min(pauseRatio, 1), false, 0, now);
      return [
        {
          id: `cognitive-state-proxy_${sessionId}_high-pause`,
          domain: 'Behavioral',
          title: 'Heavy deliberation this session',
          summary:
            `${Math.round(pauseRatio * 100)}% of this session was spent paused rather than typing — ` +
            `a proxy for sustained deliberation or overload, not a direct state measurement.`,
          confidence,
          evidenceCount: minutesObserved,
          metadata: { pauseRatio, sessionDurationMs, proxy: 'totalPauseDurationMs/sessionDuration' },
        },
      ];
    }

    if (pauseRatio <= LOW_PAUSE_RATIO) {
      const confidence = this.calculator.calculate(evidence, 1, 1 - pauseRatio, false, 0, now);
      return [
        {
          id: `cognitive-state-proxy_${sessionId}_low-pause`,
          domain: 'Behavioral',
          title: 'Sustained flow this session',
          summary:
            `Only ${Math.round(pauseRatio * 100)}% of this session was spent paused — ` +
            `a proxy for uninterrupted flow, not a direct state measurement.`,
          confidence,
          evidenceCount: minutesObserved,
          metadata: { pauseRatio, sessionDurationMs, proxy: 'totalPauseDurationMs/sessionDuration' },
        },
      ];
    }

    return [];
  }
}
