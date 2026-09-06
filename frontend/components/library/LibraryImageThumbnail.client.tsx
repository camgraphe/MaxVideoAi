'use client';

import { useState } from 'react';
import type { LibraryImageMedia } from '@/lib/library-image';

/** Display only. Selection and generation retain the caller's original asset. */
export function LibraryImageThumbnail({ asset, alt = '', className }: {
  asset: LibraryImageMedia;
  alt?: string;
  className?: string;
}) {
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);
  const thumbnail = asset.thumbUrl || null;
  const displaySrc = thumbnail && thumbnail !== failedThumbnail ? thumbnail : asset.url;

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
      onError={() => { if (displaySrc === thumbnail) setFailedThumbnail(thumbnail); }}
    />
  );
}
