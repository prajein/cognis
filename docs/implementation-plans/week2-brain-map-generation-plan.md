# Brain-Map Master Template Architecture RFC (API Contract v1.0.0)

## 1. Overall Design Philosophy: The SVG as an API
The `brain-template.svg` is fundamentally a **stable public interface (API), not just a design asset**. It serves as a strict compatibility contract between the activation profile configuration, the SVG generator, the frontend runtime, and future renderers. The SVG must be deterministic, clean, modern, and schematic. Once established, changing region IDs, viewBox, or hierarchy becomes a breaking change, requiring formal versioning.

## 2. Explicit Non-Goals
To prevent scope creep and maintain strict separation of concerns, the master template explicitly **does not** define:
- Region activation values
- Color palettes
- Intensity mapping
- Animation behavior
- Tooltip positioning
- Accessibility text content
- Runtime interaction
- Generator implementation
- Styling themes

## 3. Ownership
This SVG is a formal API with defined owners and consumers. Treating it as shared mutable state is prohibited.

**Owner:**
- Surface B Visualization Platform

**Consumers:**
- SVG Generator
- Surface B
- Future Runtime Renderer
- Validation Tools

**Non-Consumers (Must never depend on this SVG):**
- Insight Engine
- State Engine
- Event Bus
- Activation Profile Loader

## 4. Master Template Source of Truth
**One SVG forever:** The master template is the single source of truth. All 47 generated SVGs MUST originate from this single file. Manual editing or manual touch-ups of generated SVGs is strictly prohibited. The generator pipeline is absolute.

## 5. Region Taxonomy & Zero-Mapping IDs
The SVG must map exactly to the canonical `RegionProfile` TypeScript interface. We require a **zero-mapping generator** approach: the SVG `id` attributes must literally match the TypeScript property keys. No lookup tables or string transformations are permitted (`profile.region_profile[regionId]`).

* `id="DLPFC"`
* `id="mPFC"`
* `id="M1"`
* `id="Parietal"`
* `id="Temporal"`
* `id="Occipital"`
* `id="Cerebellum"`
* `id="Hippocampus"`
* `id="Amygdala"`
* `id="ACC"`

> [!IMPORTANT]
> There are exactly 10 regions—no more, no less. We will not invent extra anatomical subdivisions. The SVG is a visualization layer for the `RegionProfile` interface, not a neuroanatomy diagram.

## 6. Immutable Coordinate System & Transforms
- **Fixed viewBox:** The coordinate system is frozen. We will use a strict `viewBox="0 0 512 512"`. This must never change, ensuring future animations, overlays, or tooltip positioning remain perfectly aligned and highly predictable.
- **No Transforms:** The use of `transform="..."` (e.g., translate, scale, matrix) inside region elements or groups is strictly prohibited. Transforms make generator math complex. Every region must exist in absolute, pre-calculated coordinates.

## 7. Strict SVG Hierarchy & Element Generalization
The internal structure must be completely flat and explicitly grouped to guarantee deterministic DOM traversal by the generator. 

The generator will target **region elements**, not specifically SVG primitives. Each region element SHALL expose exactly one stable public ID corresponding to a `RegionProfile` field. Internal implementation (single path, compound path, grouped geometry, etc.) is private to the template and must not affect the generator API. While they may start as `<path>` elements today, they could evolve into `<g>` or `<symbol>` elements tomorrow without breaking the API.

```xml
<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" data-template-api="1.0.0" data-template-asset="1.0.0">
  <defs>
    <!-- Shared gradients, clips, or patterns -->
  </defs>
  <g id="outline">
    <!-- Optional base silhouette -->
  </g>
  <g id="separators">
    <!-- Optional schematic dividing lines -->
  </g>
  <g id="regions">
    <!-- Exactly 10 region elements, regardless of underlying primitive -->
    <path id="DLPFC" ... />
    <path id="mPFC" ... />
    <path id="M1" ... />
    <g id="Parietal">...</g>
    <!-- ... -->
  </g>
  <metadata>
    <!-- Template-level metadata only -->
  </metadata>
</svg>
```

