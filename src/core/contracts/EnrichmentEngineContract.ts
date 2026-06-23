export interface EnrichmentInput {
  identityProfile: any; // TODO: Define type
  gapProfile: any; // TODO: Define type
  currentState: any; // TODO: Define type
  ghostTextCompletions: any; // TODO: Define type
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
