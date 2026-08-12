/// <reference types="chrome" />
import { ProfileRepository } from '../../storage/repositories/ProfileRepository';
import { GapType } from '../../core/types/gap.types';
import {
  QueryAdaptationStateRequest,
  QueryAdaptationStateResponse,
} from '../../core/ipc/messages';

/**
 * AdaptationQueryHandler
 *
 * Dedicated background-side handler for resolving longitudinal adaptation policy.
 * Translates persisted `UserProfileRecord` state into a runtime policy payload.
 *
 * Enforces the P2 rule: TRANSFERRED -> Binary Suppression.
 * Acts as a strict policy firewall (does not expose raw user counters to Content Scripts).
 */
export class AdaptationQueryHandler {
  constructor(private readonly profileRepo: ProfileRepository) {}

  public register(): () => void {
    const listener = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: QueryAdaptationStateResponse) => void
    ): boolean | undefined => {
      if (!this.isQueryAdaptationStateRequest(message)) {
        return undefined;
      }

      // Chrome extension async response pattern: Return true to keep channel open,
      // then call sendResponse when the promise resolves.
      this.handleQuery()
        .then(sendResponse)
        .catch((error) => {
          console.error('[AdaptationQueryHandler] Unexpected error:', error);
          // Fail open: Default to empty array on failure so targeting remains active.
          sendResponse({
            suppressedGaps: [],
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

  private async handleQuery(): Promise<QueryAdaptationStateResponse> {
    const profile = await this.profileRepo.get('default-user');

    if (!profile || !profile.gapHistory) {
      // Missing profile or legacy profile defaults safely to no suppression.
      return { suppressedGaps: [] };
    }

    const suppressedGaps: GapType[] = [];

    for (const [gapTypeStr, state] of Object.entries(profile.gapHistory)) {
      // P2 Implementation: Only gaps strictly marked TRANSFERRED are suppressed.
      if (state.transferState === 'TRANSFERRED') {
        suppressedGaps.push(gapTypeStr as GapType);
      }
    }

    return { suppressedGaps };
  }

  private isQueryAdaptationStateRequest(message: unknown): message is QueryAdaptationStateRequest {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as QueryAdaptationStateRequest).type === 'QUERY_ADAPTATION_STATE'
    );
  }
}
