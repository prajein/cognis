# Milestone 3: Submit Interception & Prompt Enrichment — Implementation Plan

**Author:** Cognis Architecture Lead (`Naren`)  
**Status:** APPROVED  
**Type:** Implementation Plan / Architectural Design Document  
**Date:** 2026-08-05  
**Revision:** 3 (incorporating final review notes)

---

## 1. Executive Summary & Problem Statement

As of Milestone 2, Cognis can observe typing, detect cognitive pauses, classify knowledge gaps, and surface ghost text suggestions. However, when the user actually sends their prompt, Cognis does nothing. The raw, unaugmented text is dispatched directly to ChatGPT.

Milestone 3 closes this gap. It introduces:
1. **Submit interception** — capturing the user's submit action before it reaches ChatGPT.
2. **Prompt enrichment** — routing the raw text through the `EnrichmentEngine` within the latency budget.
3. **Seamless resume** — writing the enriched text back to the input in a framework-compatible way and completing the submission.

**Core Invariant (non-negotiable):**

> **One user submit action must result in exactly one ChatGPT request — no more, no fewer.** If enrichment succeeds, ChatGPT receives the enriched prompt. If enrichment times out (or fails), ChatGPT receives the original prompt. In both cases, the user observes no duplicate sends, no dropped sends, and no perceptible disruption.

This invariant is the highest-risk constraint in this milestone. Every design decision below must be evaluated against it.

---

## 2. Current State of the Codebase (What Already Exists)

| Component | Location | Current Status |
|-----------|----------|----------------|
| `EnrichmentEngine` | `src/engines/enrichment/EnrichmentEngine.ts` | ✅ Implemented — `enrich(rawText, sessionId)` → `Promise<string>`. 100ms timeout safety. Emits `prompt.enriched`. |
| `enrichment_layers.json` | `src/core/config/enrichment_layers.json` | ✅ 5 layers with priority sorting. Static templates for now. |
| `TypingObserver` | `src/platforms/observers/TypingObserver.ts` | ✅ Observes typing. Currently also detects submit via Enter/click and emits `prompt.sent`. Submit detection will be removed from here. |
| `ChatGPTAdapter` | `src/platforms/chatgpt/ChatGPTAdapter.ts` | ✅ Platform composition root. Does not yet hold a `PromptEnricher` reference. |
| `PromptEvents.SENT` | `src/core/event-bus/registry.ts` | ✅ Defined. `prompt.sent` contract already includes `wasEnriched: boolean`. |
| `SubmitInterceptor` | — | ❌ Does not exist. |
| `PromptEnricher` interface | — | ❌ Does not exist. Will be introduced this milestone. |

---

## 3. Architectural Principles & Constraints

### 3.1 `SubmitInterceptor` is an Orchestrator, Not a God Object

The `SubmitInterceptor` is the **only** component that knows a submit action has been intercepted. Its job is strictly:

```
Submit detected
       ↓
Obtain enriched text (via PromptEnricher)
       ↓
Replace text in the input (framework-compatible write)
       ↓
Resume submit (exactly once)
```

It must **not** accumulate responsibilities such as building enrichment context, deciding which layers apply, or managing EventBus state. Those belong in the `EnrichmentEngine`. The interceptor is a traffic cop — it stops the car, hands it off for servicing, and waves it through again.

### 3.2 The `PromptEnricher` Abstraction

The direct injection of `EnrichmentEngine` into `SubmitInterceptor` would violate the event-driven architecture philosophy established in Milestone 2. 

We will introduce a **narrow interface**:

```ts
interface PromptEnricher {
  enrich(rawText: string, sessionId: string): Promise<string>;
}
```

*Architecture Note: `PromptEnricher` is intentionally minimal for Milestone 3 and may evolve into a richer service contract as enrichment capabilities expand.* 
*Future Direction: The interface allows us to seamlessly swap `EnrichmentEngine` for a `RemoteEnricher`, `HardwareAssistedEnricher`, `LLMEnricher`, or `HybridPipeline` without touching the perception layer.*

