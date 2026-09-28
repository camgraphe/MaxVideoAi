'use client';

import { useCallback, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import { authFetch } from '@/lib/authFetch';
import type { PlaylistDestination } from './playlist-types';

type Args = {
  busy: MutableRefObject<boolean>;
  curationState: { dirty: boolean; busy: boolean };
  destinations: PlaylistDestination[];
  isItemsDirty: boolean;
  metadataDirty: boolean;
  refreshPlaylistItems: (playlistId: string) => Promise<void>;
  runAction: (action: () => Promise<void>) => void;
  setDestinations: Dispatch<SetStateAction<PlaylistDestination[]>>;
  setSelectedDestinationId: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setFeedback: Dispatch<SetStateAction<string | null>>;
};

export function usePlaylistDestinationActions({ busy, curationState, destinations, isItemsDirty, metadataDirty,
  refreshPlaylistItems, runAction, setDestinations, setSelectedDestinationId, setError, setFeedback }: Args) {
  const refreshProjection = useCallback(async () => {
    try {
      const response = await authFetch('/api/admin/playlists');
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !Array.isArray(data.destinations)) throw new Error('Destination inventory unavailable');
      setDestinations(data.destinations as PlaylistDestination[]);
    } catch (error) {
      setError(`Content saved, but destination counts could not refresh: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [setDestinations, setError]);

  const handleSelectPlaylist = useCallback((playlistId: string, destinationId?: string) => {
    if (busy.current || curationState.busy) return;
    if ((isItemsDirty || curationState.dirty || metadataDirty) && !window.confirm('Discard unsaved changes and change destination?')) return;
    setFeedback(null);
    setError(null);
    runAction(async () => {
      try {
        await refreshPlaylistItems(playlistId);
        setSelectedDestinationId(destinationId ?? destinations.find(entry => entry.playlistId === playlistId)?.id ?? null);
      } catch (error) {
        console.error('[PlaylistsManager] load items failed', error);
        setError(error instanceof Error ? error.message : 'Failed to load collection items');
      }
    });
  }, [busy, curationState, destinations, isItemsDirty, metadataDirty, refreshPlaylistItems, runAction,
    setError, setFeedback, setSelectedDestinationId]);

  const handleSelectDestination = useCallback((destinationId: string) => {
    const destination = destinations.find(entry => entry.id === destinationId);
    if (destination?.playlistId && destination.editable) handleSelectPlaylist(destination.playlistId, destinationId);
  }, [destinations, handleSelectPlaylist]);

  return { handleSelectPlaylist, handleSelectDestination, refreshProjection };
}
