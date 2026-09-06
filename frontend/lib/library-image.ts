export type LibraryImageMedia = {
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
