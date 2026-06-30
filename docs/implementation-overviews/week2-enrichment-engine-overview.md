# Week 2 Enrichment Engine — Architecture Walkthrough

**Module**: `src/engines/enrichment/`
**Owner**: Naren (Architecture Governance)
**Implementation Date**: 2026-06-30
**Status**: Implemented and Verified
**Reference**: [Week 2 Enrichment Engine Implementation Plan](../implementation-plans/week2-enrichment-engine-implementation-plan.md)

---

## 1. Executive Summary

The Enrichment Engine has been successfully designed, implemented, and integrated into Cognis. It runs as a pure in-memory domain service responsible for parsing context-aware templates, resolving precedence conflicts dynamically, and packaging the user's prompt inside a formatted AI-ready context wrapper. 

The implementation features a strict `<100ms` latency safeguard fallback and non-intrusive DOM interception to preserve the "Ghost Text" visual interface paradigm.

## 2. Files Created and Modified

### Engine Logic & Configuration
- **[NEW]** `src/core/config/enrichment_layers.schema.json`: Strict JSON schema to validate formatting, priority boundaries, and templates.
- **[NEW]** `src/core/config/enrichment_layers.json`: Static reference data declaring the 6 layers (Identity, Task Frame, Gap Resolution, Constraints, Output Structure, State) alongside precedence values.
- **[MODIFY]** `src/engines/enrichment/EnrichmentEngine.ts`: Overwrote the placeholder. Dynamically builds the wrapping pipeline by sorting active layers based on priority, processes prompt modification within the latency budget, and dispatches event metadata to the EventBus.

### Platforms & Bootstrap
- **[MODIFY]** `src/platforms/chatgpt/ChatGPTAdapter.ts`: Modified keydown event handling to capture the submission, block standard network delivery, inject the wrapped prompt in-flight, execute submission, and instantly restore the visible UI text.
- **[MODIFY]** `src/platforms/manager/PlatformManager.ts`: Wired `EnrichmentEngine` dependency mapping into adapter creation.
- **[MODIFY]** `src/content/index.ts`: Composition root now initializes and starts `EnrichmentEngine` within the content script loop.

---

## 3. Architectural Decisions & Mappings

| Architecture Requirement | Implementation Result |
| --- | --- |
| **"Context Wrapping, not Prompt Rewriting"** | The user's original visible text is never altered in the UI. The wrapped prompt is injected transiently during the network submit event. |
| **Latency Safeguard** (Constitution Section 2) | An async timer falls back to the user's raw prompt if the engine fails or exceeds the `<100ms` target latency budget. |
| **Zero Raw Prompt Storage** (Constitution Section 2) | The `prompt.enriched` event maps strictly to anonymous metadata hashes and list of applied layers. The raw prompt content is never broadcast or persisted. |
| **Layer Ordering (CQRS/Precedence)** | Layer arrays are sorted descending by priority. The Constraints layer is set to 90+, ensuring safety guidelines always evaluate last and overwrite preceding rules. |

---

## 4. Preservation of Invariants

- **Platform Independence**: `EnrichmentEngine` contains no references to browser tabs, network payloads, or specific DOM nodes. It remains a pure domain service.
- **IPC Boundaries**: The EventStore and background scripts never receive the wrapped prompt text. Only statistical metadata transitions via the `ExtensionEventBridge`.

---

## 5. Verification Steps Executed

- Passed static type checks via `npx tsc --noEmit`.
- Validated that the `ChatGPTAdapter` synthetic event flow triggers and immediately restores the visual prompt value without infinite loop dispatching.
- Tested the timeout fallback mechanism to guarantee immediate recovery when compiling simulation layers.

---

## 6. Definition of Done Checklist

- [x] Schema-validated `enrichment_layers.json` defined and parsed.
- [x] Precedence sorting algorithm sorts layers based on priority.
- [x] Latency budget is strictly enforced with a fallback path.
- [x] Submit handler intercepts, swaps, submits, and restores visual fields seamlessly.
- [x] Strict TypeScript compilation passes.
