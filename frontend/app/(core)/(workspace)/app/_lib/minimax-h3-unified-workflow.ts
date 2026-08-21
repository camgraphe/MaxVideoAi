import type { Mode } from '@/types/engines';
import type { ReferenceAsset } from './workspace-assets';

type InputAssetState = Record<string, (ReferenceAsset | null)[]>;

export function isUnifiedMinimaxH3EngineId(engineId: string | null | undefined): boolean {
  return engineId === 'minimax-h3';
}

function hasAsset(
  inputAssets: InputAssetState,
  fieldIds: readonly string[],
  kind: ReferenceAsset['kind']
): boolean {
  return fieldIds.some((fieldId) =>
    (inputAssets[fieldId] ?? []).some((asset) => asset?.kind === kind)
  );
}

export function resolveMinimaxH3UnifiedMode(inputAssets: InputAssetState): Mode {
  const hasReferenceInput =
    hasAsset(inputAssets, ['reference_image_urls'], 'image') ||
    hasAsset(inputAssets, ['reference_video_urls'], 'video') ||
    hasAsset(inputAssets, ['reference_audio_urls'], 'audio');
  if (hasReferenceInput) return 'ref2v';

  const hasImageInput =
    hasAsset(inputAssets, ['image_url'], 'image') ||
    hasAsset(inputAssets, ['end_image_url'], 'image');
  if (hasImageInput) return 'i2v';

  return 't2v';
}
