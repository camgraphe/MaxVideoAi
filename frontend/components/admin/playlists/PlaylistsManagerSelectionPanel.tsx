'use client';

import { PlacementEditor } from './PlacementEditor';
import type { ComponentProps } from 'react';
import { PlaylistDetailsPanel } from '@/components/admin/playlists/PlaylistDetailsPanel';
import { PlaylistItemsSection } from '@/components/admin/playlists/PlaylistItemsSection';
import type { EditablePlaylist, PlaylistDestination } from '@/components/admin/playlists/playlist-types';

type PlaylistItemsSectionProps = ComponentProps<typeof PlaylistItemsSection>;

type PlaylistsManagerSelectionPanelProps = PlaylistItemsSectionProps & {
  destination?: PlaylistDestination | null;
  enableCuration?: boolean;
  onCurationStateChange?: (state: { dirty: boolean; busy: boolean }) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onFieldChange: (playlistId: string, field: 'name' | 'slug' | 'description', value: string) => void;
  onSavePlaylist: (playlistId: string) => void;
  onSeedFamilyPlaylist: (familyId: string) => void;
  playlist: EditablePlaylist | null;
};

export function PlaylistsManagerSelectionPanel({
  destination,
  playlist,
  enableCuration = false,
  onCurationStateChange,
  isPending,
  onDeletePlaylist,
  onFieldChange,
  onSavePlaylist,
  onSeedFamilyPlaylist,
  ...itemsSectionProps
}: PlaylistsManagerSelectionPanelProps) {
  if (!playlist) {
    return (
      <div className="rounded-card border border-dashed border-hairline bg-surface p-10 text-center text-sm text-text-secondary">
        Select a connected destination to start curating. Missing and historical collections are listed below for diagnosis.
      </div>
    );
  }

  const usesCuration = enableCuration && ['examplesHub', 'family', 'model'].includes(playlist.surfaceRole);
  const legacyEditor = (
    <>
      {playlist.surfaceRole === 'family' ? (
        <p className="text-xs text-text-secondary">
          This list controls the editorial first positions. The existing family feed may add eligible media afterwards.
        </p>
      ) : null}
      <PlaylistItemsSection isPending={isPending} {...itemsSectionProps} />
      <details className="border-t border-border pt-4">
        <summary className="cursor-pointer text-xs font-medium text-text-secondary">
          Collection details and maintenance
        </summary>
        <PlaylistDetailsPanel
          isPending={isPending || itemsSectionProps.isItemsDirty}
          onDeletePlaylist={onDeletePlaylist}
          onFieldChange={onFieldChange}
          onSavePlaylist={onSavePlaylist}
          onSeedFamilyPlaylist={onSeedFamilyPlaylist}
          playlist={playlist}
        />
      </details>
    </>
  );
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-semibold">{destination?.label ?? playlist.name}</h2>
          <p className="mt-1 text-xs text-text-secondary">
            {destination?.path ?? playlist.drivesRoute ?? 'Collection without a public page'}
            {destination ? ` · ${destination.status} · ${destination.publicCount} public media` :
              !usesCuration ? ` · ${playlist.siteVisibleCount} public media` : ''}
          </p>
          {destination ? <p className="mt-1 text-xs text-text-secondary">Source chain: {destination.sourceSlugs.join(' → ')}</p> : null}
        </div>
        {(destination?.path ?? playlist.drivesRoute) ? (
          <a
            href={destination?.path ?? playlist.drivesRoute ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            Open live page
          </a>
        ) : null}
      </header>
      {usesCuration ? (
        <PlacementEditor
          key={playlist.id}
          playlistId={playlist.id}
          onStateChange={onCurationStateChange}
          fallback={legacyEditor}
        />
      ) : (
        legacyEditor
      )}
    </>
  );
}
