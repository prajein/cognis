# COGNIS ENGINEERING CONSTITUTION v1.1

## Status

Approved

Version: 1.1

Scope: Entire Cognis Repository

Authority: Highest Engineering Reference

Owner: Architecture Lead

---

# PURPOSE

This document defines the architectural laws, engineering constraints, implementation standards, and repository governance rules for Cognis.

All architecture RFCs, engineering contracts, sprint plans, implementation guides, repository structures, pull requests, and generated code must comply with this constitution.

If any generated code, proposal, implementation, or architecture conflicts with this constitution, the constitution takes precedence.

The goal is not to build a browser extension.

The goal is to build a hardware-ready cognitive operating system that can evolve for years without architectural rewrites.

---

# SECTION 1 — WHAT COGNIS IS

Cognis is the software layer of Hyle's Arc vision.

Arc = Future Hardware + Software Cognitive Operating System.

Current State:

Arc Hardware:
Research & Development

Cognis:
Production Software Platform

Cognis is delivered as a browser extension and currently contains two surfaces:

## Surface A

AI Co-Pilot

Responsibilities:

- Observe AI interactions
- Detect cognitive gaps
- Generate Ghost Text
- Enrich prompts
- Improve interaction quality

## Surface B

Skill Visualization

Responsibilities:

- Task tracking
- Cognitive mapping
- Automaticity modeling
- Longitudinal progress visualization

## Future Surface

Arc Hardware

All three surfaces must operate through identical architectural contracts.

The architecture is the product.

The extension is merely the first runtime.

---

# SECTION 2 — CORE ARCHITECTURAL PHILOSOPHY

The system must satisfy five principles.

## Event Driven

Modules communicate exclusively through Domain Events.

Allowed:

Perception
→ Event Bus
→ Engine

Forbidden:

Perception
→ Engine

No exceptions.

No direct module invocation.

No engine coupling.

---

## Event Sourced

Every meaningful action becomes an immutable event.

Events are:

- append-only
- immutable
- replayable

Events are never:

- updated
- deleted
- mutated

Storage preserves facts.

Read models provide views.

---

## Local First

Behavioral data remains local.

Requirements:

- No cloud dependency
- No remote state requirement
- No raw prompt persistence
- Prompt hashes only

Local functionality must remain operational without network access.

---

## Hardware Agnostic

All software-generated signals must expose identical interfaces to future Arc hardware.

Current:

TypingStateProvider

Future:

ArcBLEStateProvider

Both emit:

state.changed

Consumers must not know the source.

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

Violation of latency budgets is an architectural failure.

---

# SECTION 3 — SYSTEM LAYERS

Layer 1

Platform Runtime

Chrome Extension
Manifest V3

---

Layer 2

Perception Layer

Responsibilities:

Observe

Never:

- decide
- classify
- enrich
- persist

Produces:

prompt.typed
pause.detected
response.chunk

---

Layer 3

Event Bus

Responsibilities:

publish
subscribe
unsubscribe
route

Nothing else.

No storage.

No business logic.

No persistence.

No intelligence.

---

Layer 4

Domain Engines

State Engine

Gap Detection Engine

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

Never performs decision making.

---

Layer 6

Presentation Layer

Side Panel

Debug Views

Mock Harness

UI Components

Consumes projections only.

Never communicates directly with engines.

---

# SECTION 4 — EVENT CONTRACT LAW

The Event Registry is the canonical source of truth.

Event names are immutable public contracts.

Changing an event name is a breaking architectural change.

---

## Current Event Count

Canonical Event Count:

25

Any discrepancy between documentation and implementation must be resolved in favor of implementation.

---

## Domain Event Contract

Every event derives from:

DomainEvent<T>

Required Fields:

id

type

timestamp

sessionId

source

payload

No exceptions.

---

## Supported Domains

Session

Prompt

Cognitive

Ghost Text

Response

Insight

Hardware

---

## Event Requirements

Every event must:

