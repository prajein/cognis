/**
 * Brain-Map SVG Template Validator
 *
 * Enforces the API contract defined in the Brain-Map Master Template Architecture RFC.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_REGIONS = [
  "DLPFC",
  "mPFC",
  "M1",
  "Parietal",
  "Temporal",
  "Occipital",
  "Cerebellum",
  "Hippocampus",
  "Amygdala",
  "ACC"
];

export function validateBrainTemplate(svgContent: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Fixed viewBox
  if (!/<svg[^>]*viewBox="0 0 512 512"/.test(svgContent)) {
    errors.push("Missing or incorrect viewBox. Must be exactly '0 0 512 512'");
  }

  // 2. Metadata present
  if (!/<metadata>/.test(svgContent)) {
    errors.push("Missing <metadata> element");
  }

  // 3. Strict SVG Hierarchy (svg > g#regions > ...)
  const regionsMatch = svgContent.match(/<g\s+id="regions">([\s\S]*?)<\/g>/);
  if (!regionsMatch) {
    errors.push("Missing <g id=\"regions\"> group");
    return { valid: false, errors, warnings };
  }

  const regionsContent = regionsMatch[1];

  // 4. No transforms
  if (/transform=/.test(regionsContent)) {
    errors.push("Transform attributes are strictly prohibited inside #regions");
  }

  // 5. Region IDs & Taxonomy
  const idRegex = /id="([^"]+)"/g;
  let match;
  const foundIds = new Set<string>();
  const idMatches: string[] = [];

  while ((match = idRegex.exec(regionsContent)) !== null) {
    idMatches.push(match[1]);
    if (foundIds.has(match[1])) {
      errors.push(`Duplicate region ID found: ${match[1]}`);
    }
    foundIds.add(match[1]);
  }

  if (idMatches.length !== 10) {
    errors.push(`Expected exactly 10 region elements, found ${idMatches.length}`);
  }

  for (const reqId of REQUIRED_REGIONS) {
    if (!foundIds.has(reqId)) {
      errors.push(`Missing required region ID: ${reqId}`);
    }
  }

  for (const foundId of idMatches) {
    if (!REQUIRED_REGIONS.includes(foundId)) {
      errors.push(`Unexpected region ID found in #regions: ${foundId}`);
    }
  }

  // 6. Closed Geometries & Duplicates
  const pathRegex = /\sd="([^"]+)"/g;
  const geometries = new Set<string>();
  let pathCount = 0;

  while ((match = pathRegex.exec(regionsContent)) !== null) {
    pathCount++;
    const dAttr = match[1].trim();
    if (!/z$/i.test(dAttr)) {
      errors.push("Found unclosed geometry (path does not end with Z)");
    }
    if (geometries.has(dAttr)) {
      errors.push("Duplicate geometry (identical path data) found");
    }
    geometries.add(dAttr);
  }
  
  if (pathCount !== idMatches.length) {
      warnings.push("Number of 'd' attributes does not match number of region IDs. If using <g> or <symbol>, this may be expected.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
