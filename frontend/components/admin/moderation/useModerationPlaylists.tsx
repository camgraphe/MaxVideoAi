import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import type { ModerationVideo, PlaylistOption, PlaylistTag } from '@/components/admin/moderation/moderation-types';
import { ModerationPlaylistControls } from './ModerationPlaylistControls';

type PlaylistStatus = Record<string, { loading: boolean; message: string | null; error: string | null }>;

function buildPlaylistAssignments(videos: ModerationVideo[]): Record<string, PlaylistTag[]> {
  return videos.reduce<Record<string, PlaylistTag[]>>((acc, video) => {
    acc[video.id] = video.assignedPlaylists ?? [];
    return acc;
  }, {});
}

export function useModerationPlaylists(videos: ModerationVideo[]) {
  const initialPlaylistAssignments = useMemo(() => buildPlaylistAssignments(videos), [videos]);
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistFetchError, setPlaylistFetchError] = useState<string | null>(null);
  const [playlistAssignments, setPlaylistAssignments] = useState<Record<string, PlaylistTag[]>>(initialPlaylistAssignments);
  const [playlistStatus, setPlaylistStatus] = useState<PlaylistStatus>({});
  const playlistAssignmentsRef = useRef<Record<string, PlaylistTag[]>>({});

  useEffect(() => {
    playlistAssignmentsRef.current = playlistAssignments;
  }, [playlistAssignments]);

  const orderedPlaylists = useMemo(() => {
    return [...playlists].sort((a, b) => {
      const aTarget = Boolean(a.usageTargets?.length);
      const bTarget = Boolean(b.usageTargets?.length);
      if (aTarget && !bTarget) return -1;
      if (bTarget && !aTarget) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [playlists]);

  const getPlaylistName = useCallback(
    (playlistId: string) => orderedPlaylists.find((playlist) => playlist.id === playlistId)?.name ?? 'Playlist',
    [orderedPlaylists]
  );

  const updateStatusMessage = useCallback((videoId: string, patch: Partial<{ loading: boolean; message: string | null; error: string | null }>) => {
    setPlaylistStatus((prev) => ({
      ...prev,
      [videoId]: {
        loading: patch.loading ?? prev[videoId]?.loading ?? false,
        message: patch.message ?? (patch.message === null ? null : prev[videoId]?.message ?? null),
        error: patch.error ?? (patch.error === null ? null : prev[videoId]?.error ?? null),
      },
    }));
  }, []);

  const scheduleStatusClear = useCallback((videoId: string, field: 'message' | 'error', value: string, delay = 2500) => {
    window.setTimeout(() => {
      setPlaylistStatus((prev) => {
        const current = prev[videoId];
        if (!current) return prev;
        if (current[field] !== value) return prev;
        return {
          ...prev,
          [videoId]: {
            ...current,
            [field]: null,
          },
        };
      });
    }, delay);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPlaylists() {
      setPlaylistsLoading(true);
      setPlaylistFetchError(null);
      try {
        const response = await authFetch('/api/admin/playlists', { cache: 'no-store' });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok || !Array.isArray(json.playlists)) {
          throw new Error(json?.error ?? `Failed to load playlists (${response.status})`);
        }
        if (cancelled) return;
        setPlaylists(
          (json.playlists as Array<{ id: string; name: string; slug: string; usageTargets?: string[] }>).map((playlist) => ({
            id: playlist.id,
            name: playlist.name,
            slug: playlist.slug,
            usageTargets: Array.isArray(playlist.usageTargets) ? playlist.usageTargets : [],
          }))
        );
      } catch (playlistError) {
        if (!cancelled) {
          setPlaylistFetchError(playlistError instanceof Error ? playlistError.message : 'Failed to load playlists');
        }
      } finally {
        if (!cancelled) {
          setPlaylistsLoading(false);
        }
      }
    }

    void loadPlaylists();
    return () => {
      cancelled = true;
    };
  }, []);

  const appendPlaylistAssignments = useCallback((incoming: ModerationVideo[]) => {
    setPlaylistAssignments((current) => {
      const nextAssignments = { ...current };
      incoming.forEach((item) => {
        nextAssignments[item.id] = item.assignedPlaylists ?? [];
      });
      return nextAssignments;
    });
  }, []);

  const replacePlaylistAssignments = useCallback((incoming: ModerationVideo[]) => {
    setPlaylistAssignments(buildPlaylistAssignments(incoming));
  }, []);

  const clearPlaylistStatus = useCallback(() => {
    setPlaylistStatus({});
  }, []);

  const handleAssignToPlaylist = useCallback(
    async (video: ModerationVideo, playlistId: string) => {
      if (!playlistId) return;
      const existing = playlistAssignmentsRef.current[video.id] ?? [];
      if (existing.some((entry) => entry.id === playlistId)) {
        const playlistName = getPlaylistName(playlistId);
        updateStatusMessage(video.id, { loading: false, message: `Already in ${playlistName}`, error: null });
        scheduleStatusClear(video.id, 'message', `Already in ${playlistName}`, 2000);
        return;
      }

      const playlistName = getPlaylistName(playlistId);
      updateStatusMessage(video.id, { loading: true, message: null, error: null });
      try {
        const response = await authFetch(`/api/admin/playlists/${playlistId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: video.id }),
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error ?? 'Failed to assign playlist');
        }
        setPlaylistAssignments((prev) => {
          const current = prev[video.id] ?? [];
          if (current.some((entry) => entry.id === playlistId)) {
            return prev;
          }
          return {
            ...prev,
            [video.id]: [...current, { id: playlistId, name: playlistName }],
          };
        });
        const successMessage = `Added to ${playlistName}`;
        updateStatusMessage(video.id, { loading: false, message: successMessage, error: null });
        scheduleStatusClear(video.id, 'message', successMessage);
      } catch (assignError) {
        updateStatusMessage(video.id, {
          loading: false,
          error: assignError instanceof Error ? assignError.message : 'Failed to assign playlist',
        });
        if (assignError instanceof Error) {
          scheduleStatusClear(video.id, 'error', assignError.message, 3500);
        }
      }
    },
    [getPlaylistName, scheduleStatusClear, updateStatusMessage]
  );

  const handleRemoveFromPlaylist = useCallback(
    async (video: ModerationVideo, playlistId: string) => {
      const playlistName = getPlaylistName(playlistId);
      updateStatusMessage(video.id, { loading: true, error: null, message: null });
      try {
        const url = `/api/admin/playlists/${playlistId}/items?videoId=${encodeURIComponent(video.id)}`;
        const response = await authFetch(url, { method: 'DELETE' });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error ?? 'Failed to remove from playlist');
        }
        setPlaylistAssignments((prev) => {
          const current = prev[video.id] ?? [];
          const filtered = current.filter((entry) => entry.id !== playlistId);
          if (!filtered.length) {
            const nextAssignments = { ...prev };
            delete nextAssignments[video.id];
            return nextAssignments;
          }
          return {
            ...prev,
            [video.id]: filtered,
          };
        });
        updateStatusMessage(video.id, { loading: false, message: `Removed from ${playlistName}`, error: null });
        scheduleStatusClear(video.id, 'message', `Removed from ${playlistName}`);
      } catch (removeError) {
        updateStatusMessage(video.id, {
          loading: false,
          error: removeError instanceof Error ? removeError.message : 'Failed to remove from playlist',
        });
        if (removeError instanceof Error) {
          scheduleStatusClear(video.id, 'error', removeError.message, 3500);
        }
      }
    },
    [getPlaylistName, scheduleStatusClear, updateStatusMessage]
  );

  const renderPlaylistControls = useCallback(
    (video: ModerationVideo, options?: { compact?: boolean; emphasizeAssigned?: boolean; enabled?: boolean }) => {
      const compact = options?.compact ?? false;
      const emphasizeAssigned = options?.emphasizeAssigned ?? false;
      const enabled = options?.enabled ?? true;
      const assignedPlaylists = playlistAssignments[video.id] ?? [];
      const playlistState = playlistStatus[video.id];

      return (
        <ModerationPlaylistControls
          assignedPlaylists={assignedPlaylists}
          compact={compact}
          emphasizeAssigned={emphasizeAssigned}
          enabled={enabled}
          isLoadingPlaylists={playlistsLoading}
          onAssign={(targetVideo, playlistId) => void handleAssignToPlaylist(targetVideo, playlistId)}
          onRemove={(targetVideo, playlistId) => void handleRemoveFromPlaylist(targetVideo, playlistId)}
          orderedPlaylists={orderedPlaylists}
          playlistState={playlistState}
          video={video}
        />
      );
    },
    [handleAssignToPlaylist, handleRemoveFromPlaylist, orderedPlaylists, playlistAssignments, playlistStatus, playlistsLoading]
  );

  return {
    appendPlaylistAssignments,
    clearPlaylistStatus,
    playlistAssignments,
    playlistFetchError,
    renderPlaylistControls,
    replacePlaylistAssignments,
  };
}
