'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { curationItemFormat, type CurationDraft, type CurationItem, type CurationOpening } from '@/lib/admin/playlist-curation';

const slots = ['Main video · 16:9', 'Vertical video · 9:16', 'Side video · 16:9', 'Side video · 16:9'];
export function PlacementOpeningEditor({ draft, candidates, busy, onChange, onChooseSlot, required = false }: {
  required?: boolean;
  onChooseSlot?: (index: number) => void;
  draft: CurationDraft; candidates: CurationItem[]; busy: boolean; onChange: (draft: CurationDraft) => void;
}) {
  const [search, setSearch] = useState('');
  const [mobile, setMobile] = useState(false);
  const opening = draft.openingIds ?? (required ? ['', '', '', ''] as CurationOpening : null);
  const setSlot = (index: number, id: string) => {
    const next = [...(opening ?? ['', '', '', ''])] as CurationOpening;
    next[index] = id;
    onChange({...draft, openingIds: next});
  };
  return <section aria-label="Opening videos" className="space-y-4 rounded-xl border border-border bg-surface-2/40 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-sm font-semibold">Four videos to open the gallery</h3>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-text-secondary">A landscape lead, one vertical video and two landscape previews. These videos count within the first page and keep their original format in the player.</p></div>
      {!required ? <Button size="sm" variant="outline" disabled={busy} onClick={() => onChange({...draft, openingIds: opening ? null : ['', '', '', '']})}>
        {opening ? 'Use existing order' : 'Choose opening videos'}
      </Button> : null}
    </div>
    {opening ? <>
      <label className="block text-xs text-text-secondary">Find an opening video
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Model, prompt or video ID"
          className="mt-1 block w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {slots.map((label, index) => {
          const format = index === 1 ? '9:16' : '16:9';
          const selected = candidates.find(item => item.id === opening[index]);
          const options = candidates.filter(item => !draft.excludedIds.includes(item.id) && curationItemFormat(item) === format &&
            (!opening.includes(item.id) || item.id === opening[index]) && `${item.id} ${item.engineLabel} ${item.prompt}`.toLowerCase().includes(search.toLowerCase()));
          if (selected && !options.some(item => item.id === selected.id)) options.unshift(selected);
          return <label key={index} className="text-xs font-medium">{index + 1}. {label}
            <select aria-label={`Opening slot ${index + 1}`} disabled={busy} value={opening[index]} onChange={event => setSlot(index,event.target.value)}
              className="mt-1 block w-full min-w-0 rounded-lg border border-border bg-bg px-3 py-2 text-sm">
              <option value="">Choose a {format} video</option>
              {options.map(item => <option key={item.id} value={item.id}>{item.engineLabel ?? item.engineId} · {item.prompt.slice(0,90) || item.id}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onChooseSlot?.(index)}>Browse slot {index + 1}</Button>
            {selected ? <><span className="block">{selected.engineLabel ?? selected.engineId} · {curationItemFormat(selected) ?? 'Unknown format'}</span><Button size="sm" variant="ghost" disabled={busy} onClick={() => setSlot(index, '')}>Remove slot {index + 1}</Button></> : null}
            {selected ? <a className="mt-1 inline-block text-xs text-brand underline underline-offset-4" href={`/admin/video-seo?video=${encodeURIComponent(selected.id)}`}>Publication &amp; video SEO ↗</a> : null}
          </label>;
        })}
      </div>
      <div className="flex items-center justify-between text-xs"><span className="text-text-secondary">Opening preview · original videos remain intact</span>
        <Button size="sm" variant="ghost" onClick={() => setMobile(!mobile)}>{mobile ? 'Desktop preview' : 'Mobile preview'}</Button></div>
      <div className={`mx-auto grid w-full gap-1 overflow-hidden rounded-lg ${mobile ? 'max-w-[280px] grid-cols-2' : 'grid-cols-[3.56fr_1.125fr_2fr]'}`}>
        {opening.map((id,index) => {
          const item = candidates.find(candidate => candidate.id===id);
          return <div key={index} className={`relative overflow-hidden rounded bg-surface-2 ${mobile ? index===0 ? 'col-span-2 aspect-video' : index===1 ? 'row-span-2 aspect-[9/16]' : 'aspect-[2/1]' : index<2 ? 'row-span-2' : 'col-start-3 aspect-[2/1]'}`}>
            {item?.thumbUrl ? <Image src={item.thumbUrl} alt="" fill unoptimized sizes="(max-width: 640px) 50vw, 400px" className="object-cover" /> : null}
            <span className="relative m-2 inline-flex rounded bg-black/60 px-2 py-1 text-[10px] text-white">{index+1} · {index===1?'9:16':index===0?'16:9':'2:1 preview'}</span>
          </div>;
        })}
      </div>
    </> : null}
  </section>;
}
