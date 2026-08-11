/**
 * Cognis IPC Message Contracts
 *
 * Defines the typed message envelopes exchanged between extension contexts
 * via chrome.runtime.sendMessage / chrome.runtime.onMessage.
 *
 * These types sit in core/ (not in background/ or sidepanel/) so both
 * processes can import them without creating cross-context dependencies.
 *
 * Design:
 * - Every query request carries a discriminated `type` field.
 * - Every query response wraps its data in a typed `Result` shape so
 *   callers can distinguish success from error without relying on exceptions.
 */

import { SessionReadModel } from '../../storage/projections/builders/SessionProjectionBuilder';
import { InsightReadModel } from '../../storage/projections/builders/InsightProjectionBuilder';

// ---------------------------------------------------------------------------
// Query — QUERY_ACTIVE_SESSION
// ---------------------------------------------------------------------------

/**
 * Request: sent by the sidepanel SessionQueryGateway to the background worker.
 * The background responds synchronously within the onMessage handler (return true).
 */
export interface QueryActiveSessionRequest {
  readonly type: 'QUERY_ACTIVE_SESSION';
}

/**
 * Response: returned by the background SessionQueryHandler.
 *
 * - `session`: The currently active SessionReadModel, or null if no session
 *   is active. A session is considered active when its status is 'active' or 'paused'.
 * - `error`: Present only when the handler encountered an unexpected failure.
 *   The sidepanel should treat this as a disconnect and render a safe fallback.
 */
export interface QueryActiveSessionResponse {
  readonly session: SessionReadModel | null;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Query — QUERY_SESSION_INSIGHTS
// ---------------------------------------------------------------------------

export interface QuerySessionInsightsRequest {
  readonly type: 'QUERY_SESSION_INSIGHTS';
  readonly sessionId: string;
}

export interface QuerySessionInsightsResponse {
  readonly insights: InsightReadModel | null;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Query — QUERY_IDENTITY_PROFILE
// ---------------------------------------------------------------------------

export interface QueryIdentityProfileRequest {
  readonly type: 'QUERY_IDENTITY_PROFILE';
}

export interface QueryIdentityProfileResponse {
  readonly hasOnboarded: boolean;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Query — QUERY_ADAPTATION_STATE
// ---------------------------------------------------------------------------

import { GapType } from '../types/gap.types';

export interface QueryAdaptationStateRequest {
  readonly type: 'QUERY_ADAPTATION_STATE';
}

export interface QueryAdaptationStateResponse {
  readonly suppressedGaps: GapType[];
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Discriminated union for future extensibility
// ---------------------------------------------------------------------------

/** All query request types that the background message router recognises. */
export type BackgroundQueryRequest = QueryActiveSessionRequest | QuerySessionInsightsRequest | QueryIdentityProfileRequest | QueryAdaptationStateRequest;
