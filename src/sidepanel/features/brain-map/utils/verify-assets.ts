import * as fs from 'fs';
import * as path from 'path';
import { taskIdToAssetName, normalizeTaskId } from '../shared/naming';
import type { ActivationProfile } from '../../../../core/types/activation-profile.types';

export function verifyBrainMapAssets(): void {
  console.log('[Verify] Checking Brain-Map generated asset invariants...');

  const configPath = path.join(__dirname, '../../../../core/config/activation_profiles.json');
  const outDir = path.join(__dirname, '../assets/generated');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Activation profiles config not found at: ${configPath}`);
  }

  if (!fs.existsSync(outDir)) {
    throw new Error(`Generated assets directory not found at: ${outDir}`);
  }

  const configStr = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configStr) as { profiles: ActivationProfile[] };

  const expectedTaskIds = config.profiles.map(p => p.task_id);
  const expectedCount = expectedTaskIds.length;

  // Invariant 1 & 3: Check collision & normalization
  const normalizedToTaskId = new Map<string, string>();
  const expectedFilenames = new Set<string>();
  for (const taskId of expectedTaskIds) {
    const normalized = normalizeTaskId(taskId);
    if (normalizedToTaskId.has(normalized)) {
      const existingTaskId = normalizedToTaskId.get(normalized);
      const outFilename = taskIdToAssetName(taskId);
      throw new Error(
        `[Invariant Failed] Normalization collision:\n- ${existingTaskId} -> ${outFilename}\n- ${taskId} -> ${outFilename}\nVerification aborted.`
      );
    }
    normalizedToTaskId.set(normalized, taskId);

    const assetName = taskIdToAssetName(taskId);
    expectedFilenames.add(assetName);

    // Check file exists on disk
    const assetPath = path.join(outDir, assetName);
    if (!fs.existsSync(assetPath)) {
      throw new Error(`[Invariant Failed] Task '${taskId}' resolved asset '${assetName}' not found on disk at: ${assetPath}`);
    }
  }

  // Invariant 4 & 5: Check orphaned files & count parity
  const generatedFiles = fs.readdirSync(outDir).filter((f: string) => !f.startsWith('.'));
  const actualCount = generatedFiles.length;

  if (actualCount !== expectedCount) {
    throw new Error(`[Invariant Failed] Asset count parity mismatch: expected ${expectedCount} assets, found ${actualCount}`);
  }

  for (const file of generatedFiles) {
    if (!file.endsWith('.svg')) {
      throw new Error(`[Invariant Failed] Non-.svg file found in generated directory: ${file}`);
    }
    if (!expectedFilenames.has(file)) {
      throw new Error(`[Invariant Failed] Orphaned generated asset detected: ${file}`);
    }
  }

  console.log(`✅ [Verify] All 5 asset invariants verified successfully across ${expectedCount} profiles!`);
}

if (require.main === module) {
  try {
    verifyBrainMapAssets();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
