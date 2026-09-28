'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { curationItemFormat, type CurationItem } from '@/lib/admin/playlist-curation';

type Props = {
  item: CurationItem;
  index: number;
  total: number;
  busy: boolean;
  onMove?: (position: number) => void;
  onRemove?: () => void;
  onExclude?: () => void;
  onAdd?: () => void;
  onInspect?: () => void;
  canAdd?: boolean;
  canExclude?: boolean;
  removeLabel: string;
};

export function PlacementMediaCard({ item, index, total, busy, onMove, onRemove, onExclude, onAdd, onInspect,
  canAdd = true, canExclude = true, removeLabel }: Props) {
  const format = curationItemFormat(item);
  const [position, setPosition] = useState(index + 1);
  useEffect(() => setPosition(index + 1), [index]);

  return <div className="flex h-full min-w-0 flex-col rounded-xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md">
    <div className="relative aspect-video overflow-hidden bg-surface-2">
      {item.thumbUrl ? <Image src={item.thumbUrl} alt="" fill unoptimized loading="lazy" sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
        className={format === '9:16' ? 'object-contain' : 'object-cover'} />
        : <div className="absolute inset-0 grid place-items-center text-xs text-text-muted">No poster</div>}
      {onMove ? <span className="absolute left-2 top-2 rounded-md bg-black/75 px-2 py-1 text-xs font-semibold text-white">#{index + 1}</span> : null}
      {format ? <span className="absolute bottom-2 left-2 rounded-md bg-black/75 px-2 py-1 text-[11px] font-medium text-white">{format}</span> : null}
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text-primary" title={item.prompt}>{item.prompt || item.id}</p>
        <p className="truncate text-xs text-text-secondary">{item.engineLabel ?? item.engineId} · {format ?? 'Unknown format'}</p>
      </div>
      <div className="mt-auto flex items-center gap-2">
        {onInspect ? <button type="button" disabled={busy} onClick={onInspect}
          className="flex-1 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-50">Inspect video</button> : null}
        {onAdd ? <button type="button" disabled={busy || !canAdd} onClick={onAdd}
          className="flex-1 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-50">Add to selection</button> : null}
        <details className="relative z-10 shrink-0">
          <summary aria-label={`More actions for item ${index + 1}`} className="list-none cursor-pointer rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-2">More</summary>
          <div className="absolute bottom-full right-0 z-10 mb-1 min-w-48 space-y-1 rounded-lg border border-border bg-surface p-2 text-xs shadow-lg [&_button]:w-full [&_button]:rounded [&_button]:px-2 [&_button]:py-1.5 [&_button]:text-left [&_button:hover]:bg-surface-2 [&_button:disabled]:opacity-40">
            {onMove ? <>
              <div className="flex gap-1">
                <button type="button" disabled={busy || index === 0} aria-label={`Move item ${index + 1} up`} onClick={() => onMove(index)}>↑ Up</button>
                <button type="button" disabled={busy || index === total - 1} aria-label={`Move item ${index + 1} down`} onClick={() => onMove(index + 2)}>↓ Down</button>
              </div>
              <label className="block px-2 pt-1 text-text-secondary">Global position
                <input type="number" min={1} max={total} value={position} onChange={event => setPosition(Number(event.target.value))}
                  aria-label={`Move item ${index + 1} to position`} className="mt-1 w-full rounded border border-border px-2 py-1 text-text-primary" />
              </label>
              <button type="button" disabled={busy || !Number.isInteger(position) || position < 1 || position > total}
                aria-label={`Apply position for item ${index + 1}`} onClick={() => onMove(position)}>Move to position</button>
            </> : null}
            <a href={`/admin/video-seo?video=${encodeURIComponent(item.id)}`} className="block rounded px-2 py-1.5 text-brand hover:bg-surface-2">Video SEO ↗</a>
            {onRemove ? <button type="button" disabled={busy} onClick={onRemove}>{removeLabel}</button> : null}
            {onExclude ? <button type="button" disabled={busy || !canExclude} onClick={onExclude}>Exclude from this page</button> : null}
          </div>
        </details>
      </div>
    </div>
  </div>;
}
