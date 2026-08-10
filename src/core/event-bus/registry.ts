/**
 * Cognis Event Registry
 *
 * Single source of truth for all domain event names in the system.
 * Every event emitted or consumed by any Cognis module must reference
 * constants from this registry. Magic strings are forbidden.
 *
 * Event names are immutable public contracts.
 * Changing an event name is a breaking architectural change.
 * (Constitution Section 5 — Event Contract Law)
 *
 * All constants are frozen at runtime to prevent mutation.
 */

// ---------------------------------------------------------------------------
// Session Events
// ---------------------------------------------------------------------------

export const SessionEvents = Object.freeze({
  STARTED: 'session.started',
  ENDED: 'session.ended',
  PAUSED: 'session.paused',
  RESUMED: 'session.resumed',
} as const);

// ---------------------------------------------------------------------------
// Prompt Events
// ---------------------------------------------------------------------------

export const PromptEvents = Object.freeze({
  TYPED: 'prompt.typed',
  SENT: 'prompt.sent',
  ENRICHED: 'prompt.enriched',
  CANCELLED: 'prompt.cancelled',
} as const);

// ---------------------------------------------------------------------------
// Cognitive Events
// ---------------------------------------------------------------------------

export const CognitiveEvents = Object.freeze({
  PAUSE_DETECTED: 'pause.detected',
  STATE_CHANGED: 'state.changed',
  GAP_DETECTED: 'gap.detected',
} as const);

// ---------------------------------------------------------------------------
// Ghost Text Events
// ---------------------------------------------------------------------------

export const GhostTextEvents = Object.freeze({
  GENERATED: 'ghosttext.generated',
  DISPLAYED: 'ghosttext.displayed',
  ACCEPTED: 'ghosttext.accepted',
  DISMISSED: 'ghosttext.dismissed',
} as const);

// ---------------------------------------------------------------------------
// Response Events
// ---------------------------------------------------------------------------

export const ResponseEvents = Object.freeze({
  STARTED: 'response.started',
  CHUNK: 'response.chunk',
  COMPLETED: 'response.completed',
  ABANDONED: 'response.abandoned',
  ANALYSIS_COMPLETED: 'response.analysis.completed',
} as const);

// ---------------------------------------------------------------------------
// Insight Events
// ---------------------------------------------------------------------------

export const InsightEvents = Object.freeze({
  GENERATED: 'insight.generated',
  MILESTONE_REACHED: 'milestone.reached',
  AUTOMATICITY_UPDATED: 'automaticity.updated',
} as const);

// ---------------------------------------------------------------------------
// Hardware Events
// ---------------------------------------------------------------------------

export const HardwareEvents = Object.freeze({
  CONNECTED: 'hardware.connected',
  DISCONNECTED: 'hardware.disconnected',
  SIGNAL_RECEIVED: 'hardware.signal.received',
} as const);

// ---------------------------------------------------------------------------
// Adaptation Events
// ---------------------------------------------------------------------------

export const AdaptationEvents = Object.freeze({
  CONFIGURED: 'adaptation.configured',
} as const);

// ---------------------------------------------------------------------------
// Identity Events
// ---------------------------------------------------------------------------

export const IdentityEvents = Object.freeze({
  ONBOARDING_COMPLETED: 'identity.onboarding.completed',
} as const);

// ---------------------------------------------------------------------------
// Derived EventType union
// ---------------------------------------------------------------------------

/**
 * Union of every valid event type string in Cognis.
 * Used by DomainEvent.type and EventBus publish/subscribe signatures.
 */
export type EventType =
  | typeof SessionEvents[keyof typeof SessionEvents]
  | typeof PromptEvents[keyof typeof PromptEvents]
  | typeof CognitiveEvents[keyof typeof CognitiveEvents]
  | typeof GhostTextEvents[keyof typeof GhostTextEvents]
  | typeof ResponseEvents[keyof typeof ResponseEvents]
  | typeof InsightEvents[keyof typeof InsightEvents]
  | typeof HardwareEvents[keyof typeof HardwareEvents]
  | typeof AdaptationEvents[keyof typeof AdaptationEvents]
  | typeof IdentityEvents[keyof typeof IdentityEvents];
