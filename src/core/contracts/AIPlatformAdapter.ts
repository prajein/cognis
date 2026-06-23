export interface AIPlatformAdapter {
  detect(): boolean;
  getInputElement(): HTMLElement | null;
  getResponseContainer(): HTMLElement | null;
  getSendButton(): HTMLElement | null;
  injectPrompt(prompt: string): Promise<void>;
  observeResponse(callback: (chunk: string) => void): void;
}
