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

import { EnrichmentEngineContract, EnrichmentInput, EnrichmentOutput } from '../../core/contracts';

interface EnrichmentConfig {
  layers: Record<string, {
    defaultPriority: number;
    template: string;
    targetGaps?: GapType[];
  }>;
  stateSuffixes?: Partial<Record<string, string>>;
}

const config = rawConfig as EnrichmentConfig;

interface Layer {
  name: string;
  priority: number;
  template: string;
  targetGaps?: GapType[];
}

export class EnrichmentEngine implements EnrichmentEngineContract {
  private readonly layers: Layer[] = [];

  constructor() {
    this.loadLayers();
  }

  public enrich(input: EnrichmentInput): EnrichmentOutput {
    const activeGaps = input.gapProfile ? (Object.keys(input.gapProfile.gaps) as GapType[]) : [];

    // Filter layers based on activeGaps, then sort by priority descending
    const relevantLayers = this.layers.filter(layer =>
      !layer.targetGaps ||
      layer.targetGaps.some(gap => activeGaps.includes(gap))
    );

    const sortedLayers = relevantLayers.sort((a, b) => b.priority - a.priority);

    let wrapperContext = '';
    for (const layer of sortedLayers) {
      // Dynamic injection of identity profile into the identity layer
      let template = layer.template;
      if (layer.name === 'identity' && input.identityProfile) {
        input.identityProfile.insights.forEach(insight => {
          template += `\n- ${insight.type}: ${insight.summary}`;
        });
      }
      wrapperContext += `\n${template}\n`;
    }

    const stateSuffix = config.stateSuffixes?.[input.currentState];
    if (stateSuffix) {
      wrapperContext += `\n${stateSuffix}\n`;
    }

    // Compose Final Enriched Prompt
    const enrichedPrompt = `${wrapperContext}\n### User Prompt\n${input.prompt}`;

    return {
      enrichedPrompt,
      enrichmentVersion: '1.0.0',
      appliedLayers: sortedLayers.map(l => l.name),
      stateLabel: input.currentState
    };
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
}
