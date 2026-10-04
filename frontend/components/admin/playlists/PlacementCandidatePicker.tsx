'use client';
import { useEffect, useRef, useState } from 'react';
import { getExampleFamilyIds, getExampleFamilyLabel, getExampleFamilyModelSlugs } from '@/lib/model-families';
import { authFetch } from '@/lib/authFetch';
import { curationItemFormat, type CurationDraft, type CurationItem } from '@/lib/admin/playlist-curation';
import { Button } from '@/components/ui/Button';
import { PlacementMediaList } from './PlacementMediaList';

type Page = { items: CurationItem[]; total: number; nextCursor: string | null };
export function PlacementCandidatePicker({ playlistId, initialPage, draft, busy, slot, onItems, onAdd, onExclude, onChooseSlot, onCancelSlot }: {
  playlistId: string; initialPage?: Page; draft: CurationDraft; busy: boolean; slot: number | null;
  onCancelSlot: () => void;
  onItems: (items: CurationItem[]) => void; onAdd: (id: string) => void;
  onExclude: (id: string) => void; onChooseSlot: (id: string) => void;
}) {
  const [page, setPage] = useState<Page>(initialPage ?? { items: [], total: 0, nextCursor: null });
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('');
  const [model, setModel] = useState('');
  const [format, setFormat] = useState('');
  const [exactId, setExactId] = useState('');
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef(true);
  const section = useRef<HTMLElement>(null);
  useEffect(() => { if (slot !== null) section.current?.scrollIntoView?.({ block: 'start' }); }, [slot]);
  const requiredFormat = slot === null ? format : slot === 1 ? '9:16' : '16:9';
  const cursor = cursors.at(-1);
  useEffect(() => {
    if (first.current && initialPage && slot === null) { first.current = false; return; }
    first.current = false;
    let active = true;
    setLoading(true); setError(null);
    const params = new URLSearchParams({ limit: '48' });
    if (query) params.set('q', query);
    if (family) params.set('familyId', family);
    if (model) params.set('modelSlug', model);
    if (requiredFormat) params.set('format', requiredFormat);
    if (exactId) params.set('exactId', exactId);
    if (cursor) params.set('cursor', cursor);
    void authFetch(`/api/admin/playlists/${playlistId}/curation/candidates?${params}`).then(async response => {
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? 'Unable to load candidates.');
      if (active) { setPage(data); onItems(data.items); }
    }).catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [playlistId, query, family, model, requiredFormat, exactId, cursor, onItems, initialPage, slot]);
  // Cursor tokens are bound to filters; never reuse a previous search's cursor.
  useEffect(() => { setCursors([null]); }, [slot]);
  const filter = (setter: (value: string) => void, value: string) => { setter(value); setCursors([null]); };
  const choose = (id: string) => {
    if (draft.excludedIds.includes(id) || draft.openingIds?.includes(id)) return;
    if (slot !== null) {
      const item = page.items.find(item => item.id === id);
      if (item && curationItemFormat(item) === requiredFormat) onChooseSlot(id);
    } else if (!draft.orderedIds.includes(id)) onAdd(id);
  };
  return <section ref={section} aria-label="Eligible media" className="space-y-3">
    <h3 className="text-sm font-semibold">{slot === null ? 'Eligible videos' : `Choose opening slot ${slot + 1} · ${requiredFormat}`} · {page.total}</h3>
    {slot !== null ? <Button size="sm" variant="outline" onClick={onCancelSlot}>Finish choosing opening</Button> : null}
    <div className="grid gap-2 sm:grid-cols-2">
      <input aria-label="Search eligible media" placeholder="Search model, prompt or video ID" value={query} onChange={e => filter(setQuery, e.target.value)} className="min-w-0 rounded border border-border p-2 text-sm" />
      <select aria-label="Filter family" value={family} onChange={e => { filter(setFamily, e.target.value); setModel(''); }} className="min-w-0 rounded border border-border p-2 text-sm"><option value="">All families</option>{getExampleFamilyIds().map(id => <option key={id} value={id}>{getExampleFamilyLabel(id) ?? id}</option>)}</select>
      <input list="curation-models" aria-label="Filter model slug" placeholder="Model slug (within this destination)" value={model} onChange={e => filter(setModel, e.target.value)} className="min-w-0 rounded border border-border p-2 text-sm" />
      <datalist id="curation-models">{(family ? getExampleFamilyModelSlugs(family) : getExampleFamilyIds().flatMap(getExampleFamilyModelSlugs)).map(slug => <option key={slug} value={slug} />)}</datalist>
      <select aria-label="Filter format" disabled={slot !== null} value={requiredFormat} onChange={e => filter(setFormat, e.target.value)} className="rounded border border-border p-2 text-sm"><option value="">All formats</option><option>16:9</option><option>9:16</option></select>
    </div>
    <details className="text-xs text-text-secondary"><summary className="cursor-pointer">Advanced · exact video ID</summary>
      <input aria-label="Exact video ID" placeholder="Exact video ID" value={exactId} onChange={e => filter(setExactId, e.target.value)} className="mt-2 w-full min-w-0 rounded border border-border p-2 text-sm" />
    </details>
    {error ? <p role="alert">{error}</p> : null}
    <PlacementMediaList items={page.items} busy={busy || loading || Boolean(error)} onAdd={choose}
      addLabel={slot === null ? 'Add to selection' : 'Use for opening'}
      canAdd={id => !draft.excludedIds.includes(id) && !draft.openingIds?.includes(id) &&
        (slot !== null ? curationItemFormat(page.items.find(item => item.id === id)!) === requiredFormat : !draft.orderedIds.includes(id))}
      canExclude={id => !draft.openingIds?.includes(id) && !draft.excludedIds.includes(id)}
      onExclude={onExclude} />
    <div className="flex items-center gap-3 text-sm">
      <Button size="sm" disabled={loading || cursors.length === 1} onClick={() => setCursors(cursors.slice(0,-1))}>Previous candidates</Button>
      <span role="status">{loading ? 'Loading…' : `Candidate page ${cursors.length}`}</span>
      <Button size="sm" disabled={loading || !page.nextCursor || Boolean(error)} onClick={() => setCursors([...cursors, page.nextCursor])}>Next candidates</Button>
    </div>
  </section>;
}
