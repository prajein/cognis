import { EventBusContract, createDomainEvent } from '../../core/event-bus';
import { GhostTextEvents, SessionEvents, AdaptationEvents } from '../../core/event-bus/registry';
import { DomainEvent, GhostTextDisplayedPayload, GhostTextDismissedPayload } from '../../core/event-bus/contracts';
import { GapType } from '../../core/types/gap.types';
import { SessionId } from '../../core/types/session.types';

type PreferenceState = 'ACTIVE' | 'SUPPRESSED' | 'PROBING';

interface GapPreference {
  readonly gapType: GapType;
  state: PreferenceState;
  
  // Evidence metrics
  exposures: number;
  acceptances: number;
  explicitRejections: number;
  
  // Exploration metrics
  suppressedDetections: number;
  nextProbeThreshold: number;
  
  // Probe Attribution
  activeProbeInterventionId: string | null;
}

export class GhostTextAdaptor {
  private readonly source = 'ghost-text-adaptor';
  private currentSessionId: SessionId | null = null;
  private readonly preferences = new Map<GapType, GapPreference>();
  private unsubscribes: Array<() => void> = [];

  constructor(private readonly eventBus: EventBusContract) {}

  public start(): void {
    if (this.unsubscribes.length > 0) return;

    this.unsubscribes.push(
      this.eventBus.subscribe(SessionEvents.STARTED, (event) => {
        this.reset(event.sessionId);
      }),
      this.eventBus.subscribe(SessionEvents.ENDED, () => {
        this.reset(null);
      }),
      this.eventBus.subscribe('gap.detected', (event) => {
        this.handleGapDetected(event);
      }),
      this.eventBus.subscribe(GhostTextEvents.DISPLAYED, (event) => {
        this.handleGhostTextDisplayed(event);
      }),
      this.eventBus.subscribe(GhostTextEvents.ACCEPTED, (event) => {
        this.handleAccepted(event);
      }),
      this.eventBus.subscribe(GhostTextEvents.DISMISSED, (event) => {
        this.handleDismissed(event);
      })
    );
  }

  public stop(): void {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
    this.reset(null);
  }

  private reset(sessionId: SessionId | null): void {
    this.currentSessionId = sessionId;
    this.preferences.clear();
  }

  private getOrCreatePreference(gapType: GapType): GapPreference {
    let pref = this.preferences.get(gapType);
    if (!pref) {
      pref = {
        gapType,
        state: 'ACTIVE',
        exposures: 0,
        acceptances: 0,
        explicitRejections: 0,
        suppressedDetections: 0,
        nextProbeThreshold: 5,
        activeProbeInterventionId: null
      };
      this.preferences.set(gapType, pref);
    }
    return pref;
  }

  private handleGapDetected(event: DomainEvent<any>): void {
    if (!this.currentSessionId || event.sessionId !== this.currentSessionId) return;
    
    const { gapType } = event.payload;
    if (!gapType) return;

    const pref = this.getOrCreatePreference(gapType);

    if (pref.state === 'SUPPRESSED') {
      pref.suppressedDetections++;
      if (pref.suppressedDetections >= pref.nextProbeThreshold) {
        pref.state = 'PROBING';
        pref.suppressedDetections = 0;
        
        console.log(`[GhostTextAdaptor] GapType '${gapType}' transitioning to PROBING.`);
        this.emitAdaptationConfig(event.sessionId, gapType, 'active', 'Probing exploration triggered');
      }
    }
  }

  private handleGhostTextDisplayed(event: DomainEvent<GhostTextDisplayedPayload>): void {
    if (!this.currentSessionId || event.sessionId !== this.currentSessionId) return;

    const { gapType, interventionId } = event.payload;
    if (!gapType || !interventionId) return;

    const pref = this.getOrCreatePreference(gapType);

    // If probing and we haven't locked onto a probe intervention yet, this is it.
    if (pref.state === 'PROBING' && pref.activeProbeInterventionId === null) {
      pref.activeProbeInterventionId = interventionId;
    }
  }

