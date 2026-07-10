const DEFAULT_ASSET_FIELD_RANKS: Record<string, number> = {
  image_url: 0,
  video_url: 0,
  end_image_url: 1,
  image_urls: 2,
  reference_image_urls: 3,
  video_urls: 4,
  audio_urls: 5,
  audio_url: 6,
};

export function getWorkspaceAssetFieldRank(engineId: string, fieldId: string): number {
  if (engineId.startsWith('seedance-2-0')) {
    const seedanceRanks: Record<string, number> = {
      image_url: 0,
      end_image_url: 1,
      video_url: 2,
      image_urls: 3,
      reference_image_urls: 4,
      video_urls: 5,
      audio_urls: 6,
      audio_url: 7,
    };
    return seedanceRanks[fieldId] ?? 99;
  }
  return DEFAULT_ASSET_FIELD_RANKS[fieldId] ?? 99;
}

export function getWorkspaceAssetGridClass(fieldCount: number): string {
  if (fieldCount <= 1) return 'grid grid-cols-1 gap-3';
  if (fieldCount === 2) return 'grid grid-cols-1 gap-3 md:grid-cols-2';
  if (fieldCount === 3) return 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3';
  return 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';
}