1. Exist in registry.ts
2. Exist in CognisEventMap
3. Have a payload contract
4. Be documented
5. Be reviewed

Undocumented events are forbidden.

---

## CognisEventMap

CognisEventMap is a first-class architecture primitive.

All EventBus operations must derive payload types from CognisEventMap.

Payload inference must be compile-time safe.

No runtime payload casting.

No string-based payload access.

---

# SECTION 5 — TYPE SAFETY LAW

TypeScript Strict Mode is mandatory.

No implicit any.

No disabled compiler checks.

No unsafe casting without justification.

---

## Branded Types

The following identifiers are branded:

SessionId

EventId

Timestamp

Primitive strings may not be used in place of branded identifiers.

Constructors must be used.

---

## Domain Types

StateLabel:

stretch

coasting

overload

GapType:

intentionality

audience

constraint

stakes

assumption

mechanism

temporal

second_order

AIPlatform:

chatgpt

claude

gemini

---

# SECTION 6 — PLATFORM ABSTRACTION LAW

Platform-specific logic remains isolated.

Required abstraction:

AIPlatformAdapter

The rest of Cognis must never know:

- Claude selectors
- ChatGPT selectors
- Gemini selectors
- DOM structures
- Button locations
- Streaming implementation details

Allowed:

PlatformManager
→ Adapter

Adapter
→ DOM

Forbidden:

Engine
→ DOM

Engine
→ Adapter Implementation

Engine
→ Browser APIs

---

# SECTION 7 — ENRICHMENT ENGINE LAW

The Enrichment Engine is a pure domain service.

Input:

IdentityProfile

GapProfile

CurrentState

Prompt

GhostTextCompletions

Output:

EnrichedPrompt

The user's prompt remains semantically intact.

The original prompt must always be preserved.

Enrichment wraps the prompt.

It never replaces it.

---

## Layer Order

Required:

1 Identity Layer

2 Task Frame Layer

3 Gap Resolution Layer

4 Constraints Layer

5 Output Structure Layer

6 State Suffix

Order is immutable.

---

# SECTION 8 — STORAGE LAW

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

# SECTION 9 — ARC READINESS LAW

Every implementation assumes Arc exists.

Even though Arc is not currently available.

Future hardware integration must require:

- zero engine rewrites
- zero event changes
- zero schema migrations
- zero contract modifications

If Arc integration requires interface changes, the architecture has failed.

Frozen Contracts:

state.changed

hardware.connected

hardware.disconnected

hardware.signal.received

EnrichmentContext.currentState

TaskAggregates.automaticity_phase

---

# SECTION 10 — REPOSITORY GOVERNANCE

Protected Foundation Areas:

core/

platforms/

storage/

mock/

Changes to these areas require architectural review.

Feature code adapts to contracts.

Contracts do not adapt to feature code.

---

## Ownership

Naren

- core
- platforms
- enrichment
- architecture governance
- mock harness

Suchit

- storage
- state engine

Yogesh

- gap engine
- ghost text

Riya

- surface B
- visualization
- automaticity projections

---

# SECTION 11 — DEFINITION OF DONE

A module is complete only if:

1. Emits documented events
2. Consumes documented events
3. Has typed contracts
4. Has payload schemas
5. Has tests
6. Meets latency budgets
7. Is platform agnostic
8. Is hardware ready
9. Has architectural documentation
10. Can be replaced without downstream modifications

If replacing a module requires changing consumers, the architecture has failed.

---

# SECTION 12 — AI ASSISTANT OPERATING PROCEDURE

Before generating code:

Validate against:

1. Cognis Engineering Constitution
2. Architecture RFC
3. Engineering Contracts
4. Repository Skeleton
5. Event Contracts
6. Sprint Plan

Reject implementations that:

- introduce coupling
- bypass EventBus
- bypass adapters
- store raw prompts
- violate Arc readiness
- exceed latency budgets
- introduce platform knowledge into engines

When uncertain:

Choose architectural correctness over implementation convenience.

Long-term maintainability is more important than short-term delivery speed.