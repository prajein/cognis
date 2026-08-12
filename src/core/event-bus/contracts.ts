/**
 * Cognis Event Contracts
 *
 * Defines the DomainEvent envelope and all payload interfaces
 * for every event in the Cognis system.
 *
 * This file is the single source of truth for event shapes.
 * All engines, adapters, storage, and presentation layers
 * must conform to these contracts.
 *
 * Design considerations:
 * - Event replay: DomainEvent carries all context needed for replay.
 * - Event sourcing: Payloads are self-contained facts, not derived state.
 * - IndexedDB persistence: All types are JSON-serializable.
 * - Arc readiness: No platform or browser types in any payload.
 */

import { EventId, SessionId, Timestamp } from '../types/session.types';
import { StateLabel } from '../types/state.types';
import { GapType } from '../types/gap.types';
import { EventType } from './registry';

// ---------------------------------------------------------------------------
// Domain Event Envelope
// ---------------------------------------------------------------------------

/**
 * The universal event envelope for all Cognis domain events.
 *
 * Every event flowing through the EventBus and persisted to IndexedDB
 * must conform to this interface. The generic parameter T is constrained
 * by CognisEventMap to ensure compile-time payload validation.
 *
 * @template T - The payload type, specific to the event's type field.
 */
export interface DomainEvent<T> {
  /** Unique identifier for this event instance. */
  readonly id: EventId;

  /** The event type from the registry. */
  readonly type: EventType;

  /** Unix epoch timestamp in milliseconds when the event was created. */
  readonly timestamp: Timestamp;

  /** The session this event belongs to. */
  readonly sessionId: SessionId;

  /**
   * The module or provider that produced this event.
   * Examples: 'perception', 'state-engine', 'chatgpt-adapter', 'arc-ble'
   */
  readonly source: string;

  /** The event-specific payload. */
  readonly payload: T;

  /**
   * Transport-level origin indicating whether this event originated locally ('local')
   * or arrived over IPC from a remote authoritative context ('remote').
   */
  readonly origin?: 'local' | 'remote';

  /**
   * Flag indicating whether this event has been processed and authoritatively confirmed
   * by the background domain projection.
   */
  readonly isAuthoritative?: boolean;
}

// ---------------------------------------------------------------------------
// Session Event Payloads
// ---------------------------------------------------------------------------

/**
 * Payload for session.started
 *
 * Purpose: Records the initiation of a new user session on an AI platform.
 * Producer: Perception Layer (content script), Side Panel (user-initiated)
 * Consumer: State Engine, Storage Layer
 */
export interface SessionStartedPayload {
  /** The AI platform where the session was started. */
  readonly platform: string;

  /**
   * The task the user selected before starting the session.
   * Populated when the session is initiated from Surface B (side panel).
   * Absent when the session is started implicitly by the platform adapter
   * (e.g. PlatformManager detecting a page load in the content script).
   */
  readonly taskId?: string;
}

/**
 * Payload for session.ended
 *
 * Purpose: Records the termination of a user session.
 * Producer: Perception Layer (content script)
 * Consumer: State Engine, Storage Layer, Insight Engine
 */
export interface SessionEndedPayload {
  /** Reason the session ended. */
  readonly reason: 'tab_closed' | 'navigation' | 'timeout' | 'explicit';
}

/**
 * Payload for session.paused
 *
 * Purpose: Records a temporary session pause (e.g., tab hidden).
 * Producer: Perception Layer (content script)
 * Consumer: State Engine, Storage Layer
 */
export interface SessionPausedPayload {
  /** Reason the session was paused. */
  readonly reason: 'tab_hidden' | 'idle' | 'explicit';
}

/**
 * Payload for session.resumed
 *
 * Purpose: Records a session resumption after a pause.
 * Producer: Perception Layer (content script)
 * Consumer: State Engine, Storage Layer
 */
export interface SessionResumedPayload {
  /** Duration of the pause in milliseconds. */
  readonly pauseDurationMs: number;
}

// ---------------------------------------------------------------------------
// Prompt Event Payloads
// ---------------------------------------------------------------------------

/**
 * Payload for prompt.typed
 *
 * Purpose: Captures real-time typing metrics without storing raw text.
 *          Prompt hashes only; no raw prompt storage (Constitution Section 2).
 * Producer: Perception Layer (content script)
 * Consumer: State Engine, Gap Detection Engine
 */
export interface PromptTypedPayload {
  /** Current character count of the prompt text. */
  readonly textLength: number;

  /** Current word count of the prompt text. */
  readonly wordCount: number;

  /** Hash of the current prompt text. Never the raw text itself. */
  readonly currentTextHash: string;

