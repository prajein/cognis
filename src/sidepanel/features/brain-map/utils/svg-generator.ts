import * as fs from 'fs';
import * as path from 'path';
import { validateBrainTemplate } from './svg-validator';
import type { ActivationProfile, RegionScore } from '../../../../core/types/activation-profile.types';

// The abstraction: RegionScore -> Intensity -> Visual Style
// Using a modern GitHub-style contribution palette.
const SCORE_TO_FILL: Record<RegionScore, string> = {
  0: '#1e1e24', // Inactive (Dark Gray)
  1: '#0e4429', // Low
  2: '#006d32', // Moderate
  3: '#26a641', // High
  4: '#39d353'  // Peak
};

/**
 * Pure function: (Template, Profile) -> SVG
 */
export function generateBrainMapSvg(
  templateSvg: string, 
  profile: ActivationProfile, 
  generatorVersion: string = "1.0.0"
): string {
  // 1. Assumed Correctness: Validate input template
  const validation = validateBrainTemplate(templateSvg);
  if (!validation.valid) {
    throw new Error(`Template validation failed. Generation aborted.\nErrors: ${validation.errors.join(", ")}`);
  }

  let generatedSvg = templateSvg;

  // Extract Template Metadata safely
  const templateApiMatch = templateSvg.match(/data-template-api="([^"]+)"/);
  const templateAssetMatch = templateSvg.match(/data-template-asset="([^"]+)"/);
  const templateApi = templateApiMatch ? templateApiMatch[1] : "unknown";
  const templateAsset = templateAssetMatch ? templateAssetMatch[1] : "unknown";

  // 2. Mutate Fills deterministically
  for (const [regionId, score] of Object.entries(profile.region_profile)) {
    const fillValue = SCORE_TO_FILL[score as RegionScore];
    
    // We target the region element by its exact ID and replace its fill attribute.
    // Assuming the template uses `<path id="X" ... fill="#yyy" />` format.
    const regionRegex = new RegExp(`(id="${regionId}"[^>]*?)fill="[^"]*"`, 'g');
    generatedSvg = generatedSvg.replace(regionRegex, `$1fill="${fillValue}"`);
  }

  // 3. Mutate Metadata
  const generatedMetadata = `
    <task_id>${profile.task_id}</task_id>
    <generated_from_api>${templateApi}</generated_from_api>
    <generated_from_asset>${templateAsset}</generated_from_asset>
    <profile_version>0.1.0</profile_version>
    <generator_version>${generatorVersion}</generator_version>`;
    
  generatedSvg = generatedSvg.replace(
    /<metadata>[\s\S]*?<\/metadata>/,
    `<metadata>${generatedMetadata}\n  </metadata>`
  );

  return generatedSvg;
}

// Script execution
if (require.main === module) {
  const templatePath = path.join(__dirname, '../assets/brain-template.svg');
  const configPath = path.join(__dirname, '../../../../core/config/activation_profiles.json');
  const outDir = path.join(__dirname, '../assets/generated');

  if (!fs.existsSync(templatePath)) {
    console.error(`Template not found at: ${templatePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(configPath)) {
    console.error(`Config not found at: ${configPath}`);
    process.exit(1);
  }

  const templateSvg = fs.readFileSync(templatePath, 'utf8');
  
  // Validate early so we don't try generating broken files
  const validation = validateBrainTemplate(templateSvg);
  if (!validation.valid) {
    console.error(`Template validation failed. Generation aborted.`);
    console.error(validation.errors.join('\n'));
    process.exit(1);
  }

  const configStr = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configStr) as { profiles: ActivationProfile[] };

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let generatedCount = 0;
  for (const profile of config.profiles) {
    try {
      const generatedSvg = generateBrainMapSvg(templateSvg, profile);
      const outFilename = `brain-map-${profile.task_id}.svg`.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      fs.writeFileSync(path.join(outDir, outFilename), generatedSvg, 'utf8');
      generatedCount++;
    } catch (e) {
      console.error(`Error generating SVG for task ${profile.task_id}:`, e);
      process.exit(1);
    }
  }

  console.log(`Successfully generated ${generatedCount} static SVGs in ${outDir}`);
}