  private handleAccepted(event: DomainEvent<any>): void {
    if (!this.currentSessionId || event.sessionId !== this.currentSessionId) return;

    const { gapType, interventionId } = event.payload;
    if (!gapType) return;

    const pref = this.getOrCreatePreference(gapType);

    if (pref.state === 'PROBING' && pref.activeProbeInterventionId === interventionId) {
      // Reversible Preference confirmed: User accepted the probe!
      pref.state = 'ACTIVE';
      pref.activeProbeInterventionId = null;
      // Reset evidence because preference has changed
      pref.exposures = 1;
      pref.acceptances = 1;
      pref.explicitRejections = 0;
      pref.nextProbeThreshold = 5;
      console.log(`[GhostTextAdaptor] Probe accepted for '${gapType}'. Restored to ACTIVE.`);
      // No need to emit AdaptationConfigured because 'restore' was already emitted during SUPPRESSED -> PROBING
      return;
    }

    if (pref.state === 'ACTIVE') {
      pref.exposures++;
      pref.acceptances++;
    }
  }

  private handleDismissed(event: DomainEvent<GhostTextDismissedPayload>): void {
    if (!this.currentSessionId || event.sessionId !== this.currentSessionId) return;

    const { gapType, reason, interventionId } = event.payload;
    if (!gapType || !interventionId || reason === 'replaced') return;

    const pref = this.getOrCreatePreference(gapType);
    const isExplicitRejection = reason === 'continued_typing' || reason === 'caret_moved';

    if (pref.state === 'PROBING' && pref.activeProbeInterventionId === interventionId) {
      if (isExplicitRejection) {
        // Probe failed. Preference confirmed as still negative.
        pref.state = 'SUPPRESSED';
        pref.activeProbeInterventionId = null;
        pref.exposures++;
        pref.explicitRejections++;
        
        // Escalate threshold
        pref.nextProbeThreshold *= 2;
        
        const reasoning = `Probe rejected. Re-suppressing and escalating probe threshold to ${pref.nextProbeThreshold}`;
        console.log(`[GhostTextAdaptor] ${reasoning} for '${gapType}'`);
        this.emitAdaptationConfig(event.sessionId, gapType, 'suppress', reasoning);
      } else {
        // Passive dismissal (lost_focus, etc).
        // Do not fabricate evidence. Clear active probe to allow another generation.
        pref.activeProbeInterventionId = null;
      }
      return;
    }

    if (pref.state === 'ACTIVE') {
      pref.exposures++;
      if (isExplicitRejection) {
        pref.explicitRejections++;
      }

      this.evaluateActivePolicy(pref, event.sessionId);
    }
  }

  private evaluateActivePolicy(pref: GapPreference, sessionId: SessionId): void {
    const { exposures, explicitRejections, gapType } = pref;

    // Weak Evidence / Strong Evidence evaluated by ratio
    if (exposures >= 4 && (explicitRejections / exposures) >= 0.75) {
      pref.state = 'SUPPRESSED';
      pref.suppressedDetections = 0;
      
      const reasoning = `Ghost Text for gap '${gapType}' suppressed due to high rejection rate: ` +
        `${explicitRejections}/${exposures} exposures (${((explicitRejections / exposures) * 100).toFixed(1)}%).`;

      console.log(`[GhostTextAdaptor] Publishing suppression decision:`, reasoning);
      this.emitAdaptationConfig(sessionId, gapType, 'suppress', reasoning);
    }
  }

  private emitAdaptationConfig(sessionId: SessionId, gapType: GapType, action: 'suppress' | 'active', reasoning: string): void {
    const adaptationEvent = createDomainEvent(
      AdaptationEvents.CONFIGURED,
      sessionId,
      this.source,
      {
        targetModule: 'ghosttext',
        gapType,
        action,
        reasoning
      }
    );
    this.eventBus.publish(AdaptationEvents.CONFIGURED, adaptationEvent);
  }
}
