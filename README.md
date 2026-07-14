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

The codebase is organized into clean domain boundaries as defined by our Event-Driven Layered Architecture. The structure below reflects the complete implementation, including the modular Runtime Perception Layer and the feature-sliced Surface B React application:

```text
cognis/
├── src/
│   ├── background/       # Service worker orchestrating application lifecycle and event routing
│   ├── content/          # Content scripts injecting observers into host AI platforms
│   ├── core/             # Central core domain logic and infrastructural boundaries
│   │   ├── config/       # Core static configuration and JSON schemas (e.g., state_engine_rules)
│   │   ├── constants/    # Stable event registry names and system-wide re-exports
│   │   ├── contracts/    # Core platform adapter and engine interface contracts
│   │   ├── error/        # Error reporting abstractions and domain-specific implementations
│   │   ├── event-bus/    # Event Bus implementation, Extension Event Bridge, and Registry
│   │   └── types/        # TypeScript types representing event payloads and domain schemas
│   ├── engines/          # Pure, platform-agnostic business logic processors
│   │   ├── diagnostics/  # Runtime tracing, event stream validation, and system invariants
│   │   ├── enrichment/   # Contextual prompt enrichment compilation logic
│   │   ├── gap/          # Detects formulation gaps in current input
│   │   │   └── pipeline/ # Multi-stage pipeline logic for isolating formulation gaps
│   │   ├── ghosttext/    # Orchestrates and projects ghost text proposals
│   │   │   └── pipeline/ # Transformation pipeline rendering ghost text overlays
│   │   ├── insights/     # Measures task automaticity and patterns via evaluation strategies
│   │   │   ├── pipeline/ # Analytical pipelines feeding automaticity scores
│   │   │   └── strategies/# Specific algorithms for cognitive and behavioral evaluation
│   │   ├── response/     # Analyzes AI response stream chunks
│   │   │   ├── analyzers/# Specialized chunk analyzers (Quality, Structure, Completeness)
│   │   │   └── pipeline/ # Sequential processing of reconstructed stream responses
│   │   └── state/        # Resolves cognitive states from typing cadence and interaction pauses
│   ├── mock/             # Sandbox testing environments and simulated behaviors
│   │   └── harness/      # Simulated platform runtime, streams, and raw inputs
│   ├── platforms/        # Runtime Perception Layer (RPL) abstracting host AI platforms
│   │   ├── chatgpt/      # ChatGPT-specific adapter composition and overrides
│   │   ├── claude/       # Claude-specific adapter composition and overrides
│   │   ├── gemini/       # Gemini-specific adapter composition and overrides
│   │   ├── interfaces/   # Re-exported platform contracts for dependency inversion
│   │   ├── manager/      # Selection, instantiation, and lifecycle execution of active platforms
│   │   ├── observers/    # DOM mutation and interaction listeners (e.g., TypingObserver)
│   │   ├── selectors/    # Platform-specific DOM query selectors registry
│   │   └── translators/  # Maps raw DOM events into standardized core domain events
│   ├── shared/           # Cross-domain utilities and shared system constants
│   ├── sidepanel/        # Surface B (Skill Visualizer) Feature-Sliced React Application
│   │   ├── components/   # Shared generic UI components across the application
│   │   │   ├── Badge/    # UI Badge component logic and styling
│   │   │   ├── Button/   # UI Button component logic and styling
│   │   │   ├── Card/     # UI Card component logic and styling
│   │   │   ├── EmptyState/# Fallback UI for missing data states
│   │   │   ├── ProgressRing/# SVG progress ring components
│   │   │   └── Skeleton/ # Loading state skeleton components
│   │   ├── features/     # Feature-sliced domain modules 
│   │   │   ├── brain-map/# Cognitive load visualization module
│   │   │   │   ├── assets/       # Master SVG templates and raw assets
│   │   │   │   │   └── generated/# 47 static SVG snapshots compiled by the generator
│   │   │   │   ├── components/   # React components specific to brain-map rendering
│   │   │   │   ├── hooks/        # Custom React hooks for brain-map state and interactions
│   │   │   │   └── utils/        # Build-time SVG generator and validation engine
│   │   │   ├── insights/ # Module displaying automaticity scores and evaluations
│   │   │   │   ├── components/   # UI components specific to insights
│   │   │   │   └── hooks/        # React hooks fetching insight ReadModels
│   │   │   ├── progress/ # Module displaying temporal skill development
│   │   │   │   ├── components/   # UI components specific to progress tracking
│   │   │   │   └── hooks/        # React hooks fetching progress ReadModels
│   │   │   ├── session/  # Current cognitive session state module
│   │   │   │   ├── components/   # UI components specific to active sessions
│   │   │   │   └── hooks/        # React hooks polling session state
│   │   │   └── surface-b/# Root coordination and layout for the Surface B interface
│   │   │       ├── components/   # Top-level Surface B orchestrators
│   │   │       └── hooks/        # Global hooks for Surface B integrations
│   │   ├── hooks/        # Shared global application hooks
│   │   ├── layout/       # Application shell, headers, and structural layout components
│   │   ├── navigation/   # Routing definitions and sidebar navigation components
│   │   ├── providers/    # Global context providers (Theme, Settings, Cognis Context)
│   │   ├── shared/       # Utilities strictly scoped to the sidepanel app
│   │   │   ├── constants/# Sidepanel specific constants
│   │   │   ├── formatters/# Data parsing and text formatting tools
│   │   │   ├── types/    # Interface definitions for React props and local state
│   │   │   └── utils/    # Helper functions and small generic utilities
│   │   ├── state/        # Centralized state selectors mapping to IndexedDB ReadModels
│   │   └── styles/       # Global CSS styles and theme tokens
│   ├── storage/          # Local persistence layer
│   │   ├── indexeddb/    # Database connection manager (cognis_v3) and event subscriber
│   │   ├── migrations/   # Versioned IndexedDB schema migrations (v1, v2, v3 schemas)
│   │   ├── projections/  # Read-model projection logic converting events to state
│   │   │   └── builders/ # Specialized data builders decoupled from core projectors
│   │   └── repositories/ # Repository implementations (Event, Profile, ReadModel, Session)
│   └── tests/            # Automated selftests and test harnesses
│       ├── engines/      # Tests verifying platform-agnostic business logic processors
│       │   ├── insights/ # Testing for insight strategies and automaticity scoring
│       │   │   └── pipeline/# Tests validating the reasoning pipeline behavior
│       │   └── state/    # Tests verifying cognitive state resolution transitions
│       └── platforms/    # Tests validating platform adapter components (observers, translators)
├── docs/                 # Documentation directory
│   ├── adrs/             # Architectural Decision Records capturing system design choices
│   ├── implementation-overviews/ # High-level summaries of completed architectural phases
│   └── implementation-plans/     # Technical step-by-step RFCs and execution plans
└── scripts/              # Build-time utility scripts
```
