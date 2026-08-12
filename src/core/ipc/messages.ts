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
 *
 * - Every query request carries a discriminated `type` field.
 *
 * - Every query response wraps its data in a typed `Result` shape so
 * callers can distinguish success from error without relying on exceptions.
 */

import { SessionReadModel } from '../../storage/projections/builders/SessionProjectionBuilder';
import { InsightReadModel } from '../../storage/projections/builders/InsightProjectionBuilder';
import { GapProfileReadModel } from '../../storage/projections/builders/GapProfileProjectionBuilder';
import { OnboardingCompletedPayload } from '../event-bus/contracts';
import { GapType } from '../types/gap.types';

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
 * is active. A session is considered active when its status is 'active' or
 * 'paused'.
 *
 * - `error`: Present only when the handler encountered an unexpected failure.
 * The sidepanel should treat this as a disconnect and render a safe fallback.
 */
export interface QueryActiveSessionResponse {
    readonly session: SessionReadModel | null;
    readonly error?: string;
}

// ---------------------------------------------------------------------------
// Progress Query
// ---------------------------------------------------------------------------

/**
 * Response metrics exposed to the progress feature.
 *
 * The underlying ResponseMetricsProjectionBuilder stores absolute sums.
 * The query layer converts those sums into session-level averages so that
 * consumers do not need to know about the projection implementation.
 */
export interface ProgressSessionResponseMetrics {
    readonly totalResponses: number;
    readonly averageQuality: number | null;
    readonly averageReasoning: number | null;
    readonly averageStructure: number | null;
}

/**
 * Historical session data required by the progress feature.
 *
 * `sessionNumber` is assigned by the query layer after chronological
 * ordering. It is intentionally not taken from SessionRecord, because
 * the persistent session projections are the authoritative historical source.
 */
export interface ProgressSession {
    readonly sessionNumber: number;
    readonly sessionId: string;
    readonly taskId: string | null;
    readonly platform: string;

    readonly startTime: number;
    readonly endTime?: number;
    readonly durationMs?: number;

    readonly responseMetrics: ProgressSessionResponseMetrics;
}

/**
 * Request: retrieves completed sessions for a specific task.
 *
 * The background resolves this from the persistent session and response
 * metrics read models.
 */
export interface QueryProgressRequest {
    readonly type: 'QUERY_PROGRESS';
    readonly taskId: string;
}

/**
 * Response returned by the background progress query handler.
 */
export interface QueryProgressResponse {
    readonly sessions: readonly ProgressSession[];
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
    readonly onboarding: OnboardingCompletedPayload | null;
    readonly error?: string;
}

// ---------------------------------------------------------------------------
// Query — QUERY_SESSION_GAPS
// ---------------------------------------------------------------------------

export interface QuerySessionGapsRequest {
    readonly type: 'QUERY_SESSION_GAPS';
    readonly sessionId: string;
}

export interface QuerySessionGapsResponse {
    readonly gapProfile: GapProfileReadModel | null;
    readonly error?: string;
}

// ---------------------------------------------------------------------------
// Query — QUERY_ADAPTATION_STATE
// ---------------------------------------------------------------------------

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

/**
 * All query request types that the background message router recognises.
 */
export type BackgroundQueryRequest =
    | QueryActiveSessionRequest
    | QueryProgressRequest
    | QuerySessionInsightsRequest
    | QueryIdentityProfileRequest
    | QueryAdaptationStateRequest
    | QuerySessionGapsRequest;