import { EventBusContract } from '../../core/event-bus/types';
import { PromptEvents, CognitiveEvents, SessionEvents } from '../../core/event-bus/registry';
import { DomainEvent, GapDetectedPayload } from '../../core/event-bus/contracts';
import { GapType } from '../../core/types/gap.types';
import rawConfig from '../../core/config/enrichment_layers.json';

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
}

const config = rawConfig as EnrichmentConfig;

export interface EnrichmentEngineOptions {
  readonly latencyTimeoutMs?: number;
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
  private currentStateLabel: 'focused' | 'fatigued' | 'distracted' | 'idle' | 'unknown' = 'unknown';
  private readonly activeGaps = new Set<GapType>();
  
  constructor(
    private readonly eventBus: EventBusContract,
    options?: EnrichmentEngineOptions
  ) {
    this.timeoutMs = options?.latencyTimeoutMs ?? config.settings.latencyTimeoutMs;
    this.loadLayers();
  }

  public start(): void {
    // Listen to State changes to dynamically adjust layer priorities or templates
    this.eventBus.subscribe('state.changed', (event) => {
      this.currentStateLabel = event.payload.currentState as any;
    });

    this.eventBus.subscribe(PromptEvents.TYPED, () => {
      this.activeGaps.clear();
    });

    this.eventBus.subscribe(CognitiveEvents.GAP_DETECTED, (event: DomainEvent<GapDetectedPayload>) => {
      this.activeGaps.add(event.payload.gapType);
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

  private loadLayers(): void {
    for (const [name, layerConfig] of Object.entries(config.layers)) {
      this.layers.push({
        name,
        priority: layerConfig.defaultPriority,
        template: layerConfig.template,
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
      stateLabel: this.currentStateLabel as any
    };

    const event: DomainEvent<typeof payload> = {
      id: crypto.randomUUID() as any,
      type: PromptEvents.ENRICHED,
      timestamp: Date.now() as any,
      sessionId: sessionId as any,
      source: 'EnrichmentEngine',
      payload
    };

    this.eventBus.publish(PromptEvents.ENRICHED, event as any);
  }
}
