/// <reference types="chrome" />
import { InsightReadModel } from '../../storage/projections/builders/InsightProjectionBuilder';
import {
  QuerySessionInsightsRequest,
  QuerySessionInsightsResponse,
} from '../../core/ipc/messages';

const QUERY_TIMEOUT_MS = 5_000;

/**
 * InsightGateway
 *
 * Concrete implementation for querying insights from the background.
 * Caches the most recently requested InsightReadModel for the active session 
 * to avoid redundant IPC traffic across React re-renders.
 */
export class InsightGateway {
  private cache: Map<string, { model: InsightReadModel; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 2000; // 2 seconds cache ttl to debounce rapid re-renders

  public getSessionInsights(sessionId: string): Promise<InsightReadModel | null> {
    const cached = this.cache.get(sessionId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return Promise.resolve(cached.model);
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`[InsightGateway] getSessionInsights() timed out after ${QUERY_TIMEOUT_MS}ms`));
      }, QUERY_TIMEOUT_MS);

      const request: QuerySessionInsightsRequest = { 
        type: 'QUERY_SESSION_INSIGHTS',
        sessionId 
      };

      chrome.runtime.sendMessage(request, (response: QuerySessionInsightsResponse | undefined) => {
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError) {
          reject(new Error(`[InsightGateway] Chrome IPC error: ${chrome.runtime.lastError.message}`));
          return;
        }

        if (!response) {
          resolve(null);
          return;
        }

        if (response.error) {
          console.warn('[InsightGateway] Background returned error:', response.error);
          resolve(null);
          return;
        }

        if (response.insights) {
          this.cache.set(sessionId, { model: response.insights, timestamp: Date.now() });
        }
        resolve(response.insights);
      });
    });
  }
}