`SubmitInterceptor` depends on `PromptEnricher`. It has no knowledge of `EnrichmentEngine`.

The **composition root** (`content-script.ts`) is the only place where the concrete `EnrichmentEngine` is injected as the `PromptEnricher`. 

### 3.3 Transient Text Rule (ADR-019)

The raw prompt text captured at submit time is transient input. It must:
- Be consumed immediately in the same async call chain.
- **Never** be published on the EventBus.
- **Never** be written to logs.
- Be cleared as soon as enrichment completes or times out.

### 3.4 Latency Budget & Exception Handling

The `EnrichmentEngine` has a built-in `latencyTimeoutMs: 100` timeout that gracefully falls back to the raw text. 
*Architecture Note: Any unexpected exception from `PromptEnricher` is treated identically to a timeout: the original prompt is submitted exactly once and the error is isolated from the user interaction.*

### 3.5 Framework-Compatible DOM Writes (Intent, Not Mechanism)

ChatGPT's prompt input is managed by a UI framework (React) using a rich-text editor (ProseMirror). The interceptor must update the input's value using a framework-compatible mechanism that preserves the framework's internal state sync before re-triggering submission.

*Architectural constraint discovered during implementation:* Modifying the raw DOM (e.g. `node.innerText`) bypasses ProseMirror's state completely. To successfully write text, we must:
1. Focus the node and select all existing text.
2. Fire a native browser mutation using `document.execCommand('insertText', false, enrichedText)`.
3. **Crucially**, wait for the Javascript event loop to yield (e.g. `await new Promise(r => setTimeout(r, 50))`) before triggering the native submit button. React state updates are batched asynchronously, and a synchronous click immediately after the `execCommand` will submit the *old* state in memory.

### 3.6 The One-Submit Invariant & Guard Logic

To ensure exactly one ChatGPT request per user submit:

- `SubmitInterceptor` maintains a private `isIntercepting: boolean` flag initialized to `false`.
- On any detected submit trigger, if `isIntercepting === true`, the handler immediately returns, allowing the re-triggered submit to pass through normally.
- If `isIntercepting === false`, the handler:
  1. Sets `isIntercepting = true`.
  2. Calls `preventDefault()` and `stopImmediatePropagation()`.
  3. Awaits enrichment.
  4. Writes enriched text.
  5. Re-triggers submit programmatically.
- `isIntercepting` is **always** reset to `false` in a `finally` block — not manually after the trigger. This ensures that even if enrichment throws unexpectedly, the flag is cleared and future submits are not permanently blocked.

---

## 4. Proposed Architecture

```
User presses Enter / clicks Send
         │
         ▼
SubmitInterceptor (capture: true)
         │ isIntercepting === true? → return (allow through)
         │ isIntercepting = false → proceed
         │ e.preventDefault(), e.stopImmediatePropagation()
         │
         ▼
PromptEnricher.enrich(rawText, sessionId)   ← ADR-019: text never leaves this chain
         │ (concrete: EnrichmentEngine, max 100ms)
         │ publishes: prompt.enriched (no raw text)
         │ returns: enrichedText (or rawText on timeout)
         │
         ▼
SubmitInterceptor
         │ writes enrichedText via framework-compatible input update
         │ re-triggers submit programmatically
         │ (isIntercepting now true → guard allows it through)
         │
         ▼ [finally block]
isIntercepting = false
         │
         ▼
ChatGPT processes exactly one enriched prompt
```

---

## 5. `prompt.sent` Ownership

`SubmitInterceptor` will emit `prompt.sent` after the enrichment is done and the programmatic re-trigger has been dispatched. This is pragmatically the best signal we have for "the prompt has been submitted" given the DOM-only observation model.

