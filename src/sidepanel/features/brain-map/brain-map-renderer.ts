/**
 * Brain Map Renderer — Wires the brain-map SVG to the activation profile config.
 *
 * Usage:
 *   1. Inline or embed brain-map.svg into the DOM
 *   2. Call `renderBrainMap(regionProfile)` with the selected task's region_profile
 *   3. Each region's fill colour and opacity updates to match the activation level
 *
 * Colour intensity mapping (from spec Part XV):
 *   0 = outline only (no fill)
 *   1 = low fill (20% opacity)
 *   2 = moderate fill (40% opacity)
 *   3 = strong fill (70% opacity)
 *   4 = peak fill (100% opacity + glow filter)
 */

// Region colour palette — each region has its own hue for visual distinction
const REGION_COLOURS: Record<string, string> = {
  DLPFC: '#7c4dff',
  mPFC: '#e040fb',
  M1: '#00bcd4',
  Parietal: '#ff7043',
  Temporal: '#ffc107',
  Occipital: '#66bb6a',
  Cerebellum: '#42a5f5',
  Hippocampus: '#ab47bc',
  Amygdala: '#ef5350',
  ACC: '#ffab40',
};

// Activation level → fill opacity
const LEVEL_OPACITY: Record<number, number> = {
  0: 0,     // outline only
  1: 0.2,   // low fill
  2: 0.4,   // moderate fill
  3: 0.7,   // strong fill
  4: 1.0,   // peak fill
};

export interface RegionProfile {
  DLPFC: number;
  mPFC: number;
  M1: number;
  Parietal: number;
  Temporal: number;
  Occipital: number;
  Cerebellum: number;
  Hippocampus: number;
  Amygdala: number;
  ACC: number;
}

/**
 * Updates the brain-map SVG regions to reflect the given activation profile.
 *
 * @param profile - The region_profile object from activation_profiles.json
 * @param svgContainer - The DOM element containing the inlined SVG (defaults to document)
 */
export function renderBrainMap(
  profile: RegionProfile,
  svgContainer: Document | Element = document
): void {
  const regionKeys = Object.keys(REGION_COLOURS) as (keyof RegionProfile)[];

  for (const regionKey of regionKeys) {
    const level = Math.max(0, Math.min(4, profile[regionKey] ?? 0));
    const groupEl = svgContainer.querySelector(`#region-${regionKey}`);
    if (!groupEl) continue;

    const pathEl = groupEl.querySelector('path');
    if (!pathEl) continue;

    const colour = REGION_COLOURS[regionKey];
    const opacity = LEVEL_OPACITY[level];

    if (level === 0) {
      // Outline only — dashed border, no fill
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke', colour);
      pathEl.setAttribute('stroke-dasharray', '4,3');
      pathEl.setAttribute('opacity', '0.7');
      pathEl.removeAttribute('filter');
    } else {
      // Filled — solid border, coloured fill at mapped opacity
      pathEl.setAttribute('fill', colour);
      pathEl.setAttribute('fill-opacity', String(opacity));
      pathEl.setAttribute('stroke', colour);
      pathEl.setAttribute('stroke-dasharray', 'none');
      pathEl.setAttribute('opacity', '1');

      if (level === 4) {
        // Peak activation gets the glow filter
        pathEl.setAttribute('filter', 'url(#glow-peak)');
      } else {
        pathEl.removeAttribute('filter');
      }
    }
  }
}

/**
 * Sets up hover/tap tooltips on brain-map regions.
 *
 * Each region group has data-label and data-role attributes.
 * This function creates a tooltip showing: region name, activation level,
 * and the functional role for the current task.
 *
 * @param profile - The current activation profile
 * @param svgContainer - The DOM element containing the SVG
 */
export function setupBrainMapTooltips(
  profile: RegionProfile,
  svgContainer: Element
): void {
  const regions = svgContainer.querySelectorAll('.brain-region');

  regions.forEach((region) => {
    const regionKey = region.getAttribute('data-region') as keyof RegionProfile;
    const label = region.getAttribute('data-label') || regionKey;
    const role = region.getAttribute('data-role') || '';
    const level = profile[regionKey] ?? 0;

    const levelLabels = ['Inactive', 'Low', 'Moderate', 'High', 'Peak'];

    region.setAttribute(
      'title',
      `${label}\nActivation: ${levelLabels[level]} (${level}/4)\n${role}`
    );

    // Add cursor pointer for interactivity
    (region as HTMLElement).style.cursor = 'pointer';
  });
}

/**
 * Updates the disclosure label text.
 *
 * @param text - The disclosure text to display
 * @param svgContainer - The DOM element containing the SVG
 */
export function setDisclosureLabel(
  text: string,
  svgContainer: Document | Element = document
): void {
  const labelGroup = svgContainer.querySelector('#disclosure-label text');
  if (labelGroup) {
    labelGroup.textContent = text;
  }
}
