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
  onCurationSaved?: () => void | Promise<void>;
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
  onCurationSaved,
  isPending,
  onDeletePlaylist,
  onFieldChange,
  onSavePlaylist,
  onSeedFamilyPlaylist,
  ...itemsSectionProps
}: PlaylistsManagerSelectionPanelProps) {
  if (!playlist || (destination && !destination.editable)) {
    return (
      <div className="rounded-card border border-dashed border-hairline bg-surface p-10 text-center text-sm text-text-secondary">
        {destination?.warning ?? 'Select a connected destination to start curating. Missing and historical collections are listed below for diagnosis.'}
      </div>
    );
  }

  const usesCuration = enableCuration && (destination
    ? ['examples', 'family', 'model'].includes(destination.kind)
    : ['examplesHub', 'family', 'model'].includes(playlist.surfaceRole));
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
      {usesCuration ? (
        <PlacementEditor
          key={`${destination?.id ?? playlist.id}:${playlist.id}`}
          playlistId={playlist.id}
          onStateChange={onCurationStateChange}
          onSaved={onCurationSaved}
          fallback={legacyEditor}
        />
      ) : (
        legacyEditor
      )}
      {destination?.sourceSlugs.length ? <details data-source-chain className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
        <summary className="cursor-pointer font-medium">Source details</summary>
        <p className="pt-2">Source chain: {destination.sourceSlugs.join(' → ')}</p>
      </details> : null}
    </>
  );
}
