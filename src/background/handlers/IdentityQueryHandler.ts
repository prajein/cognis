/// <reference types="chrome" />
import { ProfileRepository } from '../../storage/repositories/ProfileRepository';
import {
  QueryIdentityProfileRequest,
  QueryIdentityProfileResponse,
} from '../../core/ipc/messages';

/**
 * IdentityQueryHandler
 *
 * Dedicated background-side handler for identity read-model queries.
 */
export class IdentityQueryHandler {
  constructor(private readonly profileRepo: ProfileRepository) {}

  public register(): () => void {
    const listener = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: QueryIdentityProfileResponse) => void
    ): boolean | undefined => {
      if (!this.isQueryIdentityProfileRequest(message)) {
        return undefined;
      }

      this.handleQueryIdentityProfile()
        .then(sendResponse)
        .catch((error) => {
          console.error('[IdentityQueryHandler] Unexpected error:', error);
          sendResponse({
            hasOnboarded: false,
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

  private async handleQueryIdentityProfile(): Promise<QueryIdentityProfileResponse> {
    const profile = await this.profileRepo.get('default-user');
    const hasOnboarded = !!profile?.onboarding;
    return { hasOnboarded };
  }

  private isQueryIdentityProfileRequest(
    message: unknown
  ): message is QueryIdentityProfileRequest {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as QueryIdentityProfileRequest).type === 'QUERY_IDENTITY_PROFILE'
    );
  }
}
