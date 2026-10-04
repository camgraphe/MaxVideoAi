'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { curationItemFormat, type CurationDraft, type CurationItem, type CurationOpening } from '@/lib/admin/playlist-curation';

const slots = [
  { name: 'Lead', format: '16:9' },
  { name: 'Portrait', format: '9:16' },
  { name: 'Side A', format: '16:9' },
  { name: 'Side B', format: '16:9' },
] as const;

export function PlacementOpeningEditor({ draft, candidates, busy, onChange, onChooseSlot, onInspect, previewIds, readOnly = false, required = false }: {
  required?: boolean;
  readOnly?: boolean;
  previewIds?: string[];
  onChooseSlot?: (index: number) => void;
  onInspect?: (id: string) => void;
  draft: CurationDraft; candidates: CurationItem[]; busy: boolean; onChange: (draft: CurationDraft) => void;
}) {
  const [mobile, setMobile] = useState(false);
  const opening = readOnly
    ? Array.from({ length: 4 }, (_, index) => previewIds?.[index] ?? '') as CurationOpening
    : draft.openingIds ?? (required ? ['', '', '', ''] as CurationOpening : null);
  const setSlot = (index: number, id: string) => {
    const next = [...(opening ?? ['', '', '', ''])] as CurationOpening;
    next[index] = id;
    onChange({ ...draft, openingIds: next });
  };

  return <section aria-label="Opening videos" data-opening-board className="space-y-2 rounded-xl border border-border bg-surface-2/60 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-semibold text-text-primary">Opening four</h3>
        <p data-opening-unavailable={readOnly ? '' : undefined} role={readOnly ? 'status' : undefined} className="text-xs text-text-secondary">
          {readOnly ? 'Opening four uses the first four in page order until gallery storage is enabled.' : '16:9 · 9:16 · 16:9 · 16:9'}</p></div>
      <div className="flex items-center gap-2">
        {opening ? <Button size="sm" variant="ghost" onClick={() => setMobile(!mobile)}>{mobile ? 'Desktop preview' : 'Mobile preview'}</Button> : null}
        {!readOnly && !required ? <Button size="sm" variant="outline" disabled={busy} onClick={() => onChange({ ...draft, openingIds: opening ? null : ['', '', '', ''] })}>
          {opening ? 'Use existing order' : 'Choose opening videos'}
        </Button> : null}
      </div>
    </div>
    {opening ? <div className={`grid min-w-0 gap-2 ${mobile ? 'grid-cols-2' : 'grid-cols-2 md:aspect-[3/1] md:max-h-[380px] md:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[minmax(0,2fr)_minmax(0,.76fr)_minmax(0,1.12fr)]'}`}>
      {slots.map((slot, index) => {
        const id = opening[index];
        const selected = candidates.find(item => item.id === id);
        const actual = selected ? curationItemFormat(selected) : null;
        const invalid = Boolean(id) && (!selected || actual !== slot.format);
        const options = candidates.filter(item => !draft.excludedIds.includes(item.id) && curationItemFormat(item) === slot.format &&
          (!opening.includes(item.id) || item.id === id));
        const placement = mobile
          ? index === 0 ? 'col-span-2' : index === 1 ? 'row-span-2' : ''
          : index === 0 ? 'col-span-2 md:col-span-1 md:row-span-2'
            : index === 1 ? 'row-span-2 md:col-start-2'
              : `md:col-start-3 ${index === 2 ? 'md:row-start-1' : 'md:row-start-2'}`;
        const mediaSize = index === 1 ? `aspect-[9/16] ${mobile ? '' : 'md:aspect-auto md:h-full'}`
          : `aspect-video ${mobile ? '' : 'md:aspect-auto md:h-full'}`;
        return <div key={index} data-opening-slot={index + 1} data-required-format={slot.format} data-opening-id={id || undefined}
          className={`grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] rounded-xl border bg-surface shadow-sm ${invalid ? 'border-amber-400' : 'border-border'} ${placement}`}>
          <button type="button" disabled={busy || (!onChooseSlot && !selected)} onClick={() => onChooseSlot ? onChooseSlot(index) : selected && onInspect?.(selected.id)}
            aria-label={onChooseSlot ? `Choose opening slot ${index + 1}, ${slot.format}` : `Inspect opening video ${index + 1}`}
            className={`group relative block min-h-0 w-full overflow-hidden bg-surface-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${mediaSize}`}>
            {selected?.thumbUrl ? <Image src={selected.thumbUrl} alt="" fill unoptimized loading="lazy" sizes="(max-width: 767px) 50vw, 38vw"
              className={index === 1 ? 'object-contain' : 'object-cover'} /> : <span className="absolute inset-0 grid place-items-center px-2 text-center text-xs text-text-muted">{id ? 'Video unavailable' : 'Choose video'}</span>}
            <span className="absolute left-2 top-2 rounded-md bg-black/75 px-2 py-1 text-[11px] font-semibold text-white">{index + 1} · {slot.name} · {slot.format}</span>
            {selected ? <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-1 text-[11px] font-medium text-white group-hover:bg-brand">{onChooseSlot ? 'Change' : 'Inspect'} ↗</span> : null}
            {invalid ? <span className="absolute bottom-2 left-2 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">{actual ?? 'Unknown'} → {slot.format}</span> : null}
          </button>
          <div className="flex min-w-0 items-center gap-2 px-2 py-1.5 text-[11px]">
            <p className="min-w-0 flex-1 truncate font-medium text-text-primary">{selected?.engineLabel ?? selected?.engineId ?? (id ? id : 'Empty slot')}</p>
            {selected && onInspect ? <button type="button" disabled={busy} onClick={() => onInspect(selected.id)} className="shrink-0 font-semibold text-brand hover:underline">Details</button> : null}
            {!readOnly ? <details className="relative shrink-0">
              <summary className="cursor-pointer list-none rounded border border-border px-1.5 py-0.5 font-semibold text-text-secondary hover:bg-surface-2">More</summary>
              <div className="absolute bottom-full right-0 z-20 mb-1 w-48 space-y-2 rounded-lg border border-border bg-surface p-2 text-xs shadow-xl">
                <label className="block text-text-secondary">Quick select
                  <select aria-label={`Opening slot ${index + 1}`} disabled={busy} value={id} onChange={event => setSlot(index, event.target.value)}
                    className="mt-1 w-full min-w-0 rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-text-primary">
                    <option value="">Choose a {slot.format} video</option>
                    {options.map(item => <option key={item.id} value={item.id}>{item.engineLabel ?? item.engineId} · {item.prompt.slice(0, 70) || item.id}</option>)}
                  </select>
                </label>
                {selected ? <>
                  <button type="button" disabled={busy} onClick={() => setSlot(index, '')} className="block w-full rounded px-1 py-1 text-left text-text-secondary hover:bg-surface-2">Remove slot {index + 1}</button>
                  <a href={`/admin/video-seo?video=${encodeURIComponent(selected.id)}`} className="block rounded px-1 py-1 text-brand hover:bg-surface-2">Video SEO ↗</a>
                </> : null}
              </div>
            </details> : null}
          </div>
        </div>;
      })}
    </div> : null}
  </section>;
}
