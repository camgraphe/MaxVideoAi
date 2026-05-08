"use client";

import type { ComponentProps } from 'react';
import { PlaylistDetailsPanel } from '@/components/admin/playlists/PlaylistDetailsPanel';
import { PlaylistItemsSection } from '@/components/admin/playlists/PlaylistItemsSection';
import type { EditablePlaylist } from '@/components/admin/playlists/playlist-types';

type PlaylistItemsSectionProps = ComponentProps<typeof PlaylistItemsSection>;

type PlaylistsManagerSelectionPanelProps = PlaylistItemsSectionProps & {
  onDeletePlaylist: (playlistId: string) => void;
  onFieldChange: (playlistId: string, field: 'name' | 'slug' | 'description', value: string) => void;
  onSavePlaylist: (playlistId: string) => void;
  onSeedFamilyPlaylist: (familyId: string) => void;
  playlist: EditablePlaylist | null;
};

export function PlaylistsManagerSelectionPanel({
  playlist,
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
        Select a collection from the left rail to start curating.
      </div>
    );
  }

  return (
    <>
      <PlaylistDetailsPanel
        isPending={isPending}
        onDeletePlaylist={onDeletePlaylist}
        onFieldChange={onFieldChange}
        onSavePlaylist={onSavePlaylist}
        onSeedFamilyPlaylist={onSeedFamilyPlaylist}
        playlist={playlist}
      />
      <PlaylistItemsSection isPending={isPending} {...itemsSectionProps} />
    </>
  );
}
