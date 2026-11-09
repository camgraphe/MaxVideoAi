'use client';

import { useLibraryDisplayAccess } from '@/hooks/useLibraryMediaAccess';
import { useState } from 'react';
import type { LibraryImageMedia } from '@/lib/library-image';

/** Display only. Selection and generation retain the caller's original asset. */
export function LibraryImageThumbnail({ asset, alt = '', className, posterOnly = false, originalOnly = false }: {
  asset: LibraryImageMedia;
  alt?: string;
  className?: string;
  posterOnly?: boolean;
  originalOnly?: boolean;
}) {
  const { access, refresh, retired } = useLibraryDisplayAccess(asset, false);
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);
  const thumbnail = originalOnly ? null : access.thumbnailAccessUrl || asset.thumbUrl || null;
  const displaySrc = posterOnly ? thumbnail : thumbnail && thumbnail !== failedThumbnail ? thumbnail : access.accessUrl ?? asset.url;
  if (retired || !displaySrc) return null;

  return (
    // Stored thumbnails can be private or signed: never send them to Next Image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => { if (!asset.readAccessRef) { if (displaySrc === thumbnail) setFailedThumbnail(thumbnail); return; } void refresh().then(recovered => { if (!recovered && displaySrc === thumbnail) setFailedThumbnail(thumbnail); }); }}
    />
  );
}
