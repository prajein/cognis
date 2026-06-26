# Cognis Foundational Stabilization: Implementation Overview

The Foundational Stabilization sprint (Sprint 0.5) was executed to resolve design debt, stabilize core type definitions, enforce schema integrity, and document data layers prior to implementing the IndexedDB Event Store. This ensures a clean and robust platform layer for downstream development.

---

## 1. Architectural Boundaries & Data Classification (ADR-005)

To prevent the corruption of data architectures and schema pollution, **ADR-005: Data Classification** formally segregates Cognis data into three distinct tiers:

| Tier | Examples | Storage Location | Mutability | Source / Derivation |
| :--- | :--- | :--- | :--- | :--- |
| **1. Reference Data** (Knowledge) | Activation Profiles, Gap Taxonomy, Brain Regions | Bundled static JSON in extension package | Immutable at runtime. Versioned via extension releases. | Static taxonomies & research data |
| **2. Domain Events** (Facts) | `prompt.typed`, `state.changed`, `gap.detected` | IndexedDB `events` object store | Append-only. Never updated or deleted. | Runtime observations (Perception Layer & Engines) |
| **3. Read Models** (Projections) | Identity Profiles, Automaticity Scores, Gap History | IndexedDB `read_models` object store | Mutable and fully rebuildable. | Derived dynamically from Domain Events |

### Key Consequences
* **Storage Segregation:** Reference data is strictly forbidden from being stored in IndexedDB. It serves as a static knowledge base queried by engines but never mutated.
* **No Event Sourcing for Config:** Configuration changes (e.g. tweaking a region threshold) do not emit domain events. They are distributed via package updates.

---

## 2. Strong Domain Branding for Identifiers

To prevent runtime errors caused by mismatched string primitives (e.g. passing a `SkillDomain` where a `TaskId` is expected), Cognis utilizes TypeScript `unique symbol` branding for its primary taxonomy identifiers.

Branded definitions are declared in [activation-profile.types.ts](file:///Users/ntbnaren7/Dev/cognis/src/core/types/activation-profile.types.ts):

```typescript
declare const __taskIdBrand: unique symbol;
export type TaskId = string & { readonly __brand: typeof __taskIdBrand };
export function toTaskId(id: string): TaskId {
  return id as TaskId;
}

declare const __skillDomainBrand: unique symbol;
export type SkillDomain = string & { readonly __brand: typeof __skillDomainBrand };
export function toSkillDomain(domain: string): SkillDomain {
  return domain as SkillDomain;
}

declare const __hoursBrand: unique symbol;
export type Hours = number & { readonly __brand: typeof __hoursBrand };
export function toHours(hours: number): Hours {
  return hours as Hours;
}
```

### Type Verification
The TypeScript compiler now halts compilation if generic string types are used implicitly:
```typescript
const task: TaskId = "write_code"; // Compile-time Error
const taskSafe: TaskId = toTaskId("write_code"); // Compiles successfully
```

---

## 3. Strict Load-Time Mapping & Transformation

Because static JSON configurations (like `activation_profiles.json`) contain raw, unbranded string fields, the [activation-profile-loader.ts](file:///Users/ntbnaren7/Dev/cognis/src/core/config/activation-profile-loader.ts) transforms the raw input schema into branded types at the module loading boundary.

```typescript
const rawConfig = activationProfilesJson as any;

const mappedProfiles: ActivationProfile[] = rawConfig.profiles.map((p: any) => ({
  ...p,
  task_id: toTaskId(p.task_id),
  skill_domain: toSkillDomain(p.skill_domain),
  transition_threshold_hours: p.transition_threshold_hours !== null ? toHours(p.transition_threshold_hours) : null,
}));

const activationProfiles: ActivationProfilesConfig = {
  ...rawConfig,
  profiles: mappedProfiles,
};
```

This prevents type pollution from escaping the load boundary, ensuring that all down-stream API consumers (such as `getActivationProfile(taskId: TaskId)`) receive fully verified, strongly typed objects.

---

## 4. Elimination of Redundant Interfaces

To establish a single source of truth for the event schema, the duplicate `EventPayloads.ts` file was permanently deleted. All event payloads are consolidated in `contracts.ts`, ensuring strict type alignment across the codebase:
* Removed `src/core/types/EventPayloads.ts`.
* Removed the barrel re-export in `src/core/types/index.ts`.
* Verified that all engines and services refer to the canonical schemas in `contracts.ts`.

---

## 5. Build-Time Schema Validation

To guarantee the integrity of the reference taxonomy configuration file (`activation_profiles.json`), schema validation is integrated directly into the build pipeline using Ajv.

### Script Mechanics (`scripts/validate-schemas.mjs`)
The script matches the bundled JSON configuration against its JSON Schema definition:
1. Compiles the schema using Ajv under strict mode (`{ strict: true }`).
2. Validates `activation_profiles.json` at compile-time.
3. Exits with code `1` and prints semantic errors if schema rules are broken (e.g. invalid `RegionScore` boundaries or misspelled categories).

### Integration
* Added Ajv as a development dependency (`devDependencies` in `package.json`).
* Added `npm run validate:schemas` to build and CI checkpoints.
* **Zero Runtime Cost:** Validation runs exclusively at compile-time; the production package incurs no footprint.

---

## 6. Implementation References

* **Branded Domain Types**: [activation-profile.types.ts](file:///Users/ntbnaren7/Dev/cognis/src/core/types/activation-profile.types.ts)
* **Configuration Loader & APIs**: [activation-profile-loader.ts](file:///Users/ntbnaren7/Dev/cognis/src/core/config/activation-profile-loader.ts)
* **Compile-Time Validation Script**: [validate-schemas.mjs](file:///Users/ntbnaren7/Dev/cognis/scripts/validate-schemas.mjs)
* **ADR-005 Data Classification**: [ADR-005-data-classification.md](file:///Users/ntbnaren7/Dev/cognis/docs/adrs/ADR-005-data-classification.md)
