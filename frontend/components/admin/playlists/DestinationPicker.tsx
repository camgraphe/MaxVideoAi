'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlaylistDestination } from './playlist-types';

type Props = {
  destinations: PlaylistDestination[];
  selectedId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onCreateMissingModelPlaylists: () => void;
  createMissingModelPlaylistsDisabled: boolean;
};

function matches(destination: PlaylistDestination, query: string) {
  return `${destination.label} ${destination.slug} ${destination.path ?? ''} ${destination.familyId ?? ''} ${destination.modelSlug ?? ''}`
    .toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

export function DestinationPicker({ destinations, selectedId, disabled, onSelect,
  onCreateMissingModelPlaylists, createMissingModelPlaylistsDisabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const current = destinations.find(destination => destination.id === selectedId) ?? null;
  const diagnosticCount = destinations.filter(destination => destination.status !== 'connected').length;
  const missingModelCount = destinations.filter(destination => destination.kind === 'model' && destination.status === 'missing').length;

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const groups = useMemo(() => {
    const filtered = destinations.filter(destination => matches(destination, query.trim()));
    const families = filtered.filter(destination => destination.kind === 'family');
    const models = filtered.filter(destination => destination.kind === 'model');
    const groupedFamilyIds = new Set(families.map(destination => destination.familyId));
    const familyModels = models.filter(destination => groupedFamilyIds.has(destination.familyId));
    return [
      { id: 'main', label: 'Examples and starter', items: filtered.filter(destination => destination.kind === 'examples' || destination.kind === 'starter') },
      { id: 'families', label: 'Families and models', items: [...families.flatMap(family => [family, ...familyModels.filter(model => model.familyId === family.familyId)]),
        ...models.filter(model => !groupedFamilyIds.has(model.familyId))] },
      { id: 'other', label: 'Image and audio', items: filtered.filter(destination => destination.kind === 'image' || destination.kind === 'audio') },
      { id: 'maintenance', label: 'Unconnected and historical collections', items: filtered.filter(destination => destination.kind === 'maintenance') },
    ];
  }, [destinations, query]);

  function close() {
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }

  const renderEntry = (entry: PlaylistDestination) => entry.editable ? (
    <button key={entry.id} type="button" data-destination-id={entry.id} aria-current={selectedId === entry.id ? 'true' : undefined}
      disabled={disabled} onClick={() => { onSelect(entry.id); close(); }}
      className="flex w-full min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand aria-current:bg-brand/10 disabled:opacity-50">
      <span className="min-w-0"><span className="block truncate font-medium">{entry.label}</span>
        <span className="block truncate text-xs text-text-secondary">{entry.path ?? entry.slug}</span></span>
      <span className="shrink-0 text-xs tabular-nums text-text-secondary">{entry.publicCount} public</span>
    </button>
  ) : (
    <div key={entry.id} data-destination-id={entry.id} data-missing-destination={entry.status === 'missing' ? entry.id : undefined}
      className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2"><span className="font-medium">{entry.label}</span>
        <span className="text-xs text-amber-900">{entry.kind === 'model' && entry.status === 'missing' ? 'Collection missing' : entry.status}</span></div>
      <p className="mt-1 text-xs text-text-secondary">{entry.warning ?? `Collection ${entry.slug} is unavailable.`}</p>
      {entry.kind !== 'model' ? <a href="#playlist-maintenance" className="mt-1 inline-block text-xs font-medium text-brand underline" onClick={() => {
        const details = document.getElementById('playlist-maintenance') as HTMLDetailsElement | null;
        if (details) details.open = true;
        close();
      }}>
        Open collection maintenance
      </a> : null}
    </div>
  );

  return (
    <section data-destination-picker className="relative z-40 rounded-xl border border-border bg-surface p-3 shadow-sm sm:p-4"
      onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); close(); } }}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 basis-full sm:flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted">Choose a gallery</span>
          <button ref={triggerRef} type="button" aria-haspopup="dialog" aria-expanded={open} disabled={disabled}
            onClick={() => setOpen(previous => !previous)}
            className="mt-1 flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50">
            <span className="min-w-0"><span className="block truncate text-sm font-semibold text-text-primary">{current?.label ?? 'Choose a destination'}</span>
              <span className="block truncate text-xs text-text-secondary">{current ? `${current.kind} · ${current.publicCount} public media` : `${destinations.length} destinations`}</span></span>
            <span className="shrink-0 text-xs font-semibold text-brand">Change gallery <span aria-hidden="true">⌄</span></span>
          </button>
        </div>
        {current?.path ? <a data-live-page href={current.path} target="_blank" rel="noreferrer"
          className="self-end rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">Open live page ↗</a> : null}
        {diagnosticCount ? <span className="self-end rounded-full border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-900">{diagnosticCount} to review</span> : null}
      </div>
      {open ? <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[min(70vh,560px)] overflow-y-auto rounded-xl border border-border bg-surface p-3 shadow-xl"
        role="dialog" aria-label="Site destinations">
        <label className="block text-xs font-medium text-text-secondary">Find a destination
          <input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Family, model or page…" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </label>
        {missingModelCount ? <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-950">
          <span>{missingModelCount} model {missingModelCount === 1 ? 'page needs' : 'pages need'} an editable collection</span>
          <button data-create-missing-model-collections type="button"
            disabled={disabled || createMissingModelPlaylistsDisabled}
            onClick={() => { close(); onCreateMissingModelPlaylists(); }}
            className="rounded-md border border-amber-300 bg-white px-2.5 py-1.5 font-semibold text-amber-950 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50">
            Create {missingModelCount} empty model {missingModelCount === 1 ? 'collection' : 'collections'}
          </button>
        </div> : null}
        <div className="mt-3 space-y-3">
          {groups.map(group => group.items.length ? <section key={group.id} data-destination-group={group.id}
            data-destination-diagnostics={group.id === 'maintenance' ? '' : undefined}>
            <h2 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{group.label}</h2>
            <div className="space-y-1">{group.items.map(renderEntry)}</div>
          </section> : null)}
          {!groups.some(group => group.items.length) ? <p className="px-2 py-4 text-sm text-text-secondary">No destinations match.</p> : null}
        </div>
      </div> : null}
    </section>
  );
}
