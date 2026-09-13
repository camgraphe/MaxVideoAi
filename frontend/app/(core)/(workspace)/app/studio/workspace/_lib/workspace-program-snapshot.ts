export type ProgramSnapshotMediaKind = 'image' | 'video';

const PROGRAM_SNAPSHOT_IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i;
const PROGRAM_SNAPSHOT_NON_IMAGE_EXTENSION_PATTERN = /\.(mp4|webm|mov|m4v|mp3|wav|ogg|m4a|aac)(?:[?#].*)?$/i;

export function isProgramSnapshotImageUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:image/')) return true;
  if (url.startsWith('data:') || PROGRAM_SNAPSHOT_NON_IMAGE_EXTENSION_PATTERN.test(url)) return false;
  return PROGRAM_SNAPSHOT_IMAGE_EXTENSION_PATTERN.test(url);
}

function isLikelyProgramSnapshotImageFallback(url?: string | null): boolean {
  if (!url) return false;
  if (isProgramSnapshotImageUrl(url)) return true;
  if (url.startsWith('data:') || PROGRAM_SNAPSHOT_NON_IMAGE_EXTENSION_PATTERN.test(url)) return false;
  return true;
}

export function resolveProgramSnapshotFallbackSourceUrl({
  mediaKind,
  sourceUrl,
  thumbnailUrl,
}: {
  mediaKind: ProgramSnapshotMediaKind;
  sourceUrl?: string | null;
  thumbnailUrl?: string | null;
}): string | undefined {
  if (mediaKind === 'image') {
    if (isLikelyProgramSnapshotImageFallback(sourceUrl)) return sourceUrl ?? undefined;
    if (isLikelyProgramSnapshotImageFallback(thumbnailUrl)) return thumbnailUrl ?? undefined;
    return undefined;
  }

  return isLikelyProgramSnapshotImageFallback(thumbnailUrl) ? thumbnailUrl ?? undefined : undefined;
}
