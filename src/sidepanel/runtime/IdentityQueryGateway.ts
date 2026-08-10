/// <reference types="chrome" />
import {
  QueryIdentityProfileRequest,
  QueryIdentityProfileResponse,
} from '../../core/ipc/messages';

/** Timeout in ms before a background query is treated as a connectivity failure. */
const QUERY_TIMEOUT_MS = 5_000;

export interface IdentityQueryGateway {
  getIdentityProfile(): Promise<{ hasOnboarded: boolean | null; error?: string }>;
}

export class IpcIdentityGateway implements IdentityQueryGateway {
  public getIdentityProfile(): Promise<{ hasOnboarded: boolean | null; error?: string }> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`[IdentityQueryGateway] getIdentityProfile() timed out after ${QUERY_TIMEOUT_MS}ms`));
      }, QUERY_TIMEOUT_MS);

      const request: QueryIdentityProfileRequest = { type: 'QUERY_IDENTITY_PROFILE' };

      chrome.runtime.sendMessage(request, (response: QueryIdentityProfileResponse | undefined) => {
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError) {
          reject(new Error(`[IdentityQueryGateway] Chrome IPC error: ${chrome.runtime.lastError.message}`));
          return;
        }

        if (!response) {
          resolve({ hasOnboarded: null, error: 'Empty response' });
          return;
        }

        if (response.error) {
          console.warn('[IdentityQueryGateway] Background returned error:', response.error);
          resolve({ hasOnboarded: null, error: response.error });
          return;
        }

        resolve({ hasOnboarded: response.hasOnboarded });
      });
    });
  }
}
