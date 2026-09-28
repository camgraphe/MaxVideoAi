'use client';
import { useState } from 'react';
import clsx from 'clsx';
import type { EditablePlaylist, PlaylistDestination } from './playlist-types';
import { GROUP_LABELS } from './playlist-helpers';

type Props = {
  destinations?: PlaylistDestination[];
  selectedDestinationId?: string | null;
  onSelectDestination?: (id: string) => void;
  groupedPlaylists: {
    runtime: EditablePlaylist[];
    family: EditablePlaylist[];
    model: EditablePlaylist[];
    draft: EditablePlaylist[];
  };
  onSelectPlaylist: (playlistId: string) => void;
  pending: boolean;
  enableCuration?: boolean;
  selectedId: string | null;
  showDraftCollections: boolean;
};
export function PlaylistsSidebar({
  destinations = [],
  selectedDestinationId,
  onSelectDestination,
  groupedPlaylists,
  selectedId,
  onSelectPlaylist,
  pending,
  enableCuration = false,
  showDraftCollections,
}: Props) {
  const [search, setSearch] = useState('');
  if (destinations.length) {
    const matches = (entry: PlaylistDestination) => `${entry.label} ${entry.slug} ${entry.path ?? ''} ${entry.familyId ?? ''} ${entry.modelSlug ?? ''}`
      .toLowerCase().includes(search.toLowerCase());
    const families = destinations.filter(entry => entry.kind === 'family');
    const models = destinations.filter(entry => entry.kind === 'model');
    const others = destinations.filter(entry => entry.kind === 'image' || entry.kind === 'audio');
    const diagnostics = destinations.filter(entry => entry.kind === 'maintenance');
    const entryButton = (entry: PlaylistDestination) => entry.editable ? (
      <button key={entry.id} type="button" data-destination-id={entry.id} aria-pressed={selectedDestinationId === entry.id}
        disabled={pending} onClick={() => onSelectDestination?.(entry.id)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2 aria-pressed:bg-brand/10 disabled:opacity-50">
        <span>{entry.label}</span><span className="text-xs tabular-nums text-text-secondary">{entry.publicCount} public</span>
      </button>
    ) : (
      <div key={entry.id} data-destination-id={entry.id} className="rounded-md border border-amber-200 px-2 py-1.5 text-sm">
        <span className="font-medium">{entry.label}</span><span className="ml-2 text-xs text-amber-800">{entry.status}</span>
        <p className="text-xs text-text-secondary">{entry.warning}</p>
      </div>
    );
    return (
      <aside data-long-inventory className="min-w-0 space-y-4 border-t border-border pt-4 lg:col-start-1 lg:row-start-1 lg:border-r lg:border-t-0 lg:pr-5 lg:pt-0">
        <label className="block text-xs font-medium text-text-secondary">Find a destination
          <input type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Model, family or page…" className="mt-2 h-9 w-full rounded-md border border-border px-3 text-sm" />
        </label>
        <div className="space-y-5 lg:max-h-[65vh] lg:overflow-y-auto">
          <section id="playlist-families" className="space-y-2">
            <h2 className="text-xs font-semibold uppercase text-text-secondary">Families</h2>
            <span id="playlist-models" className="sr-only">Models by family</span>
            {families.map(family => {
              const familyModels = models.filter(model => model.familyId === family.familyId && matches(model));
              if (!matches(family) && !familyModels.length) return null;
              return <div key={family.id} className="space-y-1">{entryButton(family)}
                <div className="ml-3 border-l border-border pl-2">{familyModels.map(entryButton)}</div>
              </div>;
            })}
          </section>
          <section id="playlist-image-audio" className="space-y-1"><h2 className="text-xs font-semibold uppercase text-text-secondary">Image / audio</h2>
            {others.filter(matches).map(entryButton)}
          </section>
          {diagnostics.length ? <section className="space-y-1"><h2 className="text-xs font-semibold uppercase text-text-secondary">Unconnected collections</h2>
            {diagnostics.filter(matches).map(entryButton)}</section> : null}
        </div>
      </aside>
    );
  }
  const groups = Object.entries(groupedPlaylists).filter(([key]) => key !== 'draft' || showDraftCollections);
  return (
    <aside className="min-w-0 border-border lg:border-r lg:pr-5">
      <label className="text-xs font-medium text-text-secondary">
        Find a destination
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Model, family or page…"
          className="mb-4 mt-2 h-9 w-full rounded-md border border-border px-3 text-sm"
        />
      </label>
      <div className="max-h-[65vh] space-y-5 overflow-y-auto" aria-label="Site destinations">
        {groups.map(([key, entries]) => {
          const matches = entries.filter((entry) =>
            `${entry.name} ${entry.drivesRoute ?? ''} ${entry.slug}`.toLowerCase().includes(search.toLowerCase()),
          );
          if (!matches.length) return null;
          return (
            <section key={key}>
              <h2 className="mb-2 text-xs font-medium text-text-secondary">
                {key === 'runtime'
                  ? GROUP_LABELS.runtime
                  : key === 'family'
                    ? 'Model families'
                    : key === 'model'
                      ? 'Models'
                      : 'Other collections'}
              </h2>
              <div className="space-y-1">
                {matches.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    disabled={pending}
                    onClick={() => onSelectPlaylist(entry.id)}
                    aria-pressed={selectedId === entry.id}
                    className={clsx(
                      'w-full rounded-md px-3 py-2.5 text-left disabled:opacity-50',
                      selectedId === entry.id ? 'bg-brand/10 text-brand' : 'hover:bg-surface-2',
                    )}
                  >
                    <span className="flex justify-between gap-2 text-sm font-medium">
                      <span className="truncate">{entry.name}</span>
                      {!enableCuration || !['examplesHub', 'family', 'model'].includes(entry.surfaceRole) ? (
                        <span className="text-xs tabular-nums">{entry.itemCount}</span>
                      ) : null}
                    </span>
                    <span className="mt-1 block truncate text-xs text-text-secondary">
                      {entry.drivesRoute ?? 'No public page'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        {!groups.some(([, entries]) =>
          entries.some((entry) =>
            `${entry.name} ${entry.drivesRoute ?? ''} ${entry.slug}`.toLowerCase().includes(search.toLowerCase()),
          ),
        ) ? (
          <p className="text-sm text-text-secondary">No destinations match.</p>
        ) : null}
      </div>
    </aside>
  );
}
