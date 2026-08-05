export interface PromptEnricher {
  enrich(rawText: string, sessionId: string): Promise<string>;
}
