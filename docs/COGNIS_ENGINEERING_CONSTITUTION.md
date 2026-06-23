# COGNIS ENGINEERING CONSTITUTION v1.0

## Purpose

This document is the highest-priority engineering reference for all Cognis development.

All architecture RFCs, sprint plans, engineering contracts, repository structures, and implementation documents must be interpreted through this document.

If generated code conflicts with this constitution, the constitution wins.

The goal is not merely to build features.

The goal is to build a hardware-ready cognitive operating system that can evolve for years without architectural rewrites.

---

# SECTION 1 — WHAT COGNIS IS

Cognis is an event-driven cognitive operating system delivered as a browser extension.

It consists of two product surfaces sharing one backend.

Surface A:
AI Co-pilot

Surface B:
Visualizer & Skill Progress

Future:
Arc Hardware Layer

All three systems must operate on the same architectural contracts.

The browser extension is not the product.

The architecture is the product.

The extension is merely the first runtime.

---

# SECTION 2 — CORE ARCHITECTURAL PHILOSOPHY

The architecture must satisfy five principles.

## Event Driven

Modules communicate only through Domain Events.

Never through direct module invocation.

Allowed:

Perception
→ Event Bus
→ State Engine

Forbidden:

Perception
→ State Engine

No exceptions.

---

## Event Sourced

Every meaningful action becomes an immutable event.

Events are append-only.

Events are never updated.

Events are never deleted.

Derived state must be rebuilt from events.

Storage exists to preserve facts.

Read models exist to provide views.

---

## Local First

Behavioral data remains local.

No cloud dependency in critical paths.

No remote state required for runtime decisions.

No raw prompt storage.

Prompt hashes only.

---

## Hardware Agnostic

All software-generated signals must expose the exact contracts Arc hardware will eventually expose.

Current:

TypingStateProvider

Future:

ArcBLEStateProvider

Both must emit:

state.changed

with identical payload shape.

Hardware replaces providers.

Hardware never changes consumers.

---

## Deterministic Runtime

Latency budgets are contracts.

Ghost Text:
< 200 ms

Prompt Enrichment:
< 100 ms

Event Dispatch:
< 5 ms

Anything exceeding budget is architecturally incorrect regardless of functionality.

---

# SECTION 3 — NON-NEGOTIABLE ENGINEERING RULES

No module may call another module directly.

No business logic inside adapters.

No business logic inside storage.

No business logic inside EventBus.

No DOM references inside engines.

No platform references inside engines.

No browser APIs inside engines.

No AI platform-specific code outside adapters.

No mutable global state.

No singleton abuse.

No hidden side effects.

No circular dependencies.

No engine may know whether it is running on Claude, ChatGPT, Gemini, Perplexity, or future systems.

No engine may know whether signals come from software inference or Arc hardware.

---

# SECTION 4 — SYSTEM LAYERS

Layer 1

Platform Runtime

Chrome Extension
Manifest V3

---

Layer 2

Perception Layer

Responsibilities:

Observe

Never decide

Never enrich

Never classify

Never persist

Produces:

prompt.typed
pause.detected
response.chunk

---

Layer 3

Event Bus

Responsibilities:

Publish

Subscribe

Route

Nothing else.

No intelligence.

No storage.

No business logic.

---

Layer 4

Domain Engines

State Engine

Gap Engine

Ghost Text Engine

Enrichment Engine

Response Intelligence Engine

Insight Engine

Future Arc Engines

Only this layer contains decision making.

---

Layer 5

Storage Layer

Consumes events.

Builds projections.

Never owns business logic.

Never decides behavior.

---

Layer 6

Presentation Layer

Side Panel

Debug Views

Mock Harness

UI Components

Consumes projections only.

Never talks directly to engines.

---

# SECTION 5 — EVENT CONTRACT LAW

The Event Registry is a source of truth.

Event names are immutable public contracts.

Changing an event name is a breaking architectural change.

All events derive from:

DomainEvent<T>

Every event contains:

id

type

timestamp

sessionId

source

payload

No exceptions.

---

Supported Event Domains:

Session

Prompt

Cognitive

Ghost Text

Response

Insight

Hardware

Any new event must:

1. Be documented
2. Have a payload schema
3. Be added to registry
4. Be reviewed

Undocumented events are forbidden.

---

# SECTION 6 — STORAGE LAW

Database:

cognis_v1

Stores:

events

user_profiles

read_models

events:
immutable facts

user_profiles:
longitudinal user model

read_models:
query projections

No engine writes directly to projections.

Only projection builders do.

---

# SECTION 7 — PLATFORM ABSTRACTION LAW

Platform-specific logic must remain isolated.

Required abstraction:

AIPlatformAdapter

The rest of Cognis must never know:

Claude selectors

ChatGPT selectors

Gemini selectors

DOM structures

Button locations

Streaming implementations

Those belong exclusively inside adapters.

---

Allowed:

PlatformManager
→ Adapter

Adapter
→ DOM

---

Forbidden:

Enrichment Engine
→ ChatGPT DOM

Gap Engine
→ Claude DOM

Response Engine
→ HTML Elements

---

# SECTION 8 — ENRICHMENT ENGINE LAW

The Enrichment Engine is a pure domain service.

Input:

IdentityProfile

GapProfile

CurrentState

Prompt

GhostTextCompletions

Output:

EnrichedPrompt

The user's prompt must never be modified.

The user's prompt must remain intact.

The enriched prompt wraps the original prompt.

Required layer order:

1 Identity Layer

2 Task Frame Layer

3 Gap Resolution Layer

4 Constraints Layer

5 Output Structure Layer

6 State Suffix

Layer order is fixed.

---

# SECTION 9 — ARC READINESS LAW

Every implementation must assume Arc exists.

Even though Arc does not exist yet.

Future hardware integration must require:

zero engine rewrites

zero event changes

zero schema migrations

zero contract modifications

If Arc integration requires changing existing interfaces, the architecture has failed.

Stable interfaces:

state.changed

hardware.connected

hardware.signal.received

EnrichmentContext.currentState

TaskAggregates.automaticity_phase

These interfaces are effectively frozen.

---

# SECTION 10 — REPOSITORY GOVERNANCE

Week 1 Foundation Freeze

Only these areas are considered foundational:

core/

platforms/

storage/

mock/

Changes here require heightened review.

These folders define the entire future architecture.

Feature code must adapt to foundation contracts.

Foundation contracts do not adapt to feature code.

---

# SECTION 11 — DEFINITION OF DONE

A module is not complete because it compiles.

A module is complete only if:

1. Emits documented events

2. Consumes documented events

3. Has typed interfaces

4. Has payload contracts

5. Has tests

6. Meets latency budgets

7. Has architecture comments

8. Is hardware ready

9. Is platform agnostic

10. Can be replaced without downstream changes

If replacing a module requires editing consumers, the architecture has failed.

---

# SECTION 12 — AI ASSISTANT INSTRUCTIONS

Before generating code:

Validate against:

- Architecture RFC
- Engineering Contracts
- Sprint Plan
- Repository Skeleton
- Foundation Architecture

Reject any implementation that:

- introduces coupling
- violates EventBus architecture
- bypasses adapters
- stores raw prompts
- breaks Arc readiness
- exceeds latency budgets
- introduces platform knowledge into engines

When uncertain:

choose architectural correctness over implementation convenience.

The primary goal is long-term architectural integrity, not short-term feature delivery.