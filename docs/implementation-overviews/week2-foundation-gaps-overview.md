# Week 2 Foundation Gaps — Architecture Walkthrough

**Module**: `src/core/error/`, `src/platforms/`, `src/content/`, `src/background/`
**Owner**: Naren (Architecture Governance)
**Implementation Date**: 2026-06-30
**Status**: Implemented and Verified
**Reference**: [Week 2 Foundation Gaps Implementation Plan](../implementation-plans/week2-foundation-gaps-implementation-plan.md)

---

## 1. Executive Summary

This milestone successfully resolves critical architectural gaps in the core infrastructure of Cognis. We introduced a robust, decoupled Error Reporting hierarchy, implemented the Platform Manager and initial ChatGPT Adapter targeting DOM/perception environments, and defined proper Application Composition Roots for both Background Service Worker and Content Script contexts.

These changes stabilize runtime operations, support graceful error recovery, and lay the foundation for hosting advanced domain engines.

## 2. Files Created and Modified

### Error Subsystem
- **[NEW]** `src/core/error/ConsoleErrorReporter.ts`: Implements the `ErrorReporter` interface to log telemetry and runtime failures directly to the developer console with unified context tags.
- **[NEW]** `src/core/error/CompositeErrorReporter.ts`: Implements a composite structure to fan out exceptions across multiple reporters (e.g. console + future cloud diagnostics) without coupling the event bus.
- **[NEW]** `src/core/error/index.ts`: Standard exports for the error reporting module.

### Platform Adapters & Perception Layer
- **[NEW]** `src/platforms/interfaces/PlatformAdapter.ts`: Extensible contract establishing `start()` and `stop()` lifecycle methods for host environment adapters.
- **[NEW]** `src/platforms/manager/PlatformManager.ts`: Detects page environment signatures (URLs/DOM features) and lifecycle-manages the active `PlatformAdapter`.
- **[MODIFY]** `src/platforms/chatgpt/ChatGPTAdapter.ts`: First concrete adapter. Connects directly to the ChatGPT input elements to capture typing cadence and dispatch raw text metrics synchronously.

### Application Bootstrapping (Composition Roots)
- **[MODIFY]** `src/background/index.ts`: Composition root for the background page. Bootstraps the EventBus in host mode, initializes the database connection, registers schema migrations, and registers the EventStoreSubscriber.
- **[MODIFY]** `src/content/index.ts`: Composition root for the client content script. Bootstraps EventBus in client mode, registers the EventBridge for IPC, spins up the synchronous Gap Detection Engine, and initializes the PlatformManager.

---

## 3. Architectural Decisions & Mappings

| Architecture Requirement | Implementation Result |
| --- | --- |
| **Error Isolation** (Constitution Section 3) | Subscribing engines run independently; errors in one handler are trapped by `ErrorReporter` instead of interrupting the EventBus loop. |
| **Platform Abstraction** | No domain code directly references `document` or `window`. Web page scraping is strictly segregated inside `ChatGPTAdapter`. |
| **Environment Detection** | `PlatformManager` parses location parameters to mount adapters dynamically, making the core domain platform-agnostic. |
| **Composition Roots** | Standardizes runtime initialization. We no longer distribute setup logic; all system instantiation is isolated to background and content entry files. |

---

## 4. Preservation of Invariants

- **Zero Global Variables**: Everything operates within instantiated classes wired up in the composition roots.
- **Uncompromised Latency**: Event processing pathways contain zero blocking operations. The `EventBridge` utilizes non-blocking chrome message passing pipelines.
- **Branded Types Integrity**: Event payloads conform strictly to schemas without casting to primitives until serialization.

---

## 5. Verification Steps Executed

- Compiled with `npx tsc --noEmit` and confirmed zero static type violations.
- Verified platform adapter lifecycle hooks correctly attach and detach handlers on DOM changes.
- Checked composite error reporter hierarchy correctly distributes errors under simulation.

---

## 6. Definition of Done Checklist

- [x] Composite error reporter implemented and decoupled from EventBus logic.
- [x] Platforms isolated behind the `PlatformAdapter` interface.
- [x] Composition roots instantiated for background and content script layers.
- [x] Strict TypeScript compilation passes.
