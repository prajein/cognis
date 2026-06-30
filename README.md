# Cognis

Cognis is the software execution layer of Hyle's broader Arc vision—a future hardware and software cognitive operating system. Currently, while the physical Arc hardware remains in research and development, Cognis serves as the production-ready software implementation delivered as a browser extension.

## Product Objectives

Cognis is designed to reduce cognitive offloading while maintaining the utility of artificial intelligence systems. It mediates human-AI interactions to preserve and enrich the cognitive workflow through a closed-loop behavioral model:

1. Observe Human Behavior
2. Model Cognitive State
3. Guide Behavior via Non-Intrusive Interventions
4. Measure Behavioral Change
5. Refine the Cognitive Model

The product is built on two primary surfaces:
*   **Surface A (AI Co-Pilot):** Integrates inside browser-based AI interfaces (e.g., ChatGPT, Claude) to detect contextual gaps, model user cognitive state, inject contextual ghost-text interventions, and enrich prompts before submission.
*   **Surface B (Skill Visualizer):** A dedicated tracking surface that logs tasks, visualizes skill development, and monitors task automaticity using research-derived cognitive models.

## Architectural Principles

*   **Event-Driven Architecture:** All communications flow exclusively through a central `EventBus`. Modules are fully decoupled; they never reference or invoke each other directly.
*   **Event Sourcing:** All system actions are modeled as immutable domain events. State projections are built reactively by consuming these events.
*   **Hardware Readiness:** Downstream consumers interact with abstract contracts. The underlying state and hardware providers (e.g., typing detection vs. future BLE hardware signals) are interchangeable.
*   **Local First:** Behavioral tracking and processing are kept entirely client-side. No raw user prompt text or clipboard history is persisted or transmitted to cloud platforms.
*   **Deterministic Latency:** Critical path operations are optimized for low latency, targeting under 100ms for prompt enrichment and under 200ms for ghost-text generation.

## Repository Structure

The codebase is organized into clean domain boundaries as defined in the system architecture:

```text
src/
├── background/       # Service worker orchestrating application lifecycle and event routing
├── content/          # Content scripts interacting with host AI platforms (ChatGPT, Claude)
├── sidepanel/        # Surface B UI for cognitive modeling and visualization
├── core/             # Central core contract definitions and infrastructural Event Bus
│   ├── event-bus/    # Event Bus implementation, Extension Event Bridge, Event Contracts, and Registry
│   ├── contracts/    # Core platform adapter and engine interface contracts
│   ├── config/       # Core static configuration and schemas
│   ├── constants/    # Stable event registry names and re-exports
│   ├── error/        # Error reporting abstraction and implementations
│   └── types/        # TypeScript types representing event payloads and schemas
├── platforms/        # Adapters abstracting host AI platforms
│   ├── manager/      # Selection and lifecycle execution of active platform adapters
│   ├── chatgpt/      # ChatGPT DOM integration and response monitoring
│   ├── claude/       # Claude DOM integration and response monitoring
│   ├── gemini/       # Gemini DOM integration and response monitoring
│   └── interfaces/   # Re-exported platform contracts
├── engines/          # Pure, platform-agnostic business logic processors
│   ├── state/        # Resolves cognitive states from typing and pauses
│   ├── gap/          # Detects formulation gaps in current input
│   ├── ghosttext/    # Orchestrates ghost text proposals
│   ├── enrichment/   # Contextual prompt enrichment compilation
│   ├── response/     # Analyzes AI response stream chunks (transient per ADR-019)
│   └── insights/     # Measures task automaticity and patterns (background worker)
├── storage/          # Local persistence layer
│   ├── types.ts      # Storage layer contract interfaces
│   ├── migrations/   # Database schema migrations (v1, v2, v3 schemas)
│   ├── indexeddb/    # Database connection manager (cognis_v3) and event subscriber
│   ├── repositories/ # Repository implementations (EventRepository, ReadModelRepository)
│   └── projections/  # Projection Manager and Read-Model Builders
└── mock/             # Sandbox testing environment
    └── harness/      # Simulated platform runtime, streams, and inputs
```
