import { EventBusContract } from '../../core/event-bus/types';
import { PromptEvents, EnrichmentEvents, CognitiveEvents, SessionEvents } from '../../core/event-bus/registry';
import { DomainEvent, GapDetectedPayload, StateChangedPayload } from '../../core/event-bus/contracts';
import { GapType } from '../../core/types/gap.types';
import { StateLabel } from '../../core/types/state.types';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { OnboardingCompletedPayload } from '../../core/event-bus/contracts';
import { SessionId, toSessionId } from '../../core/types/session.types';
import rawConfig from '../../core/config/enrichment_layers.json';
import rawLeverageGapConfig from '../../core/config/leverage_gap_questions.json';

interface EnrichmentConfig {
  settings: {
    latencyTimeoutMs: number;
    enableCaching: boolean;
  };
  layers: Record<string, {
    defaultPriority: number;
    template: string;
    targetGaps?: GapType[];
  }>;
  stateSuffixes?: Partial<Record<StateLabel, string>>;
}

const config = rawConfig as EnrichmentConfig;

interface LeverageGapQuestion {
  readonly id: string;
  readonly question: string;
}
interface LeverageGapQuestionsConfig {
  readonly questions: Partial<Record<GapType, LeverageGapQuestion>>;
}
const leverageGapConfig = rawLeverageGapConfig as LeverageGapQuestionsConfig;

/** A tracked gap signal: confidence plus recency, for leverage-gap ranking. */
interface TrackedGap {
  readonly confidence: number;
  readonly atMs: number;
}

export interface EnrichmentEngineOptions {
  readonly latencyTimeoutMs?: number;
  readonly identityProfile?: OnboardingCompletedPayload;
  readonly initialActiveGaps?: GapType[];
}

interface Layer {
  name: string;
  priority: number;
  template: string;
  targetGaps?: GapType[];
}

export class EnrichmentEngine {
  private readonly timeoutMs: number;
  private readonly layers: Layer[] = [];

  // In-memory state collected from EventBus
  private currentStateLabel: StateLabel = 'unknown';
  private readonly activeGaps = new Map<GapType, TrackedGap>();

  constructor(
    private readonly eventBus: EventBusContract,
    options?: EnrichmentEngineOptions
  ) {
    this.timeoutMs = options?.latencyTimeoutMs ?? config.settings.latencyTimeoutMs;

    if (options?.initialActiveGaps) {
      const hydratedAt = Date.now();
      options.initialActiveGaps.forEach(gap =>
        this.activeGaps.set(gap, { confidence: 0, atMs: hydratedAt })
      );
    }

    this.loadLayers(options?.identityProfile);
  }

  public start(): void {
    // Listen to State changes to dynamically adjust layer priorities or templates
    this.eventBus.subscribe('state.changed', (event: DomainEvent<StateChangedPayload>) => {
      this.currentStateLabel = event.payload.currentState;
    });

    this.eventBus.subscribe(PromptEvents.TYPED, () => {
      this.activeGaps.clear();
    });

    this.eventBus.subscribe(CognitiveEvents.GAP_DETECTED, (event: DomainEvent<GapDetectedPayload>) => {
      this.activeGaps.set(event.payload.gapType, {
        confidence: event.payload.confidence,
        atMs: Date.now(),
      });
      this.publishLeverageGap(event.sessionId);
    });

    this.eventBus.subscribe(SessionEvents.ENDED, () => {
      this.activeGaps.clear();
    });
    console.log('[EnrichmentEngine] Started.');
  }

  public stop(): void {
    // Cleanup subscriptions if necessary
    console.log('[EnrichmentEngine] Stopped.');
  }

  /**
   * The core in-memory entry point. Resolves within the latency budget
   * or falls back to raw text.
   */
  public async enrich(rawText: string, sessionId: string): Promise<string> {
    return new Promise((resolve) => {
      let resolved = false;

      // 1. Timeout Safety (Section 10 Latency Budgets)
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('[EnrichmentEngine] Latency budget exceeded, falling back to raw text.');
          resolve(rawText);
        }
      }, this.timeoutMs);

