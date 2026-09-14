import { IdentityReadModel } from '../../storage/projections/builders/IdentityProjectionBuilder';
import { GapProfileReadModel } from '../../storage/projections/builders/GapProfileProjectionBuilder';
import { StateLabel } from '../types/state.types';

export interface EnrichmentInput {
  identityProfile: IdentityReadModel | null;
  gapProfile: GapProfileReadModel | null;
  currentState: StateLabel;
  ghostTextCompletions: string[];
  prompt: string;
}

export interface EnrichmentOutput {
  enrichedPrompt: string;
  enrichmentVersion: string;
  appliedLayers: string[];
  stateLabel: string;
}

export interface EnrichmentEngineContract {
  enrich(input: EnrichmentInput): EnrichmentOutput;
}
