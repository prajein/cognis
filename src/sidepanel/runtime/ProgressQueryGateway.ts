/// <reference types="chrome" />

import {
  ProgressSession,
  QueryProgressRequest,
  QueryProgressResponse,
} from '../../core/ipc/messages';

const QUERY_TIMEOUT_MS = 5_000;

/**
 * ProgressQueryGateway
 *
 * Sidepanel-side transport boundary for historical progress queries.
 *
 * Architectural invariant:
 * - This is the only sidepanel component responsible for sending
 *   QUERY_PROGRESS through Chrome IPC.
 * - It does not access IndexedDB directly.
 * - It does not calculate progress metrics.
 */
export class ProgressQueryGateway {
  /**
   * Retrieves completed historical sessions for a specific task.
   *
   * Rejects when the background cannot be reached within the configured
   * timeout. Structured background errors are also surfaced as failures
   * rather than silently returning an empty history.
   */
  public getProgress(
    taskId: string
  ): Promise<readonly ProgressSession[]> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(
            `[ProgressQueryGateway] getProgress() timed out after ${QUERY_TIMEOUT_MS}ms`
          )
        );
      }, QUERY_TIMEOUT_MS);

      const request: QueryProgressRequest = {
        type: 'QUERY_PROGRESS',
        taskId,
      };

      chrome.runtime.sendMessage(
        request,
        (response: QueryProgressResponse | undefined) => {
          clearTimeout(timeoutId);

          if (chrome.runtime.lastError) {
            reject(
              new Error(
                `[ProgressQueryGateway] Chrome IPC error: ${chrome.runtime.lastError.message}`
              )
            );
            return;
          }

          if (!response) {
            reject(
              new Error(
                '[ProgressQueryGateway] Background returned no response.'
              )
            );
            return;
          }

          if (response.error) {
            reject(
              new Error(
                `[ProgressQueryGateway] Background query failed: ${response.error}`
              )
            );
            return;
          }

          resolve(response.sessions);
        }
      );
    });
  }
}