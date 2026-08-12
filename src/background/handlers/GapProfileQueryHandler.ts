/// <reference types="chrome" />
import { ReadModelRepository } from '../../storage/repositories/ReadModelRepository';
import { GapProfileReadModel } from '../../storage/projections/builders/GapProfileProjectionBuilder';
import {
  QuerySessionGapsRequest,
  QuerySessionGapsResponse,
} from '../../core/ipc/messages';

/**
 * GapProfileQueryHandler
 *
 * Dedicated background-side handler for GapProfile read-model queries.
 * Registered against chrome.runtime.onMessage by the background composition root.
 */
export class GapProfileQueryHandler {
  /** Prefix used by GapProfileProjectionBuilder for all gap-profile projection IDs. */
  private static readonly GAP_PROFILE_PREFIX = 'gap-profile-v1_';

  constructor(private readonly readModelRepo: ReadModelRepository) {}

  public register(): () => void {
    const listener = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: QuerySessionGapsResponse) => void
    ): boolean | undefined => {
      if (!this.isQuerySessionGapsRequest(message)) {
        return undefined;
      }

      this.handleQuerySessionGaps(message.sessionId)
        .then(sendResponse)
        .catch((error) => {
          console.error('[GapProfileQueryHandler] Unexpected error:', error);
          sendResponse({
            gapProfile: null,
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

  private async handleQuerySessionGaps(sessionId: string): Promise<QuerySessionGapsResponse> {
    const projectionId = `${GapProfileQueryHandler.GAP_PROFILE_PREFIX}${sessionId}`;
    const gapProfile = await this.readModelRepo.get<GapProfileReadModel>(projectionId);
    return { gapProfile: gapProfile ?? null };
  }

  private isQuerySessionGapsRequest(
    message: unknown
  ): message is QuerySessionGapsRequest {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as QuerySessionGapsRequest).type === 'QUERY_SESSION_GAPS'
    );
  }
}
