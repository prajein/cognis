# Week 3 Onboarding and Identity Profile Overview

**Reference**: [Week 3 Onboarding and Identity Profile Implementation Plan](../implementation-plans/week3-onboarding-implementation-plan.md)

## Objective
Implement the foundational onboarding flow, Identity Profile persistence, and bridge the Sidepanel UI to the Background worker for system-level configuration data.

## FINALIZED TECHNICAL CONTRACT

### 1. Identity Events Namespace
- Created the `IdentityEvents` namespace in `src/core/event-bus/registry.ts`.
- Defined `identity.onboarding.completed` to record onboarding data.
- Allowed the `IdentityEvents` namespace through the `ExtensionEventBridge` allowlists for both the Sidepanel and Background scopes.

### 2. Identity Service Facade
- Created `IdentityService` within the `SidepanelContainer` (`src/sidepanel/runtime/container.ts`).
- Encapsulated the `createDomainEvent` logic so the UI does not directly manipulate EventBus envelopes.

### 3. Profile Repository & Optimistic Concurrency
- Implemented `ProfileRepository` (`src/storage/repositories/ProfileRepository.ts`) mapping to the `user_profiles` IndexedDB object store.
- Reused the `update()` pattern from `ReadModelRepository` to ensure atomic read-modify-write operations, preventing lost updates in race conditions.
- Defined `UserProfileRecord` to represent the mutable profile data.

### 4. Background Identity Profile Writer
- Created `IdentityProfileWriter` (`src/engines/identity/IdentityProfileWriter.ts`) as a background consumer that listens to `identity.onboarding.completed`.
- Wired into `src/background/index.ts` (host process).
- Applies distinct concurrency protections:
  - Exact duplicate protection via `event.id`.
  - Stale-event protection via `event.timestamp` (safely ignoring older out-of-order events).
  - Atomic read-modify-write via `ProfileRepository.update()`.
  - Equal-timestamp distinct events are accepted; because their timestamps are identical, the resulting profile reflects whichever distinct event is processed last.
  - Intentional repeated onboarding remains an unresolved product decision (see below).

### 5. Profile Schema
The final profile record schema is:
```typescript
{
  profileId: string;
  lastModified: number;
  lastEventId?: string;
  onboarding: OnboardingCompletedPayload;
}
```
- `profileId` is the IndexedDB record key.
- `'default-user'` is a local single-user implementation convention, not a constitutional user identity.
- `lastModified` records the timestamp of the event that last modified the profile.
- `lastEventId` provides exact duplicate protection.
- `onboarding` contains the opaque onboarding payload.
- The profile schema does not define final product semantics for the onboarding fields.

### 6. Onboarding UI Flow
- Created the initial `OnboardingFlow` component (`src/sidepanel/features/onboarding/OnboardingFlow.tsx`) matching the 3-question prompt sequence.
- Wired directly to `useSidepanelRuntime().identityService.completeOnboarding()`.

## TEMPORARY PRODUCT CONTRACT

The Week 3 onboarding UI currently uses:

Payload keys:
- `answer1`
- `answer2`
- `answer3`

UI labels:
- Answer 1
- Answer 2
- Answer 3

These names are implementation placeholders only.
They are NOT canonical Cognis domain vocabulary.
They exist because the repository and product documentation do not currently define the final onboarding prompt wording or semantic field names.
The placeholder contract is intentionally isolated to the onboarding UI and `OnboardingCompletedPayload`.

**Required Validation:**
The current implementation applies HTML5 `required` validation to all three temporary inputs as a minimal Week 3 UI safeguard. This is an implementation default, not a finalized product requirement. Requiredness remains subject to product specification.

## DEFERRED PRODUCT DECISIONS

The following are product decisions, not unresolved infrastructure defects:

1. Final wording of onboarding prompt 1.
2. Final wording of onboarding prompt 2.
3. Final wording of onboarding prompt 3.
4. Canonical semantic field name for prompt 1.
5. Canonical semantic field name for prompt 2.
6. Canonical semantic field name for prompt 3.
7. Required versus optional status of each prompt.
8. Empty-answer behavior.
9. Whitespace normalization.
10. Minimum answer length.
11. Maximum answer length.
12. Whether answers are stored verbatim.
13. Whether answers are transformed into derived profile attributes.
14. Intentional repeated-onboarding behavior.
15. Re-onboarding overwrite, merge, or rejection policy.

## Verification Status
- TypeScript compilation checks: **PASSED**
- Mock Runtime wiring: **PASSED**
- Live Runtime wiring: **PASSED**
- Profile Repository Implementation: **PASSED**
