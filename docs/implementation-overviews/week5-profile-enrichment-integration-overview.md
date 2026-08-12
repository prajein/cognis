# Week 5: Profile Enrichment Integration Overview

## Overview
Week 5 establishes the definitive data pipeline connecting the user's persistent longitudinal profile with the real-time Enrichment Engine in Surface A. This integration ensures that the user's onboarding answers (Identity Profile) and their current session's cognitive gaps (Session Gap Profile) causally affect the prompts being sent to AI platforms, bridging the gap between passive observation and active contextual adaptation.

## Architecture

The integration relies on two primary data flows that converge during the Content Script bootstrap sequence.

### Identity Profile Integration
```
UserProfileRecord.onboarding
    ↓ (IndexedDB)
ProfileRepository
    ↓
IdentityQueryHandler
    ↓ (QUERY_IDENTITY_PROFILE IPC)
Content Script
    ↓ (EnrichmentEngineOptions)
EnrichmentEngine
```

### Session Gap Profile Integration
```
GapProfileReadModel
    ↓ (IndexedDB)
ReadModelRepository
    ↓
GapProfileQueryHandler
    ↓ (QUERY_SESSION_GAPS IPC)
Content Script
    ↓ (EnrichmentEngineOptions.initialActiveGaps)
EnrichmentEngine.activeGaps
```

### Live Event Continuation
Once the engine is hydrated with persisted state, the existing real-time pipeline continues without modification:
```
Live cognitive.gap.detected
    ↓ (EventBus)
EnrichmentEngine.activeGaps
```

## Causal Consumption

- **Identity Profile:** The `EnrichmentEngine` receives the onboarding answers upon instantiation. It programmatically injects these answers into the static `identity` layer template defined in `enrichment_layers.json`. Different onboarding profiles definitively produce different enriched outputs for the same base prompt.
- **Persisted Gap Profile:** The engine is instantiated with a hydrated `initialActiveGaps` array containing gaps previously saved in the current session. This triggers conditional gap-resolution enrichment layers automatically on the next prompt, without waiting for a new live `cognitive.gap.detected` event.

## Session Recovery

The Content Script implements a deterministic asynchronous bootstrap sequence:
1. It queries `QUERY_ACTIVE_SESSION` via IPC.
2. If an active session is found, it queries `QUERY_IDENTITY_PROFILE` and `QUERY_SESSION_GAPS` in parallel.
3. Only after these context requests resolve does the `EnrichmentEngine` instantiate.
4. Finally, the `PlatformManager` attaches its DOM observers and explicitly resumes observation of the recovered session.

This sequence guarantees that mid-session tab reloads safely recover both the correct Identity and Gap state before any enrichment can occur.

## Testing

Extensive integration tests were added and successfully executed to verify these behaviors:
- **`IdentityQueryHandler.selftest.ts`**: Verifies IPC responses include full onboarding payloads and handle missing profiles gracefully.
- **`GapProfileQueryHandler.selftest.ts`**: Verifies retrieval of correct session-scoped gap read models.
- **`EnrichmentEngine.selftest.ts`**: Verifies Identity Causal Consumption (Profile A != Profile B output), Persisted Gap Causal Consumption (gapResolution appears without live events), and Session Isolation (Session A state does not leak to Session B).

## Limitations

- **Audit 4A limitation:** We have definitively verified that the causal profile data mutates the platform's editor DOM (via `SubmitInterceptor.setInputValue`). However, synchronization with underlying framework state (React) and the exact outgoing network payload remain unverified and out of scope for Week 5.
- **Longitudinal Gaps:** The `TRANSFERRED` suppression of enrichment layers, which relies on multi-session gap history, remains intentionally out of scope. Week 5 focuses purely on single-session Gap Profile hydration.