  /** Number of revisions/edits the user has made to this prompt. */
  readonly revisionDepth: number;
}

/**
 * Payload for prompt.sent
 *
 * Purpose: Records that the user submitted a prompt to the AI platform.
 *          Contains only metadata; the raw prompt is NOT persisted.
 * Producer: Perception Layer (content script)
 * Consumer: Enrichment Engine, Storage Layer
 */
export interface PromptSentPayload {
  /** Hash of the final submitted prompt text. */
  readonly promptHash: string;

  /** Character count of the submitted prompt. */
  readonly textLength: number;

  /** Word count of the submitted prompt. */
  readonly wordCount: number;

  /** Whether the prompt was enriched before sending. */
  readonly wasEnriched: boolean;
}

/**
 * Payload for prompt.enriched
 *
 * Purpose: Records the enrichment applied to a prompt.
 * Producer: Enrichment Engine
 * Consumer: Storage Layer, Insight Engine
 */
export interface PromptEnrichedPayload {
  /** Version of the enrichment engine that produced this result. */
  readonly enrichmentVersion: string;

  /** Ordered list of enrichment layers that were applied. */
  readonly appliedLayers: ReadonlyArray<string>;

  /** The cognitive state label at the time of enrichment. */
  readonly stateLabel: StateLabel;
}

/**
 * Payload for prompt.cancelled
 *
 * Purpose: Records that the user abandoned a prompt before sending.
 * Producer: Perception Layer (content script)
 * Consumer: State Engine, Storage Layer
 */
export interface PromptCancelledPayload {
  /** Character count at the time of cancellation. */
  readonly textLength: number;

  /** Hash of the prompt text at cancellation. */
  readonly textHash: string;
}

// ---------------------------------------------------------------------------
// Cognitive Event Payloads
// ---------------------------------------------------------------------------

/**
 * Payload for pause.detected
 *
 * Purpose: Records a significant typing pause that may indicate cognitive processing.
 * Producer: Perception Layer (content script)
 * Consumer: State Engine, Ghost Text Engine
 */
export interface PauseDetectedPayload {
  /** Duration of the pause in milliseconds. */
  readonly durationMs: number;

  /** Character count of the prompt at the time of the pause. */
  readonly textLength: number;
}

/**
 * Payload for state.changed
 *
 * Purpose: Records a transition between cognitive states.
 *          This is an Arc-stable interface (Constitution Section 9).
 * Producer: State Engine (or future Arc hardware)
 * Consumer: Gap Detection Engine, Enrichment Engine, Storage Layer
 */
export interface StateChangedPayload {
  /** The cognitive state before the transition. */
  readonly previousState: StateLabel;

  /** The cognitive state after the transition. */
  readonly currentState: StateLabel;

  /** Confidence score of the state inference (0.0 to 1.0). */
  readonly confidence: number;
}

/**
 * Payload for gap.detected
 *
 * Purpose: Records a detected cognitive gap in the user's prompt.
 * Producer: Gap Detection Engine
 * Consumer: Ghost Text Engine, Enrichment Engine, Storage Layer
 */
export interface GapDetectedPayload {
  /** The type of cognitive gap detected. */
  readonly gapType: GapType;

  /** Confidence score of the gap detection (0.0 to 1.0). */
  readonly confidence: number;
}

// ---------------------------------------------------------------------------
// Ghost Text Event Payloads
// ---------------------------------------------------------------------------

/**
 * Payload for ghosttext.generated
 *
 * Purpose: Records a ghost text suggestion that was generated.
 * Producer: Ghost Text Engine
 * Consumer: Perception Layer (for display), Storage Layer
 */
export interface GhostTextGeneratedPayload {
  /** Unique ID identifying this intervention suggestion. */
  readonly interventionId: string;

  /** The type of gap this ghost text addresses. */
  readonly gapType: GapType;

  /** The ghost text suggestion stem. */
  readonly stem: string;
}

/**
 * Payload for ghosttext.displayed
 *
 * Purpose: Records that a ghost text suggestion was shown to the user.
 * Producer: Perception Layer (content script)
 * Consumer: Storage Layer, Insight Engine
 */
export interface GhostTextDisplayedPayload {
  /** Unique ID identifying this intervention suggestion. */
  readonly interventionId: string;

  /** The type of gap this ghost text addresses. */
  readonly gapType: GapType;

  /** The ghost text stem that was displayed. */
  readonly stem: string;

  /** Time in milliseconds from generation to display. */
  readonly displayLatencyMs: number;
}

