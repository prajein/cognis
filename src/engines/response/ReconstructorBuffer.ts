import { AnalysisPipeline } from './pipeline/AnalysisPipeline';

export class ReconstructorBuffer {
  // Max 500KB per session (~100,000 words)
  private static readonly MAX_BUFFER_SIZE_BYTES = 500 * 1024;
  private static readonly WATCHDOG_TIMEOUT_MS = 60 * 1000;

  private buffer = '';
  private byteCount = 0;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private isAbandoned = false;

  constructor(
    public readonly sessionId: string,
    public readonly promptHash: string,
    private readonly pipeline: AnalysisPipeline,
    private readonly onComplete: (sessionId: string) => void
  ) {
    this.resetWatchdog();
  }

  public append(chunkText: string): void {
    if (this.isAbandoned) return;

    // A rough estimate of bytes (assuming UTF-8, usually 1 byte per char for standard text, 
    // but can be up to 4. We'll use string length as a fast heuristic).
    this.byteCount += chunkText.length;

    if (this.byteCount > ReconstructorBuffer.MAX_BUFFER_SIZE_BYTES) {
      this.abandon('oversize_abandoned');
      return;
    }

    this.buffer += chunkText;
    this.resetWatchdog();
  }

  public seal(): void {
    if (this.isAbandoned) return;
    this.clearWatchdog();
    
    // Execute the analysis pipeline with the fully reconstructed text
    this.pipeline.execute(this.sessionId, this.promptHash, this.buffer);
    
    this.destroy(); // Explicit garbage collection
    this.onComplete(this.sessionId);
  }

  public abandon(reason: string): void {
    if (this.isAbandoned) return;
    this.isAbandoned = true;
    console.warn(`[ResponseIntelligence] Buffer for session ${this.sessionId} abandoned: ${reason}`);
    this.destroy();
    this.onComplete(this.sessionId);
  }

  /**
   * Explicitly dereferences the buffer text to guarantee immediate garbage collection
   * in compliance with ADR-019 Transient Transport Data Policy.
   */
  public destroy(): void {
    this.clearWatchdog();
    // Force dereference
    this.buffer = '';
    this.byteCount = 0;
    this.isAbandoned = true;
  }

  private resetWatchdog(): void {
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      this.abandon('timeout_abandoned');
    }, ReconstructorBuffer.WATCHDOG_TIMEOUT_MS);
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }
}