*Future architecture note: A more semantically correct event model would introduce `prompt.submitRequested` (fired by the interceptor) and defer `prompt.sent` to a DOM observer that detects ChatGPT's actual state transition. This is tracked as architectural debt to be refined.*

---

## 6. Files to Create or Modify

### 6.1 [NEW] `src/platforms/interfaces/PromptEnricher.ts`
Interface decoupling interception from concrete enrichment implementation.

### 6.2 [NEW] `src/platforms/observers/SubmitInterceptor.ts`
- Detect submit-triggering DOM events (`keydown[Enter]` and `click[send-button]`) via `capture: true`.
- Apply the one-submit guard (`isIntercepting`).
- Read the raw text from the input node.
- Delegate to `PromptEnricher.enrich()`.
- Write the enriched result back.
- Re-trigger the submit.
- Emit `prompt.sent` with `wasEnriched`.
- Reset guard in `finally` block.

### 6.3 [MODIFY] `src/platforms/chatgpt/ChatGPTAdapter.ts`
Instantiate `SubmitInterceptor` and accept `PromptEnricher` dependency.

### 6.4 [MODIFY] `src/platforms/manager/PlatformManager.ts`
Thread `PromptEnricher` through to adapter creation.

### 6.5 [MODIFY] `src/content/content-script.ts`
Instantiate `EnrichmentEngine` and inject as `PromptEnricher`.

### 6.6 [MODIFY] `src/platforms/observers/TypingObserver.ts`
Remove all submit detection logic (move ownership to interceptor).

---

## 7. Out of Scope (Explicitly)

- **IME Composition**: Input composed via IME may not fire standard `keydown` events. 
- **Mobile / Touch events**: Submit via virtual keyboards or touch gestures is not tested or targeted.
- **Accessibility shortcuts**: Keyboard shortcuts used by assistive technologies.
- **Auto-repeat / held Enter**: Handled by the `isIntercepting` guard naturally, but not explicitly tested.
- **Disabled send button**: Interception should not trigger if disabled.
- **Dynamic enrichment layers**: Deferred to a later milestone.
- **User opt-out of enrichment**: An on/off toggle is a tracked follow-up item.
- **Session End During Enrichment**: If the session ends while enrichment is in progress, the interceptor should abandon enrichment and allow the original submission (or abort entirely). This behavior is outside the scope of M3 and should be validated during implementation.

---

## 8. Timeout & Fallback Behavior

- Timeout threshold: `latencyTimeoutMs` from `enrichment_layers.json`.
- On timeout (or unexpected exception): `enrich()` resolves with the original `rawText`.
- `SubmitInterceptor` treats the resolved value identically regardless of whether it is enriched or original — it writes it back and submits once.
- `prompt.sent` is emitted with `wasEnriched: false`.
- No error is surfaced to the user.

---

## 9. Verification Strategy

### 9.1 Build Verification
`npm run build` must complete with no TypeScript errors.

### 9.2 Primary Success Criterion (User-Observable)

> **A user types `"Write a function"` and presses Enter once. ChatGPT's response clearly reflects enrichment (e.g. detailed step-by-step reasoning per the static templates). No duplicate submits occur.**

### 9.3 End-to-End Chrome Verification Steps

1. Load the rebuilt extension.
2. Open `chatgpt.com`, open DevTools, open Cognis Sidepanel.
3. Select a task and click **Start Session**.
4. Type a short, bare prompt: `"Write a function"`.
5. Press **Enter**.
6. **Observe ChatGPT's response** — it should reflect the enrichment layers (e.g., markdown structure, explicit reasoning guidance, constraint adherence).
7. **Supporting diagnostic:** DevTools console confirms `[EnrichmentEngine]` ran and `prompt.enriched` was published to the EventBus.

### 9.4 Timeout/Exception Fallback Verification
Set `latencyTimeoutMs: 1` in `enrichment_layers.json` and rebuild. Verify ChatGPT receives raw prompt, `wasEnriched: false`, and exactly one submit.
