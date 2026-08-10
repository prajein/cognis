import { EventBusContract, createDomainEvent } from '../../core/event-bus';
import { GhostTextEvents, SessionEvents, AdaptationEvents } from '../../core/event-bus/registry';
import { DomainEvent, GhostTextDisplayedPayload, GhostTextDismissedPayload } from '../../core/event-bus/contracts';
import { GapType } from '../../core/types/gap.types';
import { SessionId } from '../../core/types/session.types';
import { AdaptationPreferenceRepository } from '../../storage/repositories/AdaptationPreferenceRepository';
import { PersistedGapPreference, ADAPTATION_PROFILE_ID } from '../../core/types/adaptation.types';

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

  // Persistence metadata
  firstSeenAt: number;
}

export class GhostTextAdaptor {
  private readonly source = 'ghost-text-adaptor';
  private currentSessionId: SessionId | null = null;
  private readonly preferences = new Map<GapType, GapPreference>();
  private unsubscribes: Array<() => void> = [];

  constructor(
    private readonly eventBus: EventBusContract,
    private readonly repository: AdaptationPreferenceRepository | null = null
  ) {}

  public start(): void {
    if (this.unsubscribes.length > 0) return;

    this.unsubscribes.push(
      this.eventBus.subscribe(SessionEvents.STARTED, (event) => {
        this.handleSessionStarted(event.sessionId);
      }),
      this.eventBus.subscribe(SessionEvents.ENDED, () => {
        this.handleSessionEnded();
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
    this.handleSessionEnded();
  }

  private async handleSessionStarted(sessionId: SessionId): Promise<void> {
    this.currentSessionId = sessionId;
    this.preferences.clear();

    if (!this.repository) {
      return; // Skip persistence when repository is null (e.g. M9 tests)
    }

    try {
      const persistedPrefs = await this.repository.getAll(ADAPTATION_PROFILE_ID);
      for (const record of persistedPrefs) {
        // Reconstruct nextProbeThreshold based on evidence
        let threshold = 5;
        if (record.persistedState === 'SUPPRESSED') {
          const rejectionRate = record.totalExplicitRejections / Math.max(record.totalExposures, 1);
          if (rejectionRate >= 0.90) threshold = 20;
          else if (rejectionRate >= 0.75) threshold = 10;
        }

        const pref: GapPreference = {
          gapType: record.gapType,
          state: record.persistedState,
          exposures: 0, // In-session accumulation starts at 0
          acceptances: 0,
          explicitRejections: 0,
          suppressedDetections: 0,
          nextProbeThreshold: threshold,
          activeProbeInterventionId: null,
          firstSeenAt: record.firstSeenAt,
        };
        this.preferences.set(record.gapType, pref);
        
        // If it was already suppressed in a previous session, emit configuration now
        if (pref.state === 'SUPPRESSED') {
          this.emitAdaptationConfig(sessionId, pref.gapType, 'suppress', 'Restored suppression from persistent model');
        }
      }
    } catch (error) {
      console.error('[GhostTextAdaptor] Failed to load persistent preferences:', error);
    }
  }

  private async handleSessionEnded(): Promise<void> {
    const sessionId = this.currentSessionId;
    this.currentSessionId = null;

    if (!sessionId || !this.repository) {
      this.preferences.clear();
      return;
    }

    // Flush all preferences
    const now = Date.now();
    const promises: Promise<void>[] = [];

    for (const pref of this.preferences.values()) {
      // Only flush if we actually have some evidence from this session or a past session
      // Wait, if exposures == 0, we still want to flush if it was loaded from DB? No, if exposures=0, nothing changed. 
      // But we still flush it because we use atomic update which handles it. We just pass the in-session deltas.
      if (pref.exposures === 0 && pref.acceptances === 0 && pref.explicitRejections === 0) {
        continue;
      }

      const record: PersistedGapPreference = {
        id: `${ADAPTATION_PROFILE_ID}::${pref.gapType}`,
        profileId: ADAPTATION_PROFILE_ID,
        gapType: pref.gapType,
        totalExposures: pref.exposures,
        totalAcceptances: pref.acceptances,
        totalExplicitRejections: pref.explicitRejections,
        persistedState: pref.state === 'PROBING' ? 'SUPPRESSED' : pref.state,
        policyVersion: 'm10.0',
        firstSeenAt: pref.firstSeenAt,
        lastUpdatedAt: now,
        lastSessionId: sessionId,
      };

      promises.push(this.repository.flush(record, sessionId));
    }

    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('[GhostTextAdaptor] Failed to flush persistent preferences:', error);
    } finally {
      this.preferences.clear();
    }
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
        activeProbeInterventionId: null,
        firstSeenAt: Date.now(),
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
      // No need to emit AdaptationConfigured because 'active' was already emitted during SUPPRESSED -> PROBING
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
