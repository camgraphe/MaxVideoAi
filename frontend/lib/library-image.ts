import type { MediaReadAccess } from './media-read-access';

export type LibraryImageMedia = MediaReadAccess & {
  url: string;
  thumbUrl?: string | null;
  kind?: 'image' | 'video' | 'audio' | null;
  mime?: string | null;
};

/** Kind is authoritative; MIME and extension support older API responses. */
export function isLibraryImageAsset(asset: LibraryImageMedia): boolean {
  if (asset.kind) return asset.kind === 'image';
  const mime = asset.mime?.toLowerCase();
  if (mime?.startsWith('image/')) return true;
  if (mime?.startsWith('video/') || mime?.startsWith('audio/')) return false;
  return /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i.test(asset.url);
}

/** A thumbnail role must not conceal an original-resource or AV read. */
export function hasStoredLibraryThumbnail(asset: LibraryImageMedia): boolean {
  if (
    !asset.thumbUrl ||
    /\.(mp4|webm|mov|m4v|mp3|wav|m4a|ogg|flac)(?:[?#]|$)/i.test(asset.thumbUrl)
  )
    return false;
  try {
    const thumb = new URL(asset.thumbUrl),
      original = new URL(asset.url);
    return (
      thumb.origin + thumb.pathname !== original.origin + original.pathname
    );
  } catch {
    return false;
  }
}
