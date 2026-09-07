'use client';

import type { DragEvent } from 'react';
import { AppGlyph } from '@/components/app/AppGlyph';
import { LibraryImageThumbnail } from './LibraryImageThumbnail.client';
import { recentMediaCopy } from './recent-media-copy';

/** Destination-neutral presentation: the caller owns selection, authorization and commands. */
export type RecentMediaCardAsset = {
  id: string; url: string; thumbUrl?: string | null; kind: 'image' | 'video' | 'audio'; createdAt?: string;
};
export function RecentMediaList<T extends RecentMediaCardAsset>({ assets, kind, onKindChange, onSelect, onDragStart, onDragEnd, loading, error, authenticated, onRetry, locale, actionLabel }: {
  assets: T[]; kind: T['kind']; onKindChange: (kind: T['kind']) => void;
  onSelect: (asset: T) => void; onDragStart?: (event: DragEvent, asset: T) => void; onDragEnd?: () => void;
  loading: boolean; error: boolean; authenticated: boolean; onRetry: () => void; locale: string; actionLabel?: string;
}) {
  const copy = recentMediaCopy(locale);
  const selectionLabel = actionLabel ?? copy.use;
  return <section className="app-recent-media" aria-label={copy.title}>
    <div className="app-recent-filters" aria-label={copy.title}>
      {(['image', 'video', 'audio'] as const).map((value) => <button type="button" key={value} aria-pressed={value === kind} onClick={() => onKindChange(value)}>{copy[value]}</button>)}
    </div>
    <p className="app-recent-helper">{copy.helper}</p>
    {!authenticated ? <p role="status">{copy.auth}</p> : loading ? <p role="status">{copy.loading}</p> : error ? <div role="alert"><p>{copy.error}</p><button type="button" onClick={onRetry}>{copy.retry}</button></div> : !assets.length ? <p role="status">{copy.empty}</p> :
      <ul className="app-recent-list">{assets.map((asset, index) => <li key={asset.id}>
        <button type="button" draggable={Boolean(onDragStart)} onDragStart={(event) => onDragStart?.(event, asset)} onDragEnd={onDragEnd} onClick={() => onSelect(asset)} aria-label={`${selectionLabel} · ${copy[asset.kind]} ${index + 1}`}>
          <span className="app-recent-cover">
            {asset.kind === 'image' ? <LibraryImageThumbnail asset={asset} /> : asset.thumbUrl ?
              // A stored poster is display-only; a video/audio original never becomes an image fallback.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.thumbUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <AppGlyph name={asset.kind} />}
          </span>
          <span><strong>{copy[asset.kind]} {index + 1}</strong><small>{selectionLabel}</small></span><AppGlyph name="reference" />
        </button>
      </li>)}</ul>}
  </section>;
}