/**
 * Payload for ghosttext.accepted
 *
 * Purpose: Records that the user accepted a ghost text suggestion.
 * Producer: Perception Layer (content script)
 * Consumer: Storage Layer, Insight Engine
 */
export interface GhostTextAcceptedPayload {
  /** Unique ID identifying this intervention suggestion. */
  readonly interventionId: string;

  /** The ghost text stem that was accepted. */
  readonly stem: string;

  /** The gap type that was resolved by acceptance. */
  readonly gapType: GapType;
}

/**
 * Payload for ghosttext.dismissed
 *
 * Purpose: Records that the user dismissed a ghost text suggestion.
 * Producer: Perception Layer (content script)
 * Consumer: Storage Layer, Insight Engine
 */
export interface GhostTextDismissedPayload {
  /** Unique ID identifying this intervention suggestion. */
  readonly interventionId: string;

  /** The ghost text stem that was dismissed. */
  readonly stem: string;

  /**
   * The gap type the dismissed suggestion was addressing.
   * Optional for defensive replay of legacy events that pre-date this field.
   * Projection consumers must handle absence gracefully.
   */
  readonly gapType?: GapType;

  /** How the ghost text was dismissed. */
  readonly reason: 'explicit' | 'timeout' | 'continued_typing' | 'caret_moved' | 'node_removed' | 'lost_focus' | 'replaced';
}

/**
 * Payload for ghosttext.measurement.computed
 *
 * Purpose: Records observable behavioral signatures surrounding ghost-text dismissals.
 * Producer: Perception Layer (GhostTextMeasurementObserver)
 * Consumer: Telemetry/Analytics
 */
export interface GhostTextMeasurementComputedPayload {
  readonly interventionId: string;
  readonly gapType: GapType;
  
  readonly dismissalReason: 'explicit' | 'timeout' | 'continued_typing' | 'caret_moved' | 'node_removed' | 'lost_focus' | 'replaced';
  readonly measurementCompletionReason: 'idle_timeout' | 'hard_timeout' | 'prompt_sent' | 'focus_lost' | 'intervention_replaced' | 'node_removed';
  
  readonly context: {
    readonly origin: string;
    readonly domRole: string;
  };
  
  readonly features: {
    readonly continuationLatencyMs: number | null;
    readonly typedTextLength: number | null;
    readonly stemLength: number;
    readonly baselineTextLength: number;
    readonly lexicalOverlap: number | null;
    readonly editDistance: number | null;
  };
  
  readonly confidence: 'high' | 'medium' | 'low' | 'unknown';
}

// ---------------------------------------------------------------------------
// Response Event Payloads
// ---------------------------------------------------------------------------

/**
 * Payload for response.started
 *
 * Purpose: Records that the AI platform began generating a response.
 * Producer: Perception Layer (content script via adapter)
 * Consumer: Response Intelligence Engine, Storage Layer
 */
export interface ResponseStartedPayload {
  /** Hash of the prompt that triggered this response. */
  readonly promptHash: string;

  /** The unique event ID of the prompt.sent event that triggered this response. */
  readonly promptEventId?: string;

  /** Whether the triggering prompt was enriched. */
  readonly wasEnriched?: boolean;
}

/**
 * Payload for response.chunk
 *
 * Purpose: Records a streaming chunk from the AI response.
 * Producer: Perception Layer (content script via adapter)
 * Consumer: Response Intelligence Engine
 */
export interface ResponseChunkPayload {
  /**
   * [TRANSPORT-ONLY]
   * Transient string containing the actual streaming text.
   * Per ADR-019, this field is excluded from persistence mapping.
   * It exists only in memory for synchronous analytical dispatch.
   */
  readonly chunkText?: string;

  /** Character count of this chunk. */
  readonly chunkLength: number;

  /** Cumulative character count of the response so far. */
  readonly totalLength: number;
}

/**
 * Payload for response.completed
 *
 * Purpose: Records that the AI platform finished generating a response.
 * Producer: Perception Layer (content script via adapter)
 * Consumer: Response Intelligence Engine, Insight Engine, Storage Layer
 */
export interface ResponseCompletedPayload {
  /** Total character count of the completed response. */
  readonly responseLength: number;

  /** Total duration of response generation in milliseconds. */
  readonly durationMs: number;
}

/**
 * Payload for response.abandoned
 *
 * Purpose: Records that the user interrupted/stopped a response.
 * Producer: Perception Layer (content script via adapter)
 * Consumer: Response Intelligence Engine, Storage Layer
 */
export interface ResponseAbandonedPayload {
  /** Character count at the time of abandonment. */
  readonly partialLength: number;

  /** Duration before abandonment in milliseconds. */
  readonly durationMs: number;
}

