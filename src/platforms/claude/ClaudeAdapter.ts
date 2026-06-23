import { AIPlatformAdapter } from '../interfaces';

export class ClaudeAdapter implements AIPlatformAdapter {
  // TODO: Implement ClaudeAdapter without business logic
  
  detect(): boolean { throw new Error('Not implemented'); }
  getInputElement(): HTMLElement | null { throw new Error('Not implemented'); }
  getResponseContainer(): HTMLElement | null { throw new Error('Not implemented'); }
  getSendButton(): HTMLElement | null { throw new Error('Not implemented'); }
  injectPrompt(prompt: string): Promise<void> { throw new Error('Not implemented'); }
  observeResponse(callback: (chunk: string) => void): void { throw new Error('Not implemented'); }
}
