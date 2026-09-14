import { EventBusContract } from '../core/event-bus/types';
import { PromptEvents, CognitiveEvents, SessionEvents, EnrichmentEvents } from '../core/event-bus/registry';
import { DomainEvent, GapDetectedPayload, StateChangedPayload, OnboardingCompletedPayload } from '../core/event-bus/contracts';
import { GapType } from '../core/types/gap.types';
import { StateLabel } from '../core/types/state.types';
import { SessionId, toSessionId } from '../core/types/session.types';
import { PromptEnricher } from '../platforms/interfaces/PromptEnricher';
import { EnrichmentEngineContract, EnrichmentInput } from '../core/contracts';
import { IdentityReadModel } from '../storage/projections/builders/IdentityProjectionBuilder';
import { GapProfileReadModel } from '../storage/projections/builders/GapProfileProjectionBuilder';
import { createDomainEvent } from '../core/event-bus/createDomainEvent';
import rawLeverageGapConfig from '../core/config/leverage_gap_questions.json';

interface TrackedGap {
  readonly confidence: number;
  readonly atMs: number;
}

export class ContentScriptEnricher implements PromptEnricher {
  private currentStateLabel: StateLabel = 'unknown';
  private readonly activeGaps = new Map<GapType, TrackedGap>();
  private identityModel: IdentityReadModel | null = null;
  
  constructor(
    private readonly eventBus: EventBusContract,
    private readonly engine: EnrichmentEngineContract,
    private readonly timeoutMs: number,
    initialIdentity?: OnboardingCompletedPayload,
    initialGaps?: GapType[]
  ) {
    if (initialIdentity) {
      this.identityModel = {
        projectionId: 'identity-v1_local',
        sessionId: 'local',
        insights: [
          { type: 'goal', summary: initialIdentity.answer1, timestamp: Date.now() },
          { type: 'style', summary: initialIdentity.answer2, timestamp: Date.now() },
          { type: 'context', summary: initialIdentity.answer3, timestamp: Date.now() }
        ],
        lastUpdated: Date.now()
      };
    }
    
    if (initialGaps) {
      const now = Date.now();
      initialGaps.forEach(gap => this.activeGaps.set(gap, { confidence: 1, atMs: now }));
    }
  }

  public start(): void {
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
  }

  public async enrich(rawText: string, sessionId: string): Promise<string> {
    return new Promise((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('[ContentScriptEnricher] Latency budget exceeded, falling back to raw text.');
          resolve(rawText);
        }
      }, this.timeoutMs);

      try {
        // Construct GapProfileReadModel from activeGaps
        const gapProfile: GapProfileReadModel = {
          projectionId: `gap-profile-v1_${sessionId}`,
          sessionId,
          gaps: {} as Record<GapType, any>,
          lastUpdated: Date.now()
        };
        for (const [gapType, tracked] of this.activeGaps.entries()) {
          gapProfile.gaps[gapType] = {
            detectedCount: 1,
            displayedCount: 0,
            acceptedCount: 0,
            dismissedCount: 0,
            rejectionCount: 0,
            lastDetectedAt: tracked.atMs
          };
        }

        const input: EnrichmentInput = {
          identityProfile: this.identityModel,
          gapProfile,
          currentState: this.currentStateLabel,
          ghostTextCompletions: [],
          prompt: rawText
        };

        const output = this.engine.enrich(input);

        // Publish prompt.enriched event
        this.eventBus.publish(
          PromptEvents.ENRICHED,
          createDomainEvent(
            PromptEvents.ENRICHED,
            toSessionId(sessionId),
            'ContentScriptEnricher',
            {
              enrichmentVersion: output.enrichmentVersion,
              appliedLayers: output.appliedLayers,
              stateLabel: output.stateLabel as StateLabel
            }
          )
        );

        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(output.enrichedPrompt);
        }
      } catch (error) {
        console.error('[ContentScriptEnricher] Enrichment failed:', error);
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(rawText);
        }
      }
    });
  }

  private publishLeverageGap(sessionId: SessionId): void {
    let strongestType: GapType | null = null;
    let strongest: TrackedGap | null = null;

    for (const [gapType, tracked] of this.activeGaps) {
      if (strongest === null || tracked.confidence > strongest.confidence) {
        strongestType = gapType;
        strongest = tracked;
      }
    }

    if (strongestType === null || strongest === null) return;

    const template = (rawLeverageGapConfig as any).questions[strongestType];
    if (!template) return;

    this.eventBus.publish(
      EnrichmentEvents.LEVERAGE_GAP_IDENTIFIED,
      createDomainEvent(
        EnrichmentEvents.LEVERAGE_GAP_IDENTIFIED,
        sessionId,
        'ContentScriptEnricher',
        {
          gapType: strongestType,
          confidence: strongest.confidence,
          questionTemplateId: template.id,
        }
      )
    );
  }
}
