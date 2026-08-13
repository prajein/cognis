import { PlatformConfig } from './interfaces';

export const chatgptV1: PlatformConfig = {
  id: 'chatgpt',
  version: 'v1',
  urlPattern: /^https:\/\/chatgpt\.com/,
  selectors: {
    // Current ChatGPT main chat view container
    responseContainer: 'main',

    // Each assistant message has specific data-testid attributes
    responseBlock: '[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',

    // Stop generating button is usually active when streaming. We add fallbacks just in case.
    streamingIndicator: 'button[aria-label="Stop generating"], button[data-testid="stop-button"], [data-message-author-role="assistant"].result-streaming',

    // Prompt textarea ID
    promptInput: '#prompt-textarea',

    // Submit button data-testid
    submitButton: '[data-testid="send-button"]',

    // Window scroll for reading engagement
    scrollContainer: 'window'
  }
};
