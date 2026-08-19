import { PlatformConfig } from './interfaces';

/**
 * Gemini v1 Selectors
 *
 * UNVERIFIED — best-effort selectors based on Gemini's known Angular Material
 * component structure (as of the last publicly observed markup), NOT
 * empirically confirmed against the live DOM the way `claude-v1`/`chatgpt-v1`
 * were. No live browser access was available to inspect gemini.google.com
 * while building this adapter. Every selector below must be checked against
 * the current site before this platform is enabled for real users — treat
 * this as a structural placeholder that lets the composition-root wiring
 * (PlatformManager -> GeminiAdapter -> observers) be built and tested now,
 * with only the selector strings needing a follow-up pass.
 */
export const geminiV1: PlatformConfig = {
  id: 'gemini',
  version: 'v1',
  urlPattern: /^https:\/\/gemini\.google\.com/,
  selectors: {
    // UNVERIFIED — confirm against live gemini.google.com DOM before shipping.
    responseContainer: 'body',
    // UNVERIFIED — confirm against live gemini.google.com DOM before shipping.
    responseBlock: 'message-content .markdown, .model-response-text',
    // UNVERIFIED — confirm against live gemini.google.com DOM before shipping.
    streamingIndicator: '[data-is-streaming="true"], .loading-indicator',
    // UNVERIFIED — confirm against live gemini.google.com DOM before shipping.
    promptInput: 'rich-textarea .ql-editor[contenteditable="true"]',
    // UNVERIFIED — confirm against live gemini.google.com DOM before shipping.
    submitButton: 'button[aria-label="Send message"]',
    // UNVERIFIED — confirm against live gemini.google.com DOM before shipping.
    scrollContainer: 'window',
  },
};
