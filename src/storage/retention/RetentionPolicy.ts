import { CognisDatabase } from '../indexeddb/CognisDatabase';
import { RetentionRepository } from '../repositories/RetentionRepository';
import { EventBusContract, ErrorReporter } from '../../core/event-bus/types';
import { StorageEvents } from '../../core/event-bus/registry';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { toSessionId } from '../../core/types/session.types';

/**
 * RetentionPolicy
 *
 * Orchestrates the time-based retention requirements.
 * Ensures data older than 90 days is deleted safely in restartable batches.
 */
export class RetentionPolicy {
  private readonly retentionDays = 90;
  private readonly batchSize = 500;

  // Stores subject to time-based historical retention
  private readonly retentionStores = ['events', 'signal_frame', 'state_score'];

  private isExecuting = false;

  constructor(
    private readonly retentionRepo: RetentionRepository,
    private readonly eventBus: EventBusContract,
    private readonly errorReporter: ErrorReporter
  ) {}

  /**
   * Executes a bounded, restartable retention pass.
   * Calculates the 90-day cutoff and systematically deletes older records
   * until the stores are clean or a batch limit stops it for this tick.
   *
   * @param db Database instance
   */
  public async execute(db: CognisDatabase): Promise<void> {
    if (this.isExecuting) {
      console.warn('[RetentionPolicy] Execution already in progress, skipping.');
      return;
    }

    this.isExecuting = true;
    const startTime = Date.now();
    const cutoff = startTime - (this.retentionDays * 24 * 60 * 60 * 1000);

    try {
      console.log(`[RetentionPolicy] Starting retention pass. Cutoff: ${new Date(cutoff).toISOString()}`);

      // Step 1: Isolate undefined weekly/monthly summary semantics
      const summariesGenerated = await this.summarizeBeforeDeletion();

      if (!summariesGenerated) {
        console.warn('[RetentionPolicy] Historical compaction is BLOCKED. Weekly/monthly summary schemas are undefined. Refusing to destructively delete raw history.');
        return;
      }

      // Step 2: Perform bounded batch deletion
      let hasMoreData = true;
      let totalDeletedThisRun = 0;
      const cumulativeStoreCounts: Record<string, number> = {};

      for (const store of this.retentionStores) {
        cumulativeStoreCounts[store] = 0;
      }

      while (hasMoreData) {
        const { storeCounts, totalDeleted } = await this.retentionRepo.deleteOlderThan(
          this.retentionStores,
          cutoff,
          this.batchSize
        );

        for (const store of this.retentionStores) {
          cumulativeStoreCounts[store] += storeCounts[store];
        }
        totalDeletedThisRun += totalDeleted;

        if (totalDeleted < this.batchSize) {
          hasMoreData = false;
        } else {
          console.log(`[RetentionPolicy] Deleted batch of ${totalDeleted} records. Fetching more...`);
        }
      }

      const durationMs = Date.now() - startTime;

      if (totalDeletedThisRun > 0) {
        console.log(`[RetentionPolicy] Pass completed. Deleted ${totalDeletedThisRun} records in ${durationMs}ms.`);

        // Emit audit metadata
        const auditEvent = createDomainEvent(
          StorageEvents.RETENTION_COMPLETED,
          toSessionId('SYSTEM'), // System-level event
          'storage-retention',
          {
            cutoffTimestamp: cutoff,
            totalDeleted: totalDeletedThisRun,
            storeCounts: cumulativeStoreCounts,
            durationMs
          }
        );
        this.eventBus.publish(StorageEvents.RETENTION_COMPLETED, auditEvent);
      } else {
        console.log('[RetentionPolicy] Pass completed. No records older than cutoff found.');
      }

    } catch (error) {
      this.errorReporter.report(error instanceof Error ? error : new Error(String(error)), {
        source: 'RetentionPolicy',
        eventType: 'retention.failed'
      });
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Explicit architectural boundary for the undefined Week 7 summary schema.
   *
   * The Week 7 requirement mandates that 90-day logs are retained, followed by
   * weekly and monthly summaries. However, the exact schema and projection builders
   * for these summaries do not currently exist in the repository.
   *
   * We do NOT invent a summary schema here, nor do we silently destroy historical
   * information that should have been summarized.
   *
   * Currently, this is a placeholder acknowledging the gap. Once the summary builders
   * are defined, they must extract and persist their aggregate state BEFORE
   * `deleteOlderThan` removes the source events.
   *
   * @returns boolean true if summaries were safely generated and deletion can proceed, false otherwise.
   */
  private async summarizeBeforeDeletion(): Promise<boolean> {
    // Intentionally blocked:
    // Historical compaction requires weekly/monthly summaries, which are undefined.
    // Returning false permanently blocks destructive compaction.
    return Promise.resolve(false);
  }
}
