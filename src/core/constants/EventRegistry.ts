export const SessionEvents = {
  STARTED: 'session.started',
  ENDED: 'session.ended',
  PAUSED: 'session.paused',
  RESUMED: 'session.resumed',
} as const;

export const PromptEvents = {
  TYPED: 'prompt.typed',
  SENT: 'prompt.sent',
  ENRICHED: 'prompt.enriched',
  CANCELLED: 'prompt.cancelled',
} as const;

export const CognitiveEvents = {
  PAUSE_DETECTED: 'pause.detected',
  STATE_CHANGED: 'state.changed',
  GAP_DETECTED: 'gap.detected',
} as const;

export const GhostTextEvents = {
  GENERATED: 'ghosttext.generated',
  DISPLAYED: 'ghosttext.displayed',
  ACCEPTED: 'ghosttext.accepted',
  DISMISSED: 'ghosttext.dismissed',
} as const;

export const ResponseEvents = {
  STARTED: 'response.started',
  CHUNK: 'response.chunk',
  COMPLETED: 'response.completed',
} as const;

export const InsightEvents = {
  GENERATED: 'insight.generated',
  MILESTONE_REACHED: 'milestone.reached',
  AUTOMATICITY_UPDATED: 'automaticity.updated',
} as const;

export const HardwareEvents = {
  CONNECTED: 'hardware.connected',
  DISCONNECTED: 'hardware.disconnected',
  SIGNAL_RECEIVED: 'hardware.signal.received',
} as const;
