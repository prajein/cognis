export interface PlatformSelectors {
  /** Target container that holds all AI responses (used for MutationObserver) */
  responseContainer: string;
  /** Selectors identifying individual response blocks/bubbles */
  responseBlock: string;
  /** Selectors identifying the streaming generation indicator (e.g. "Stop generating" button) */
  streamingIndicator: string;
  /** The prompt input textarea */
  promptInput: string;
  /** The submit button for the prompt */
  submitButton: string;
}

export interface PlatformConfig {
  id: string;
  version: string;
  /** URL matching pattern to identify the platform */
  urlPattern: RegExp;
  selectors: PlatformSelectors;
}
