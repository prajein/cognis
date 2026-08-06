/// <reference types="chrome" />
import { ReadModelRepository } from '../../storage/repositories/ReadModelRepository';
import { InsightReadModel } from '../../storage/projections/builders/InsightProjectionBuilder';
import {
  QuerySessionInsightsRequest,
  QuerySessionInsightsResponse,
} from '../../core/ipc/messages';

/**
 * InsightQueryHandler
 *
 * Dedicated background-side handler for insight read-model queries.
 * Registered against chrome.runtime.onMessage by the background composition root.
 *
 * Architectural invariant:
 * - This is the symmetric counterpart to InsightGateway in the sidepanel.
 *   Gateway (sidepanel) ↔ Handler (background).
 * - The handler does NOT modify state. It is a pure read path.
 */
export class InsightQueryHandler {
  private static readonly INSIGHT_PREFIX = 'insight-v1_';

  constructor(private readonly readModelRepo: ReadModelRepository) {}

  public register(): () => void {
    const listener = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: QuerySessionInsightsResponse) => void
    ): boolean | undefined => {
      if (!this.isQuerySessionInsightsRequest(message)) {
        return undefined;
      }

      this.handleQuerySessionInsights(message)
        .then(sendResponse)
        .catch((error) => {
          console.error('[InsightQueryHandler] Unexpected error:', error);
          sendResponse({
            insights: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });

      return true;
    };

    chrome.runtime.onMessage.addListener(listener);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }

  private async handleQuerySessionInsights(request: QuerySessionInsightsRequest): Promise<QuerySessionInsightsResponse> {
    const id = `${InsightQueryHandler.INSIGHT_PREFIX}${request.sessionId}`;
    const insights = await this.readModelRepo.get<InsightReadModel>(id);

    return { insights: insights ?? null };
  }

  private isQuerySessionInsightsRequest(
    message: unknown
  ): message is QuerySessionInsightsRequest {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as QuerySessionInsightsRequest).type === 'QUERY_SESSION_INSIGHTS'
    );
  }
}
