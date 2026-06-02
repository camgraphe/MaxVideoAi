import { useCallback, type Dispatch, type SetStateAction, type TransitionStartFunction } from 'react';
import { authFetch } from '@/lib/authFetch';
import type { PlaylistSummary } from './playlist-types';

type HelperActionOptions = {
  feedback: string;
  logLabel: string;
  payload: Record<string, unknown>;
  preferredId?: (json: Record<string, unknown>) => string | null;
};

export function usePlaylistHelperActions({
  refreshPlaylistsState,
  selectedId,
  setError,
  setFeedback,
  startTransition,
}: {
  refreshPlaylistsState: (preferredPlaylistId?: string | null) => Promise<unknown>;
  selectedId: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  setFeedback: Dispatch<SetStateAction<string | null>>;
  startTransition: TransitionStartFunction;
}) {
  const runHelperAction = useCallback(
    ({ feedback, logLabel, payload, preferredId }: HelperActionOptions) => {
      startTransition(async () => {
        try {
          setFeedback(null);
          setError(null);
          const res = await authFetch('/api/admin/playlists/helpers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const json = (await res.json().catch(() => ({ ok: false }))) as Record<string, unknown>;
          if (!res.ok || json.ok !== true) {
            throw new Error(typeof json.error === 'string' ? json.error : `${logLabel} failed (${res.status})`);
          }
          await refreshPlaylistsState(preferredId?.(json) ?? selectedId);
          setFeedback(feedback);
        } catch (helperError) {
          console.error(`[PlaylistsManager] ${logLabel} failed`, helperError);
          setError(helperError instanceof Error ? helperError.message : `${logLabel} failed`);
        }
      });
    },
    [refreshPlaylistsState, selectedId, setError, setFeedback, startTransition]
  );

  const getCreatedPlaylistId = useCallback((json: Record<string, unknown>, key: 'familyId' | 'modelSlug', value?: string | null) => {
    if (!value || !Array.isArray(json.playlists)) return null;
    return (
      (json.playlists as PlaylistSummary[]).find((playlist) => {
        if (key === 'familyId') return playlist.familyId === value;
        return playlist.modelSlug === value;
      })?.id ?? null
    );
  }, []);

  return {
    handleCreateMissingFamilyPlaylists: (preferredFamilyId?: string | null) =>
      runHelperAction({
        feedback: 'Family playlists synced',
        logLabel: 'create missing family playlists',
        payload: { action: 'create-missing-family-playlists' },
        preferredId: (json) => getCreatedPlaylistId(json, 'familyId', preferredFamilyId),
      }),
    handleCreateMissingModelPlaylists: (preferredModelSlug?: string | null) =>
      runHelperAction({
        feedback: 'Model playlists synced',
        logLabel: 'create missing model playlists',
        payload: { action: 'create-missing-model-playlists' },
        preferredId: (json) => getCreatedPlaylistId(json, 'modelSlug', preferredModelSlug),
      }),
    handleSeedAllFamilyPlaylists: () =>
      runHelperAction({
        feedback: 'All family playlists seeded from the current live order',
        logLabel: 'seed all family playlists',
        payload: { action: 'seed-all-family-playlists' },
      }),
    handleSeedAllModelPlaylists: () =>
      runHelperAction({
        feedback: 'All model playlists seeded from the current live order',
        logLabel: 'seed all model playlists',
        payload: { action: 'seed-all-model-playlists' },
      }),
    handleSeedFamilyPlaylist: (familyId: string) =>
      runHelperAction({
        feedback: `Family playlist seeded for ${familyId}`,
        logLabel: 'seed family playlist',
        payload: { action: 'seed-family-playlist', familyId },
        preferredId: (json) => ((json.result as { playlist?: { id?: string } } | undefined)?.playlist?.id ?? null),
      }),
    handleSeedModelPlaylist: (modelSlug: string) =>
      runHelperAction({
        feedback: `Model playlist seeded for ${modelSlug}`,
        logLabel: 'seed model playlist',
        payload: { action: 'seed-model-playlist', modelSlug },
        preferredId: (json) => ((json.result as { playlist?: { id?: string } } | undefined)?.playlist?.id ?? null),
      }),
  };
}
