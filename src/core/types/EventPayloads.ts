export interface PromptTypedPayload {
  textLength: number;
  wordCount: number;
  currentTextHash: string;
  revisionDepth: number;
}

export interface PauseDetectedPayload {
  durationMs: number;
  textLength: number;
}

export interface StateChangedPayload {
  previousState: string;
  currentState: string;
  confidence: number;
}

export interface GapDetectedPayload {
  gapType: string;
  confidence: number;
}

export interface GhostTextGeneratedPayload {
  gapType: string;
  stem: string;
}

export interface PromptEnrichedPayload {
  enrichmentVersion: string;
  appliedLayers: string[];
  stateLabel: string;
}
