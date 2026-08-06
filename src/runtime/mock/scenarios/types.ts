export interface StartSessionStep {
  type: 'startSession';
  taskId: string;
}

export interface TypeStep {
  type: 'type';
  text: string;
  delayMs?: number;
}

export interface PauseStep {
  type: 'pause';
  durationMs: number;
}

export interface SubmitStep {
  type: 'submit';
}

export interface StreamResponseStep {
  type: 'streamResponse';
  text: string;
  chunkSizeChars?: number;
  chunkDelayMs?: number;
}

export interface WaitStep {
  type: 'wait';
  durationMs: number;
}

export interface InsightStep {
  type: 'insight';
  domain: import('../../../core/types/insight.types').TaxonomyDomain;
  title: string;
  summary: string;
}

export interface EndSessionStep {
  type: 'endSession';
}

export type ScenarioStep = 
  | StartSessionStep 
  | TypeStep 
  | PauseStep 
  | SubmitStep 
  | StreamResponseStep 
  | WaitStep 
  | InsightStep
  | EndSessionStep;
