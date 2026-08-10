# Milestone 10: Persistent User Model (Overview)

## What We Built
Milestone 10 introduces cross-session memory for Cognis adaptation preferences. Building on top of Milestone 9's local session-scoped adaptation, we designed and implemented a persistent storage mechanism using IndexedDB. This allows Cognis to carry forward user behavioral history across browser sessions, ensuring it does not have to relearn user preferences from scratch on every service worker restart or new session.

### Key Achievements

#### 1. Dedicated Adaptation Storage
* Created a separate IndexedDB object store (`adaptation_preferences`) via a version 4 database schema migration.
* Coupled the key structure to the user profile and gap type (`profileId::gapType`), ensuring future extensibility for multiple profiles while keeping the current schema clean.
* Isolated adaptation preferences from onboarding configuration (`user_profiles`), ensuring correct separation of lifecycle and deletion semantics.

#### 2. Raw Evidence Persistence
* Adheres to the core architectural guideline of persisting only raw, observable evidence (exposures, acceptances, and explicit rejections) along with a snapshot of the resolved preference state (`ACTIVE` or `SUPPRESSED`).
* Volatile policy parameters (such as `nextProbeThreshold`, `suppressedDetections`, and `activeProbeInterventionId`) are excluded from persistence to keep the data model robust against future policy changes.

#### 3. Dynamic Policy Reconstruction
* On session startup, the adaptation engine rehydrates its memory from the persistent evidence store.
* The `nextProbeThreshold` is dynamically reconstructed using the ratio of historical explicit rejections to exposures, ensuring that historical preference strength dictates the explore/exploit rate at load time.
* Suppressed states are gracefully restored immediately on startup to prevent unwanted interventions.

#### 4. Atomic and Idempotent Synchronizations
* Implemented transactional synchronization on session termination.
* Utilizes a single read-merge-write transaction to safely aggregate session evidence with historic counts.
* Employs session-based idempotency checks to prevent duplicate writes from concurrent sessions or duplicate lifecycle events.