## 8. Geometry Contract
To prevent rendering artifacts, clipping issues, or sub-pixel bleeding at runtime, every region element MUST adhere to the following geometric constraints:
1. Must be a **closed geometry** (e.g., closed path with `Z`).
2. Must **never overlap** another region (zero Z-index fighting).
3. Must **never self-intersect**.
4. Collectively, the canonical region elements **SHALL completely partition the intended brain visualization area**. Any geometry outside the visualization area belongs exclusively to `#outline` or other non-region groups.
5. Must **leave no unintentional gaps** unless specifically part of the schematic aesthetic.

## 9. Export Contract
Design tools (Figma, Illustrator, Inkscape) often inject proprietary data that breaks assumptions. The exported `brain-template.svg` must comply with deterministic export rules:
- No embedded CSS (`<style>`)
- No inline transforms
- No editor metadata (e.g., `sodipodi:`, `figma:`)
- No raster images (`<image>`)
- No clipping masks (unless explicitly approved in `<defs>`)
- No hidden layers (`display="none"`)
- UTF-8 encoding only
- Deterministic formatting (consistent indentation)

## 10. Validation Contract
Every change to `brain-template.svg` MUST pass automated validation. This enforces the API contract in CI.

**When Validation Runs:**
- On every pull request modifying `brain-template.svg`
- Before every release
- As part of the SVG generation pipeline
- Before generated assets are committed

**Validation Severity:**
- **ERROR (Generation blocked)**: Invalid SVG, incorrect IDs, duplicate IDs, incorrect viewBox, invalid hierarchy, transforms within `#regions`, incorrect region count, open geometries.
- **WARNING (Generation allowed)**: Non-deterministic formatting, optional metadata omissions, minor export formatting deviations.

## 11. Template–Generator Contract
The SVG generator acts as a pure function `(Template, Profile) -> SVG`. 

**Assumed Correctness:**
The generator assumes the template satisfies this RFC. If validation fails, generation MUST abort rather than attempting recovery. The generator must never infer missing regions, repair malformed geometry, or fabricate metadata.
- Template -> guarantees correctness
- Validator -> verifies correctness
- Generator -> assumes correctness

**Mutability:**
The template dictates what is allowed to be modified during this build step.
- **Mutable (Generator is allowed to change):**
  - `fill`
  - `fill-opacity` (or just `opacity`)
  - `metadata` (injecting Generated Metadata or ARIA `<desc>`)
- **Immutable (Generator MUST NOT change):**
  - Geometry (path data `d="..."` or inner elements)
  - Region IDs
  - Hierarchy or DOM structure
  - Stroke definitions

**Deterministic Generation:**
Given identical template version, activation profile configuration, and generator version, the generated SVG output MUST be byte-for-byte identical. Any intentional change to generated output requires either a template asset revision change, generator version change, or configuration version change. (No timestamp injection or non-deterministic ordering).

## 12. Intensity Model Abstraction
Colors will not be hardcoded to specific scores (0-4). Instead, the system will use a semantic abstraction:
`RegionScore -> Intensity -> Visual Style`
This keeps future theming decoupled from the generation logic. The generator computes the "Visual Style" properties based on intensity and injects them.

## 13. Metadata Separation
Template and generated assets have distinct lifecycles and require separate metadata.

**Template Metadata (Included in `brain-template.svg`):**
- template API version (`data-template-api`)
- template artwork asset version (`data-template-asset`)
- author
- created
- updated

**Generated Metadata (Injected by `svg-generator.ts`):**
- task_id
- generated_from_api
- generated_from_asset
- profile_version
- generator_version

*(Note: `generated_at` timestamp is deliberately excluded to strictly adhere to the byte-for-byte deterministic generation rule.)*

## 14. Versioning Policy
The template strictly separates API versioning from Asset revisioning.
- **Template API (`data-template-api`)**: Changes ONLY when the public contract changes. Incremented for breaking API changes (e.g., adding an 11th region, changing viewBox, altering hierarchy).
- **Template Asset (`data-template-asset`)**: Changes whenever the template artwork changes.
  - **PATCH**: Visual cleanup only (e.g., minor bezier curve tweaks).
  - **MINOR**: Metadata additions, new optional groups (e.g., adding `#outline`).

## 15. Backward Compatibility Policy
The API specifies compatibility guarantees. 

**Breaking Changes** (Changing region IDs, hierarchy, viewBox, or geometry ownership) require:
- API Version increment (e.g., `1.x` -> `2.0`).
- Coordinated Generator Update.
- Coordinated UI Update.
- Migration Notes explicitly documenting the API change.
