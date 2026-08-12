import { ReadModelRepository } from '../../storage/repositories/ReadModelRepository';
import { SessionReadModel } from '../../storage/projections/builders/SessionProjectionBuilder';
import { GapProfileReadModel } from '../../storage/projections/builders/GapProfileProjectionBuilder';
import { ProfileRepository } from '../../storage/repositories/ProfileRepository';
import { UserProfileRecord, GapLongitudinalState } from '../../core/types/profile.types';
import { GapType } from '../../core/types/gap.types';
import { EventBusContract, ErrorReporter } from '../../core/event-bus/types';
import { SessionEvents, EventType } from '../../core/event-bus/registry';
import { DomainEvent, SessionEndedPayload } from '../../core/event-bus/contracts';

/**
 * SessionProfileUpdater
 *
 * Implements the Cognis Week 4 longitudinal state machine for Gap tracking (3/7 mechanism).
 * Folds SessionReadModel facts into the UserProfileRecord at session settlement.
 *
 * Enforces transactional idempotency via foldedSessions.
 * Owns Top-7 canonical history and the sessionsSinceLastSeen counters.
 */
export class SessionProfileUpdater {
  constructor(
    private readonly profileRepo: ProfileRepository,
    private readonly readModelRepo: ReadModelRepository,
    private readonly eventBus: EventBusContract,
    private readonly errorReporter: ErrorReporter
  ) {}

  public start(): void {
    this.eventBus.subscribe(SessionEvents.ENDED, async (event: DomainEvent<any>) => {
      try {
        await this.handleSessionEnded(event);
      } catch (error) {
        this.errorReporter.report(error, {
          eventType: 'profile.update.failed',
          source: 'SessionProfileUpdater'
        });
      }
    });
  }

  private async handleSessionEnded(event: DomainEvent<any>): Promise<void> {
    const sessionId = event.sessionId;
    const endedAt = event.timestamp;

    // 1. Fetch Session Facts
    const sessionModel = await this.readModelRepo.get<SessionReadModel>(`session-v1_${sessionId}`);
    if (!sessionModel) {
      console.warn(`[SessionProfileUpdater] Session ${sessionId} ended but ReadModel not found. Cannot fold.`);
      return;
    }

    // 2. Fetch Gap Facts for this specific session
    const gapProfile = await this.readModelRepo.get<GapProfileReadModel>(`gap-profile-v1_${sessionId}`);

    // M(session) Definition (P1)
    const meaningful = sessionModel.hasTypingActivity === true;

    // 3. Atomically Update Profile
    await this.profileRepo.update('default-user', (model: UserProfileRecord | undefined): UserProfileRecord => {
      // Handle Missing Profile Defaults (Migration Contract)
      const current = model ?? {
        profileId: 'default-user',
        lastModified: Date.now(),
        onboarding: { answer1: '', answer2: '', answer3: '' },
        recentCountedSessions: [],
        foldedSessions: [],
        gapHistory: {} as Record<GapType, GapLongitudinalState>
      };

      // Safely apply Week 4 defaults if migrating from Week 3
      const foldedSessions = current.foldedSessions ?? [];
      const recentCountedSessions = current.recentCountedSessions ?? [];
      const gapHistory = current.gapHistory ?? ({} as Record<GapType, GapLongitudinalState>);

      // Transactional Idempotency: Skip if already folded
      if (foldedSessions.includes(sessionId)) {
        return current;
      }

      // Add to idempotency ledger (empty sessions go here too)
      const newFoldedSessions = [...foldedSessions, sessionId];

      let newRecentCountedSessions = [...recentCountedSessions];
      const newGapHistory = { ...gapHistory };

      if (meaningful) {
        // --- 1. Update Top-7 Audit Window ---
        newRecentCountedSessions.push({ sessionId, endedAt });

        // Canonicalization (sort by endedAt ASC, tie-breaker sessionId)
        newRecentCountedSessions.sort((a, b) => {
          if (a.endedAt === b.endedAt) return a.sessionId.localeCompare(b.sessionId);
          return a.endedAt - b.endedAt;
        });

        // Truncate to retain only the latest 7 meaningful sessions
        if (newRecentCountedSessions.length > 7) {
          newRecentCountedSessions = newRecentCountedSessions.slice(-7);
        }

        // --- 2. Update Longitudinal Math (3/7 State Machine) ---

        // We must process two sets of gaps:
        // a) Gaps explicitly detected in this session
        // b) Gaps that exist in gapHistory (to advance their miss counters)

        const detectedGapTypes = gapProfile ? (Object.keys(gapProfile.gaps) as GapType[]).filter(g => gapProfile.gaps[g].detectedCount > 0) : [];
        const historicGapTypes = Object.keys(newGapHistory) as GapType[];
        const allRelevantGaps = new Set([...detectedGapTypes, ...historicGapTypes]);

        for (const gapType of allRelevantGaps) {
          const isDetected = detectedGapTypes.includes(gapType);
          const historyState = newGapHistory[gapType];

          // Never-Seen Gap Initialization Contract
          if (!historyState) {
            if (isDetected) {
              // Initialize on first detection
              newGapHistory[gapType] = {
                gapType,
                lastSeen: { sessionId, endedAt },
                sessionsSinceLastSeen: 0,
                transferState: 'ACTIVE'
              };
            }
            // Meaningful + not detected for a never-seen gap => do nothing.
            continue;
          }

          // Existing Gap Processing
          if (isDetected) {
            // Reactivation / Reset
            newGapHistory[gapType] = {
              ...historyState,
              lastSeen: { sessionId, endedAt },
              sessionsSinceLastSeen: 0,
              transferState: 'ACTIVE'
            };
          } else {
            // Miss Counter Advance
            const newCounter = historyState.sessionsSinceLastSeen + 1;
            let newState: GapLongitudinalState['transferState'] = historyState.transferState ?? 'ACTIVE';

            if (newCounter < 3) {
              newState = 'ACTIVE';
            } else if (newCounter >= 3 && newCounter < 7) {
              newState = 'MAYBE_TRANSFERRED';
            } else if (newCounter >= 7) {
              newState = 'TRANSFERRED';
            }

            newGapHistory[gapType] = {
              ...historyState,
              sessionsSinceLastSeen: newCounter,
              transferState: newState
            };
          }
        }
      }

      return {
        ...current,
        lastModified: Date.now(),
        lastEventId: event.id,
        foldedSessions: newFoldedSessions,
        recentCountedSessions: newRecentCountedSessions,
        gapHistory: newGapHistory
      };
    });
  }
}
