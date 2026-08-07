import type {
  AssetFieldConfig,
  ComposerAttachment,
} from '@/components/composer/composer-types';

export function hasMissingRequiredComposerAsset(
  assetFields: AssetFieldConfig[],
  assets: Record<string, (ComposerAttachment | null)[]>,
): boolean {
  return assetFields.some(({ field, required }) => {
    if (!required) return false;

    const minimumCount = field.minCount ?? 1;
    const currentCount = assets[field.id]?.filter((asset) => asset !== null).length ?? 0;
    return currentCount < minimumCount;
  });
}
