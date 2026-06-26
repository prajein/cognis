# ADR-005: Data Classification

**Status:** Accepted
**Date:** 2026-06-26

## Context

As the Cognis architecture evolves, we are introducing new types of data into the system, such as activation profiles and brain region definitions. Initially, there was ambiguity regarding where this data should be stored and how it should be accessed. Specifically, questions arose around whether research-derived models (like activation profiles) should be stored in IndexedDB and treated as domain events.

Without a clear distinction between different kinds of data, the system risks coupling immutable reference data with mutable event streams, leading to convoluted storage logic, schema evolution issues, and violations of the event-sourced architecture.

## Decision

We formally classify all data within Cognis into three distinct layers, each with its own storage, mutability, and sourcing rules:

### 1. Reference Data (Knowledge)
*   **Examples:** Activation Profiles, Gap Taxonomy, Brain Region Definitions.
*   **Storage:** Bundled JSON files within the extension (never IndexedDB).
*   **Mutability:** Immutable at runtime. Changes only via extension version updates.
*   **Source:** Research, manual configuration, or static taxonomies.

### 2. Domain Events (Facts)
*   **Examples:** `prompt.typed`, `state.changed`, `gap.detected`.
*   **Storage:** IndexedDB `events` object store.
*   **Mutability:** Append-only. Never updated or deleted. These represent historical facts.
*   **Source:** Runtime observations by the Perception Layer and Domain Engines.

### 3. Read Models (Projections)
*   **Examples:** Identity Profile, Automaticity Score, Gap History.
*   **Storage:** IndexedDB `read_models` object store (future).
*   **Mutability:** Mutable and rebuildable.
*   **Source:** Derived entirely from the stream of Domain Events by Projection Builders.

## Consequences

1.  **Storage Segregation:** Reference data is explicitly forbidden from being stored in IndexedDB. It acts as a static "Knowledge Base" that events and projections can reference but never modify.
2.  **No Event Sourcing for Config:** Changes to reference data (e.g., tweaking the transition threshold for a task in a future release) do not generate domain events.
3.  **Clear Engine Contracts:** Domain engines and projection builders know exactly where to source their inputs. Reference data is imported statically, while event data is queried dynamically from the Event Store or received via the EventBus.
4.  **Schema Simplicity:** The IndexedDB schema remains focused purely on event persistence and read models, avoiding the complexity of storing and migrating static configuration.
