# Milestone 6: Live Integration Proof & Failure-Driven Hardening (Implementation Plan)

## Goal
Prove the existing vertical slice of the architecture by executing a complete, live session in the ChatGPT DOM environment. Ensure that:
- Events flow correctly from the Sidepanel (authoritative session control) → Background → Content Script.
- Perception observers capture user actions (typing, pauses, submits) and emit domain events (`prompt.typed`, `pause.detected`).
- The `ExtensionEventBridge` successfully routes these events to the background without duplication or raw-text leakage.
- Engines (`GapDetectionEngine`, `SubmitInterceptor`) process the events and emit downstream results (`gap.detected`, `ghosttext.generated`, `prompt.enriched`).
- ChatGPT's response is correctly observed, chunked, and emitted as `response.started`, `response.chunk`, and `response.completed`.

## Approach
Rather than building new architectural abstractions, this milestone focuses on observing the existing decoupled layers (Perception, IPC, and Engines) in a live environment, capturing logs, identifying integration failures, and hardening the smallest responsible components.

1. **Instrumentation**: Add temporary metadata logging to the `ExtensionEventBridge` to trace IPC traffic for M6 without logging raw prompt/response text.
2. **Live Execution**: Run the extension in Chrome and interact with the live ChatGPT DOM.
3. **Failure Classification**: If something fails, classify the failure (Perception, IPC, Lifecycle, Engine, Projection, UI, or DOM incompatibility) before redesigning. Fix the smallest responsible component.
4. **Verification**: Rerun the entire protocol to confirm the vertical slice is fully functional.
