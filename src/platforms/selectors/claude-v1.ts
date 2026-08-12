import { PlatformConfig } from './interfaces';

/**
 * Claude v1 Selectors
 * 
 * Empirically established for claude.ai interface.
 */
export const claudeV1: PlatformConfig = {
  id: 'claude',
  version: 'v1',
  urlPattern: /^https:\/\/claude\.ai/,
  selectors: {
    responseContainer: 'body', 
    responseBlock: '.font-claude-response',
    streamingIndicator: '[data-is-streaming]',
    promptInput: '[contenteditable="true"].ProseMirror',
    submitButton: 'button[aria-label="Send Message"], button[aria-label="Send message"]'
  }
};