/**
 * ResponseAnalysis
 *
 * The output contract of the ResponseIntelligenceEngine.
 * Everything downstream (InsightEngine, Projection Builders, Surface B)
 * must depend on this type, not on internal analyzer results.
 *
 * All scores are in the range [0.0, 1.0].
 * Flags are stable string identifiers produced by individual analyzers.
 */
export interface ResponseAnalysis {
  /** Hash of the prompt that triggered this response. */
  readonly promptHash: string;
  
  /** Link to the specific prompt.sent event. */
  readonly promptEventId?: string;

  /** Whether the triggering prompt was enriched. */
  readonly wasEnriched?: boolean;

  /** Evaluated structural completeness (0.0 to 1.0). */
  readonly structuralScore: number;
  
  /** Evaluated reasoning depth (0.0 to 1.0). */
  readonly reasoningScore: number;
  
  /** Evaluated quality score (0.0 to 1.0). */
  readonly qualityScore: number;

  readonly completenessScore: number;

  readonly assumptionScore: number;

  readonly gapCompletionScore: number;
  
  /** Array of semantic flags (e.g., 'heavy_code', 'step_by_step'). */
  readonly flags: ReadonlyArray<string>;
}

/**
 * Payload for response.analysis.completed
 *
 * Purpose: Records the heuristic evaluation of a completed response.
 *          Contains derived metrics ONLY, no transient text.
 * Producer: Response Intelligence Engine
 * Consumer: Storage Layer, Projection Builders
 */
export interface ResponseAnalysisCompletedPayload extends ResponseAnalysis {}

// ---------------------------------------------------------------------------
// Insight Event Payloads
// ---------------------------------------------------------------------------

import { TaxonomyDomain } from '../types/insight.types';

/**
 * Payload for insight.generated
 *
 * Purpose: Records a behavioral insight derived from accumulated events.
 * Producer: Insight Engine
 * Consumer: Storage Layer, Side Panel (Surface B)
 */
export interface InsightGeneratedPayload {
  /** Unique identifier for the insight. */
  readonly insightId: string;

  /** Category of the insight. */
  readonly domain: TaxonomyDomain;

  /** Title of the insight. */
  readonly title: string;

  /** Human-readable summary of the insight. */
  readonly summary: string;

  /** Confidence score (0.0 to 1.0). */
  readonly confidence: number;

  /** Number of independent events that contributed to this insight. */
  readonly evidenceCount: number;
}

/**
 * Payload for milestone.reached
 *
 * Purpose: Records a skill development milestone.
 * Producer: Insight Engine
 * Consumer: Storage Layer, Side Panel (Surface B)
 */
export interface MilestoneReachedPayload {
  /** The skill domain (e.g., 'coding', 'writing'). */
  readonly skillDomain: string;

  /** Description of the milestone. */
  readonly milestone: string;
}

/**
 * Payload for automaticity.updated
 *
 * Purpose: Records a change in the user's automaticity score for a skill.
 *          This is an Arc-stable interface (Constitution Section 9).
 * Producer: Insight Engine
 * Consumer: Storage Layer, Side Panel (Surface B)
 */
export interface AutomaticityUpdatedPayload {
  /** The skill domain being measured. */
  readonly skillDomain: string;

  /** Previous automaticity phase. */
  readonly previousPhase: string;

  /** Current automaticity phase. */
  readonly currentPhase: string;

  /** Numeric score (0.0 to 1.0). */
  readonly score: number;
}

// ---------------------------------------------------------------------------
// Identity Event Payloads
// ---------------------------------------------------------------------------

/**
 * Synthetic session identifier used exclusively by the onboarding event.
 *
 * Workaround: the DomainEvent envelope structurally requires a SessionId,
 * although onboarding is not associated with a cognitive session.
 */
export const ONBOARDING_SESSION_ID = 'system-onboarding' as SessionId;

/**
 * Payload for identity.onboarding.completed
 *
 * Purpose: Records the user's initial onboarding configuration answers.
 *          Field names are intentionally generic placeholders (answer1, answer2, answer3)
 *          until the product team defines the final semantic domains.
 * Producer: Side Panel (Onboarding Flow)
 * Consumer: Identity Profile Writer, Storage Layer
 */
export interface OnboardingCompletedPayload {
  readonly answer1: string;
  readonly answer2: string;
  readonly answer3: string;
}

// ---------------------------------------------------------------------------
// Hardware Event Payloads
// ---------------------------------------------------------------------------

