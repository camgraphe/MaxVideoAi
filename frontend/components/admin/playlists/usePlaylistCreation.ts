'use client';
import { useState, useCallback, type FormEvent } from 'react';
import { authFetch } from '@/lib/authFetch';
import type { PlaylistSummary } from './playlist-types';

type Options = {
  runAction: (action: () => Promise<void>) => void;
  refreshPlaylistsState: (id: string) => Promise<unknown>;
  setFeedback: (message: string | null) => void;
  setError: (message: string | null) => void;
};
export function usePlaylistCreation({ runAction, refreshPlaylistsState, setFeedback, setError }: Options) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const handleCreatePlaylist = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const name = createName.trim();
      const slug = createSlug.trim();
      if (!name || !slug) return;

      runAction(async () => {
        try {
          setFeedback(null);
          setError(null);
          const res = await authFetch('/api/admin/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              slug,
              description: createDescription.trim() ? createDescription.trim() : null,
            }),
          });
          const json = await res.json().catch(() => ({ ok: false }));
          if (!res.ok || !json?.ok || !json.playlist) {
            throw new Error(json?.error ?? `Failed to create collection (${res.status})`);
          }

          const playlist = json.playlist as PlaylistSummary;
          await refreshPlaylistsState(playlist.id);
          setShowCreateForm(false);
          setCreateName('');
          setCreateSlug('');
          setCreateDescription('');
          setFeedback('Collection created');
        } catch (createError) {
          console.error('[PlaylistsManager] create playlist failed', createError);
          setError(createError instanceof Error ? createError.message : 'Failed to create collection');
        }
      });
    },
    [createDescription, createName, createSlug, refreshPlaylistsState, runAction, setError, setFeedback],
  );

  return {
    showCreateForm,
    setShowCreateForm,
    createName,
    setCreateName,
    createSlug,
    setCreateSlug,
    createDescription,
    setCreateDescription,
    handleCreatePlaylist,
  };
}
