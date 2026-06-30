import { PlatformAdapter } from '../interfaces/PlatformAdapter';
import { GapDetectionEngine } from '../../engines/gap/GapDetectionEngine';
import { ChatGPTAdapter } from '../chatgpt/ChatGPTAdapter';

/**
 * Platform Manager
 *
 * Responsible for detecting the current host environment (e.g., ChatGPT, Claude)
 * based on URL or DOM signatures, and instantiating the correct PlatformAdapter.
 * It manages the lifecycle of the active adapter.
 */
export class PlatformManager {
  private activeAdapter: PlatformAdapter | null = null;
  private readonly gapEngine: GapDetectionEngine;

  constructor(gapEngine: GapDetectionEngine) {
    this.gapEngine = gapEngine;
  }

  /**
   * Detects the platform based on the current window location and starts the adapter.
   */
  public detectAndStart(currentUrl: string = window.location.href): void {
    if (this.activeAdapter) {
      this.activeAdapter.stop();
    }

    this.activeAdapter = this.createAdapterForUrl(currentUrl);
    
    if (this.activeAdapter) {
      this.activeAdapter.start();
    } else {
      console.warn('[PlatformManager] No supported platform detected for URL:', currentUrl);
    }
  }

  /**
   * Stops the currently active adapter.
   */
  public stop(): void {
    if (this.activeAdapter) {
      this.activeAdapter.stop();
      this.activeAdapter = null;
    }
  }

  private createAdapterForUrl(url: string): PlatformAdapter | null {
    if (url.includes('chatgpt.com')) {
      return new ChatGPTAdapter(this.gapEngine);
    }
    // Future: claude.ai, gemini.google.com
    return null;
  }
}