/**
 * Payload for hardware.connected
 *
 * Purpose: Records that an Arc hardware device has connected.
 *          This is an Arc-stable interface (Constitution Section 9).
 * Producer: Future Arc hardware adapter
 * Consumer: State Engine, Storage Layer
 */
export interface HardwareConnectedPayload {
  /** Identifier of the connected hardware device. */
  readonly deviceId: string;

  /** Type of hardware device. */
  readonly deviceType: string;

  /** Firmware version of the connected device. */
  readonly firmwareVersion: string;
}

/**
 * Payload for hardware.disconnected
 *
 * Purpose: Records that an Arc hardware device has disconnected.
 * Producer: Future Arc hardware adapter
 * Consumer: State Engine, Storage Layer
 */
export interface HardwareDisconnectedPayload {
  /** Identifier of the disconnected hardware device. */
  readonly deviceId: string;

  /** Reason for disconnection. */
  readonly reason: 'explicit' | 'timeout' | 'error';
}

/**
 * Payload for hardware.signal.received
 *
 * Purpose: Records a raw signal from Arc hardware.
 *          This is an Arc-stable interface (Constitution Section 9).
 * Producer: Future Arc hardware adapter
 * Consumer: State Engine
 */
export interface HardwareSignalReceivedPayload {
  /** Identifier of the device that sent the signal. */
  readonly deviceId: string;

  /** Type of signal received. */
  readonly signalType: string;

  /** Signal value. Interpretation depends on signalType. */
  readonly value: number;

  /** Confidence of the signal reading (0.0 to 1.0). */
  readonly confidence: number;
}

// ---------------------------------------------------------------------------
// Adaptation Event Payloads
// ---------------------------------------------------------------------------

/**
 * Payload for adaptation.configured
 *
 * Purpose: Records an adaptation policy decision that updates co-pilot engine behavior.
 * Producer: Adaptation Coordinator (background script)
 * Consumer: Domain Engines (e.g. Ghost Text Engine in content script)
 */
export interface AdaptationConfiguredPayload {
  /** The target engine module to adapt. */
  readonly targetModule: 'ghosttext';

  /** The gap type that is subject to adaptation. */
  readonly gapType: GapType;

  /** The action to perform (e.g. suppress stems, restore active behavior). */
  readonly action: 'suppress' | 'active';

  /** Human-readable explanation of why this decision was made. */
  readonly reasoning: string;
}

// ---------------------------------------------------------------------------
// Cognis Event Map
// ---------------------------------------------------------------------------

/**
 * Maps every event type string to its concrete payload interface.
 *
 * This enables compile-time payload validation on EventBus operations:
 *
 *   eventBus.publish('state.changed', payload)
 *   //                                ^^^^^^^ must be StateChangedPayload
 *
 *   eventBus.subscribe('gap.detected', (event) => {
 *     event.payload.gapType  // fully typed as GapType
 *   })
 */
export interface CognisEventMap {
  // Session
  'session.started': SessionStartedPayload;
  'session.ended': SessionEndedPayload;
  'session.paused': SessionPausedPayload;
  'session.resumed': SessionResumedPayload;

  // Prompt
  'prompt.typed': PromptTypedPayload;
  'prompt.sent': PromptSentPayload;
  'prompt.enriched': PromptEnrichedPayload;
  'prompt.cancelled': PromptCancelledPayload;

  // Cognitive
  'pause.detected': PauseDetectedPayload;
  'state.changed': StateChangedPayload;
  'gap.detected': GapDetectedPayload;

  // Ghost Text
  'ghosttext.generated': GhostTextGeneratedPayload;
  'ghosttext.displayed': GhostTextDisplayedPayload;
  'ghosttext.accepted': GhostTextAcceptedPayload;
  'ghosttext.dismissed': GhostTextDismissedPayload;
  'ghosttext.measurement.computed': GhostTextMeasurementComputedPayload;

  // Response
  'response.started': ResponseStartedPayload;
  'response.chunk': ResponseChunkPayload;
  'response.completed': ResponseCompletedPayload;
  'response.abandoned': ResponseAbandonedPayload;
  'response.analysis.completed': ResponseAnalysisCompletedPayload;

  // Insight
  'insight.generated': InsightGeneratedPayload;
  'milestone.reached': MilestoneReachedPayload;
  'automaticity.updated': AutomaticityUpdatedPayload;

  // Hardware
  'hardware.connected': HardwareConnectedPayload;
  'hardware.disconnected': HardwareDisconnectedPayload;
  'hardware.signal.received': HardwareSignalReceivedPayload;

  // Adaptation
  'adaptation.configured': AdaptationConfiguredPayload;

  // Identity
  'identity.onboarding.completed': OnboardingCompletedPayload;
}

