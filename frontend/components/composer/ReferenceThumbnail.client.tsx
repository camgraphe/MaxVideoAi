'use client';

import { useState } from 'react';
import { AppGlyph } from '@/components/app/AppGlyph';
import type { ComposerAttachment } from './composer-types';

/** Display only: temporal originals never become image requests or eager media readers. */
export function ReferenceThumbnail({ asset }: { asset: ComposerAttachment }) {
  const [failed, setFailed] = useState<string[]>([]);
  const candidates = [asset.thumbnailUrl, ...(asset.kind === 'image' ? [asset.previewUrl] : [])];
  const source = candidates.find(url => url && !failed.includes(url));
  return <span className="app-reference-thumbnail" data-media-kind={asset.kind}>
    {source ? <>
      {/* Private and signed posters must bypass the public optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(previous => [...previous, source])} />
      {asset.kind !== 'image' ? <span className="app-reference-thumbnail-kind"><AppGlyph name={asset.kind} /></span> : null}
    </> : <AppGlyph name={asset.kind} />}
  </span>;
}