      try {
        // 2. Compile Templates
        // Filter layers based on activeGaps, then sort by priority descending
        const relevantLayers = this.layers.filter(layer =>
          !layer.targetGaps ||
          layer.targetGaps.some(gap => this.activeGaps.has(gap))
        );

        const sortedLayers = relevantLayers.sort((a, b) => b.priority - a.priority);

        let wrapperContext = '';
        for (const layer of sortedLayers) {
          wrapperContext += `\n${layer.template}\n`;
        }

        const stateSuffix = config.stateSuffixes?.[this.currentStateLabel];
        if (stateSuffix) {
          wrapperContext += `\n${stateSuffix}\n`;
        }

        // 3. Compose Final Enriched Prompt
        // "Context wrapping, not prompt rewriting"
        const enrichedText = `${wrapperContext}\n### User Prompt\n${rawText}`;

        // 4. Publish prompt.enriched event (No raw text)
        this.publishEnrichedEvent(sessionId, rawText, enrichedText, sortedLayers.map(l => l.name));

        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(enrichedText);
        }
      } catch (error) {
        console.error('[EnrichmentEngine] Enrichment failed:', error);
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(rawText);
        }
      }
    });
  }

  /**
   * Ranks currently-active gaps by confidence and publishes
   * `enrichment.leverageGap` for the single strongest one, as a pre-send
   * nudge signal. Local heuristic substitute for the deferred "silent
   * meta-call" LLM pass (Build Brief §5.5) — see
   * `EnrichmentLeverageGapIdentifiedPayload`. Carries only a gap type,
   * confidence, and static question-template id — never prompt text
   * (ADR-019). No-op if no gap has a matching question template or none are
   * currently active.
   */
  private publishLeverageGap(sessionId: SessionId): void {
    let strongestType: GapType | null = null;
    let strongest: TrackedGap | null = null;

    for (const [gapType, tracked] of this.activeGaps) {
      if (strongest === null || tracked.confidence > strongest.confidence) {
        strongestType = gapType;
        strongest = tracked;
      }
    }

    if (strongestType === null || strongest === null) {
      return;
    }

    const template = leverageGapConfig.questions[strongestType];
    if (!template) {
      return;
    }

    const event = createDomainEvent(
      EnrichmentEvents.LEVERAGE_GAP_IDENTIFIED,
      sessionId,
      'EnrichmentEngine',
      {
        gapType: strongestType,
        confidence: strongest.confidence,
        questionTemplateId: template.id,
      },
    );
    this.eventBus.publish(EnrichmentEvents.LEVERAGE_GAP_IDENTIFIED, event);
  }

  private loadLayers(identityProfile?: OnboardingCompletedPayload): void {
    for (const [name, layerConfig] of Object.entries(config.layers)) {
      let template = layerConfig.template;

      if (name === 'identity' && identityProfile) {
        template += `\n- Answer 1: ${identityProfile.answer1}`;
        template += `\n- Answer 2: ${identityProfile.answer2}`;
        template += `\n- Answer 3: ${identityProfile.answer3}`;
      }

      this.layers.push({
        name,
        priority: layerConfig.defaultPriority,
        template,
        targetGaps: layerConfig.targetGaps
      });
    }
  }

  private publishEnrichedEvent(
    sessionId: string,
    rawText: string,
    enrichedText: string,
    appliedLayers: string[]
  ): void {
    // Simple hash for simulation (In real implementation, use subtlecrypto or similar)
    const textHash = `hash_${rawText.length}`;

    const payload = {
      enrichmentVersion: '1.0.0',
      appliedLayers,
      stateLabel: this.currentStateLabel
    };

    const event = createDomainEvent(
      PromptEvents.ENRICHED,
      toSessionId(sessionId),
      'EnrichmentEngine',
      payload
    );

    this.eventBus.publish(PromptEvents.ENRICHED, event);
  }
}
