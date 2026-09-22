"use client";
import { useState } from 'react';
import clsx from 'clsx';
import type { EditablePlaylist, FamilyPlaylistHelperCard, ModelPlaylistHelperCard } from './playlist-types';
import { GROUP_LABELS } from './playlist-helpers';

type Props = {
  emptyFamilyCount: number;
  familyHelpers: FamilyPlaylistHelperCard[];
  modelHelpers: ModelPlaylistHelperCard[];
  groupedPlaylists: {
    runtime: EditablePlaylist[];
    family: EditablePlaylist[];
    model: EditablePlaylist[];
    draft: EditablePlaylist[];
  };
  onCreateMissingFamilyPlaylists: (familyId?: string | null) => void;
  onCreateMissingModelPlaylists: (modelSlug?: string | null) => void;
  onSeedFamilyPlaylist: (familyId: string) => void;
  onSeedModelPlaylist: (modelSlug: string) => void;
  onSelectPlaylist: (playlistId: string) => void;
  onToggleFamilyCollections: () => void;
  onToggleModelCollections: () => void;
  pending: boolean;
  selectedId: string | null;
  showDraftCollections: boolean;
  showFamilyCollections: boolean;
  showModelCollections: boolean;
};
export function PlaylistsSidebar({ groupedPlaylists, selectedId, onSelectPlaylist, pending, showDraftCollections }: Props) {
  const [search, setSearch] = useState('');
  const groups = Object.entries(groupedPlaylists).filter(([key]) => key !== 'draft' || showDraftCollections);
  return <aside className="min-w-0 border-border xl:border-r xl:pr-5">
    <label className="text-xs font-medium text-text-secondary">Find a destination<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Model, family or page…" className="mb-4 mt-2 h-9 w-full rounded-md border border-border px-3 text-sm" /></label>
    <div className="max-h-[65vh] space-y-5 overflow-y-auto" aria-label="Site destinations">
      {groups.map(([key, entries]) => {
        const matches = entries.filter(entry => `${entry.name} ${entry.drivesRoute ?? ''} ${entry.slug}`.toLowerCase().includes(search.toLowerCase()));
        if (!matches.length) return null;
        return <section key={key}><h2 className="mb-2 text-xs font-medium text-text-secondary">{key === 'runtime' ? GROUP_LABELS.runtime : key === 'family' ? 'Model families' : key === 'model' ? 'Models' : 'Other collections'}</h2><div className="space-y-1">{matches.map(entry => <button type="button" key={entry.id} disabled={pending} onClick={() => onSelectPlaylist(entry.id)} aria-pressed={selectedId === entry.id} className={clsx('w-full rounded-md px-3 py-2.5 text-left disabled:opacity-50', selectedId === entry.id ? 'bg-brand/10 text-brand' : 'hover:bg-surface-2')}><span className="flex justify-between gap-2 text-sm font-medium"><span className="truncate">{entry.name}</span><span className="text-xs tabular-nums">{entry.itemCount}</span></span><span className="mt-1 block truncate text-xs text-text-secondary">{entry.drivesRoute ?? 'No public page'}</span></button>)}</div></section>;
      })}
      {!groups.some(([, entries]) => entries.some(entry => `${entry.name} ${entry.drivesRoute ?? ''} ${entry.slug}`.toLowerCase().includes(search.toLowerCase()))) ? <p className="text-sm text-text-secondary">No destinations match.</p> : null}
    </div>
  </aside>;
}
