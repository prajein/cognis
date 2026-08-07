# Milestone 3: Implementation Overview

## Architecture Realized
Milestone 3 successfully establishes the Submit Interception and Prompt Enrichment pipeline. 

As designed in the RFC, the `SubmitInterceptor` acts as an orchestrator sitting between the DOM and the `EnrichmentEngine` (accessed strictly through the `PromptEnricher` interface). This decoupled design isolates the platform-specific DOM hacking required to inject text from the pure business logic of augmenting the user's prompt.

## The Transient Text Constraint (ADR-019)
The implementation rigorously enforces ADR-019. The raw text read from the input box during submission is never placed onto the `EventBus`. It is passed directly to the `PromptEnricher.enrich()` method, consumed within that asynchronous context, and replaced in the DOM. Once the prompt is enriched, a `prompt.sent` event is dispatched containing only metadata (character count, hash, and a boolean `wasEnriched`), completely preserving user privacy at the event layer.

## The React / ProseMirror Race Condition
A significant architectural discovery was made during implementation regarding framework-compatible DOM writes. 

ChatGPT utilizes ProseMirror (a rich-text editor) embedded within React. Initially, we attempted to write the enriched text using standard DOM manipulation (`node.innerText = value`) followed immediately by a programmatic click of the submit button. This failed silently—ChatGPT submitted the *original* raw text.

**The Cause:**
1. Direct DOM manipulation bypasses ProseMirror's internal state.
2. Even when using a native mutation like `document.execCommand('insertText')` (which ProseMirror correctly intercepts), React queues the resulting state update asynchronously.
3. Clicking the submit button in the *exact same event loop tick* causes the button's `onClick` handler to execute before React has flushed the new text into its internal state.

**The Solution:**
```typescript
// 1. Force a native DOM mutation that ProseMirror respects
document.execCommand('insertText', false, enrichedText);

// 2. Yield the Javascript event loop to allow React to flush its state asynchronously
await new Promise(resolve => setTimeout(resolve, 50));

// 3. Trigger the submit securely
this.triggerSubmit();
```
This specific workaround is now an established pattern in the codebase for dealing with complex React-based rich text editors.

## The One-Submit Invariant
The strict `isIntercepting` lock proved highly effective. By capturing the `Enter` keydown early, calling `stopImmediatePropagation()`, and setting the lock, we safely suspend the standard UI flow. The `finally` block guarantees the lock is released even if enrichment fails entirely, gracefully falling back to the raw prompt without permanently "bricking" the user's input box.
