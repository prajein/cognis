import { taskIdToAssetName } from '../shared/naming';

/**
 * Internal read-only asset registry indexing all pre-rendered Brain-Map SVGs.
 * Vite statically analyzes import.meta.glob to bundle these assets at build time.
 */
const brainMapAssets: Readonly<Record<string, string>> = import.meta.glob(
  './generated/*.svg',
  {
    eager: true,
    import: 'default'
  }
);

/**
 * Resolves the static SVG asset URL for a given task ID.
 * Returns the resolved SVG URL string, or undefined if not found.
 */
export function getBrainMapAsset(taskId: string): string | undefined {
  const filename = `./generated/${taskIdToAssetName(taskId)}`;
  return brainMapAssets[filename];
}

/**
 * Checks whether an SVG asset exists in the registry for a given task ID.
 */
export function hasBrainMapAsset(taskId: string): boolean {
  const filename = `./generated/${taskIdToAssetName(taskId)}`;
  return filename in brainMapAssets;
}
