"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import clsx from 'clsx';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { TARGET_MODERATION_PLAYLIST_SLUGS } from '@/config/playlists';
import { isPlaceholderMediaUrl, normalizeMediaUrl } from '@/lib/media';
import { authFetch } from '@/lib/authFetch';

export type ModerationVideo = {
  id: string;
  userId: string | null;
  status?: string | null;
  message?: string;
  updatedAt?: string;
  archived?: boolean;
  engineId: string;
  engineLabel: string;
  durationSec: number;
  prompt: string;
  thumbUrl?: string;
  videoUrl?: string;
  aspectRatio?: string;
  createdAt: string;
  visibility: 'public' | 'private';
  indexable: boolean;
  featured?: boolean;
  assignedPlaylists?: PlaylistTag[];
};

type ModerationTableProps = {
  videos: ModerationVideo[];
  initialCursor: string | null;
};

type PlaylistOption = {
  id: string;
  name: string;
  slug: string;
};

type PlaylistTag = {
  id: string;
  name: string;
};

type ModerationViewMode = 'wall' | 'table';

const TARGET_PLAYLIST_SLUGS = new Set<string>(TARGET_MODERATION_PLAYLIST_SLUGS as readonly string[]);

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ModerationTable({ videos, initialCursor }: ModerationTableProps) {
  const initialPlaylistAssignments = useMemo(
    () =>
      videos.reduce<Record<string, PlaylistTag[]>>((acc, video) => {
        acc[video.id] = video.assignedPlaylists ?? [];
        return acc;
      }, {}),
    [videos]
  );
  const [items, setItems] = useState(videos);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistFetchError, setPlaylistFetchError] = useState<string | null>(null);
  const [playlistAssignments, setPlaylistAssignments] = useState<Record<string, PlaylistTag[]>>(initialPlaylistAssignments);
  const [playlistStatus, setPlaylistStatus] = useState<Record<string, { loading: boolean; message: string | null; error: string | null }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<ModerationViewMode>('wall');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(videos[0]?.id ?? null);
  const playlistAssignmentsRef = useRef<Record<string, PlaylistTag[]>>({});

  const displayItems = useMemo(() => {
    if (showArchived) return items;
    return items.filter((item) => !item.archived);
  }, [items, showArchived]);

  const hasVideos = displayItems.length > 0;
  const selectedVideo = useMemo(
    () => displayItems.find((item) => item.id === selectedVideoId) ?? displayItems[0] ?? null,
    [displayItems, selectedVideoId]
  );

  const stats = useMemo(() => {
    const total = displayItems.length;
    const nonIndexable = displayItems.filter((item) => !item.indexable).length;
    const archivedCount = items.filter((item) => item.archived).length;
    return { total, nonIndexable, archivedCount };
  }, [displayItems, items]);

  const mutateVideo = useCallback((id: string, updates: Partial<ModerationVideo>) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updates,
            }
          : item
      )
    );
  }, []);

  const removeVideo = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, [setItems]);

  const updateVisibility = useCallback(
    (video: ModerationVideo, visibility: 'public' | 'private', indexable: boolean) => {
      startTransition(async () => {
        setError(null);
        mutateVideo(video.id, { visibility, indexable, archived: false });
        try {
          const res = await authFetch(`/api/admin/videos/${video.id}/visibility`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visibility, indexable }),
          });
          if (!res.ok) {
            throw new Error(`Request failed with status ${res.status}`);
          }
          const json = await res.json().catch(() => ({ ok: false }));
          if (!json?.ok) {
            throw new Error(json?.error ?? 'Unknown error');
          }
          if (visibility !== 'public') {
            removeVideo(video.id);
          }
        } catch (err) {
          console.error('[moderation] update failed', err);
          setError(err instanceof Error ? err.message : 'Failed to update visibility');
          mutateVideo(video.id, video);
        }
      });
    },
    [mutateVideo, removeVideo, startTransition]
  );

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({ cursor: nextCursor, limit: '50' });
      const res = await authFetch(`/api/admin/videos/pending?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `Failed to load more videos (${res.status})`);
      }
      const incoming = Array.isArray(json.videos) ? (json.videos as ModerationVideo[]) : [];
      if (incoming.length) {
        setItems((current) => {
          const seen = new Set(current.map((item) => item.id));
          const merged = [...current];
          incoming.forEach((item) => {
            if (!seen.has(item.id)) {
              merged.push(item);
              seen.add(item.id);
            }
          });
          return merged;
        });
        setPlaylistAssignments((current) => {
          const next = { ...current };
          incoming.forEach((item) => {
            if (item.assignedPlaylists) {
              next[item.id] = item.assignedPlaylists;
            }
          });
          return next;
        });
      }
      setNextCursor(typeof json.nextCursor === 'string' ? json.nextCursor : null);
    } catch (err) {
      console.error('[moderation] load more failed', err);
      setError(err instanceof Error ? err.message : 'Failed to load more videos');
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore]);

  useEffect(() => {
    playlistAssignmentsRef.current = playlistAssignments;
  }, [playlistAssignments]);

  useEffect(() => {
    if (!displayItems.length) {
      setSelectedVideoId(null);
      return;
    }
    if (!selectedVideoId || !displayItems.some((item) => item.id === selectedVideoId)) {
      setSelectedVideoId(displayItems[0]?.id ?? null);
    }
  }, [displayItems, selectedVideoId]);

  useEffect(() => {
    let cancelled = false;
    async function loadPlaylists() {
      setPlaylistsLoading(true);
      setPlaylistFetchError(null);
      try {
        const res = await authFetch('/api/admin/playlists', { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok || !Array.isArray(json.playlists)) {
          throw new Error(json?.error ?? `Failed to load playlists (${res.status})`);
        }
        if (cancelled) return;
        const options = (json.playlists as Array<{ id: string; name: string; slug: string }>).map((playlist) => ({
          id: playlist.id,
          name: playlist.name,
          slug: playlist.slug,
        }));
        setPlaylists(options);
      } catch (err) {
        if (!cancelled) {
          setPlaylistFetchError(err instanceof Error ? err.message : 'Failed to load playlists');
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

  const orderedPlaylists = useMemo(() => {
    return [...playlists].sort((a, b) => {
      const aTarget = TARGET_PLAYLIST_SLUGS.has(a.slug);
      const bTarget = TARGET_PLAYLIST_SLUGS.has(b.slug);
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
        const res = await authFetch(`/api/admin/playlists/${playlistId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: video.id }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
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
        updateStatusMessage(video.id, { loading: false, message: `Added to ${playlistName}`, error: null });
        scheduleStatusClear(video.id, 'message', `Added to ${playlistName}`);
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

  const handleDeleteVideo = useCallback(
    async (video: ModerationVideo) => {
      const confirmFirst = window.confirm('Remove this video from the site? This will hide it everywhere.');
      if (!confirmFirst) return;
      const confirmSecond = window.confirm('Final confirmation: permanently remove this video from galleries and playlists?');
      if (!confirmSecond) return;
      setDeletingId(video.id);
      setError(null);
      try {
        const res = await authFetch(`/api/admin/videos/${video.id}`, {
          method: 'DELETE',
        });
        const json = await res.json().catch(() => ({ ok: false }));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error ?? 'Failed to delete video');
        }
        setPlaylistAssignments((prev) => {
          if (!prev[video.id]) return prev;
          const next = { ...prev };
          delete next[video.id];
          playlistAssignmentsRef.current = next;
          return next;
        });
        setPlaylistStatus((prev) => {
          if (!prev[video.id]) return prev;
          const next = { ...prev };
          delete next[video.id];
          return next;
        });
        removeVideo(video.id);
      } catch (deleteError) {
        console.error('[moderation] delete failed', deleteError);
        setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete video');
      } finally {
        setDeletingId(null);
      }
    },
    [removeVideo]
  );

  const handleRemoveFromPlaylist = useCallback(
    async (video: ModerationVideo, playlistId: string) => {
      const playlistName = getPlaylistName(playlistId);
      updateStatusMessage(video.id, { loading: true, error: null, message: null });
      try {
        const url = `/api/admin/playlists/${playlistId}/items?videoId=${encodeURIComponent(video.id)}`;
        const res = await authFetch(url, {
          method: 'DELETE',
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
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

  const renderModerationActions = useCallback(
    (video: ModerationVideo, options?: { compact?: boolean }) => {
      const compact = options?.compact ?? false;
      const baseClass = compact
        ? 'h-8 rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-micro'
        : 'rounded-input px-3 py-1 text-xs font-semibold uppercase tracking-micro';

      if (video.visibility === 'public') {
        return (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={clsx(baseClass, 'border-error-border bg-error-bg text-error hover:bg-error-bg hover:text-error')}
              onClick={() => updateVisibility(video, 'private', false)}
              disabled={isPending}
            >
              Make private
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={clsx(
                baseClass,
                video.indexable
                  ? 'border-warning-border bg-warning-bg text-warning hover:bg-warning-bg'
                  : 'border-success-border bg-success-bg text-success hover:bg-success-bg'
              )}
              onClick={() => updateVisibility(video, 'public', !video.indexable)}
              disabled={isPending}
            >
              {video.indexable ? 'Disable indexing' : 'Enable indexing'}
            </Button>
          </>
        );
      }

      return (
        <>
          <Button
            type="button"
            size="sm"
            className={clsx(baseClass, 'bg-success text-on-inverse hover:bg-success')}
            onClick={() => updateVisibility(video, 'public', true)}
            disabled={isPending}
          >
            Publish & index
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={clsx(baseClass, 'border-hairline text-text-secondary hover:border-text-muted hover:text-text-primary')}
            onClick={() => updateVisibility(video, 'public', false)}
            disabled={isPending}
          >
            Publish (no index)
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={clsx(baseClass, 'border-hairline text-text-secondary hover:border-text-muted hover:text-text-primary')}
            onClick={() => updateVisibility(video, 'private', false)}
            disabled={isPending}
          >
            Keep private
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={clsx(baseClass, 'border-error-border text-error hover:bg-error-bg hover:text-error')}
            onClick={() => handleDeleteVideo(video)}
            disabled={deletingId === video.id}
          >
            {deletingId === video.id ? 'Deleting…' : 'Delete video'}
          </Button>
        </>
      );
    },
    [deletingId, handleDeleteVideo, isPending, updateVisibility]
  );

  const renderPlaylistControls = useCallback(
    (video: ModerationVideo, options?: { compact?: boolean; emphasizeAssigned?: boolean }) => {
      const compact = options?.compact ?? false;
      const emphasizeAssigned = options?.emphasizeAssigned ?? false;
      const assignedPlaylists = playlistAssignments[video.id] ?? [];
      const playlistState = playlistStatus[video.id];
      const isAssigningPlaylist = Boolean(playlistState?.loading);
      const playlistMessage = playlistState?.message ?? null;
      const playlistErrorMessage = playlistState?.error ?? null;

      return (
        <div className="space-y-2 text-xs">
          {assignedPlaylists.length ? (
            <div className={clsx('flex flex-wrap gap-2', emphasizeAssigned && 'gap-1.5')}>
              {assignedPlaylists.map((playlist) => (
                <Button
                  key={`${video.id}-${playlist.id}`}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleRemoveFromPlaylist(video, playlist.id)}
                  disabled={isAssigningPlaylist}
                  className={clsx(
                    'min-h-0 h-auto gap-1 rounded-pill px-2 py-1 text-[11px]',
                    emphasizeAssigned
                      ? 'border-success-border bg-success-bg font-semibold text-success hover:border-error-border hover:text-error'
                      : 'border-border bg-bg text-text-secondary hover:border-error-border hover:text-error'
                  )}
                >
                  {playlist.name}
                  <span aria-hidden>×</span>
                  <span className="sr-only">Remove from {playlist.name}</span>
                </Button>
              ))}
            </div>
          ) : compact ? (
            <p className="text-[11px] text-text-muted">No playlist yet</p>
          ) : (
            <p className="text-xs text-text-muted">No playlist assignment yet.</p>
          )}
          {compact ? null : (
            <label className="block text-[11px] font-semibold uppercase tracking-micro text-text-muted">
              Add to playlist
            </label>
          )}
          <select
            className={clsx(
              'w-full rounded-input border border-hairline bg-bg text-xs text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              compact ? 'px-2 py-1.5' : 'px-2 py-2'
            )}
            defaultValue=""
            disabled={playlistsLoading || !playlists.length || isAssigningPlaylist}
            onChange={(event) => {
              const playlistId = event.target.value;
              if (!playlistId) return;
              void handleAssignToPlaylist(video, playlistId);
              event.target.value = '';
            }}
          >
            <option value="">
              {playlistsLoading ? 'Loading playlists…' : playlists.length ? 'Select playlist' : 'No playlists'}
            </option>
            {orderedPlaylists.map((playlist) => {
              const disabled = assignedPlaylists.some((entry) => entry.id === playlist.id);
              return (
                <option key={playlist.id} value={playlist.id} disabled={disabled}>
                  {TARGET_PLAYLIST_SLUGS.has(playlist.slug) ? '★ ' : ''}
                  {playlist.name}
                </option>
              );
            })}
          </select>
          {playlistMessage ? <p className="text-[11px] text-success">{playlistMessage}</p> : null}
          {playlistErrorMessage ? <p className="text-[11px] text-error">{playlistErrorMessage}</p> : null}
        </div>
      );
    },
    [handleAssignToPlaylist, handleRemoveFromPlaylist, orderedPlaylists, playlistAssignments, playlistStatus, playlists.length, playlistsLoading]
  );

  return (
    <div className="stack-gap-lg">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Moderate live videos</h1>
          <p className="text-sm text-text-secondary">
            Review gallery clips, adjust indexing, or hide them from the public experience.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-xs text-text-muted sm:items-end">
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <div className="inline-flex rounded-md border border-border bg-surface p-1">
              <button
                type="button"
                onClick={() => setViewMode('wall')}
                className={clsx(
                  'rounded-sm px-3 py-1.5 text-xs font-medium transition',
                  viewMode === 'wall' ? 'bg-bg text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
                )}
              >
                Wall
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={clsx(
                  'rounded-sm px-3 py-1.5 text-xs font-medium transition',
                  viewMode === 'table' ? 'bg-bg text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
                )}
              >
                Table
              </button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowArchived((prev) => !prev)}
              className="gap-2 rounded-md border-border px-3 py-1.5 text-xs font-medium hover:border-text-muted hover:bg-surface-2"
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Button>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span>
              Visible: {stats.total}
            </span>
            <span>Indexing disabled: {stats.nonIndexable}</span>
            <span>Auto-archived (30m): {stats.archivedCount}</span>
          </div>
        </div>
      </header>

      {playlistFetchError ? (
        <div className="rounded-card border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning">
          {playlistFetchError}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-card border border-error-border bg-error-bg px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      {!hasVideos ? (
        <div className="rounded-card border border-hairline bg-surface p-8 text-center text-sm text-text-secondary">
          No public videos to review.
        </div>
      ) : viewMode === 'wall' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {displayItems.map((video) => {
              const normalizedVideoUrl = video.videoUrl ? normalizeMediaUrl(video.videoUrl) ?? video.videoUrl : undefined;
              const normalizedThumbUrl = video.thumbUrl ? normalizeMediaUrl(video.thumbUrl) ?? video.thumbUrl : undefined;
              const hasThumbPreview = Boolean(normalizedThumbUrl && !isPlaceholderMediaUrl(normalizedThumbUrl));
              const hasVideoPreview = Boolean(normalizedVideoUrl);
              const assignedPlaylists = playlistAssignments[video.id] ?? [];
              const isSelected = selectedVideo?.id === video.id;

              return (
                <div
                  key={video.id}
                  className={clsx(
                    'overflow-hidden rounded-card border bg-surface text-left transition',
                    isSelected
                      ? 'border-text-primary shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'
                      : 'border-border hover:border-text-muted'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedVideoId(video.id)}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-video overflow-hidden bg-black">
                      {hasThumbPreview && normalizedThumbUrl ? (
                        <Image
                          src={normalizedThumbUrl}
                          alt="Thumbnail"
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
                        />
                      ) : hasVideoPreview ? (
                        <video
                          src={normalizedVideoUrl}
                          className="absolute inset-0 h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-on-media-70">
                          No preview
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 py-2">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{video.engineLabel}</p>
                            <p className="text-[11px] text-white/70">
                              {video.durationSec}s {video.aspectRatio ? `• ${video.aspectRatio}` : ''}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/20 bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-white">
                            Review
                          </span>
                        </div>
                      </div>
                      <div className="absolute left-2 top-2 flex gap-2">
                        <span
                          className={clsx(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro',
                            video.indexable
                              ? 'bg-success-bg text-success ring-1 ring-success-border'
                              : 'bg-warning-bg text-warning ring-1 ring-warning-border'
                          )}
                        >
                          {video.indexable ? 'Indexable' : 'No index'}
                        </span>
                        {video.archived ? (
                          <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-warning ring-1 ring-warning-border">
                            Archived
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="line-clamp-1 text-sm font-medium text-text-primary">{video.prompt}</p>
                        {video.status ? (
                          <span className="shrink-0 text-[10px] uppercase tracking-micro text-text-muted">{video.status}</span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted">
                        <span>{formatDate(video.createdAt)}</span>
                        {assignedPlaylists.length ? <span>{assignedPlaylists.length} playlist{assignedPlaylists.length > 1 ? 's' : ''}</span> : null}
                      </div>
                    </div>
                  </button>
                  <div className="space-y-2 border-t border-border p-3">
                    {renderPlaylistControls(video, { compact: true, emphasizeAssigned: true })}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-md border-error-border bg-error-bg px-2.5 text-[11px] font-semibold uppercase tracking-micro text-error hover:bg-error-bg hover:text-error"
                        onClick={() => updateVisibility(video, 'private', false)}
                        disabled={isPending}
                      >
                        Hide
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={clsx(
                          'h-8 rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-micro',
                          video.indexable
                            ? 'border-warning-border bg-warning-bg text-warning hover:bg-warning-bg'
                            : 'border-success-border bg-success-bg text-success hover:bg-success-bg'
                        )}
                        onClick={() => updateVisibility(video, 'public', !video.indexable)}
                        disabled={isPending}
                      >
                        {video.indexable ? 'No index' : 'Index'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-md border-hairline px-2.5 text-[11px] font-semibold uppercase tracking-micro text-text-secondary hover:border-text-muted hover:text-text-primary"
                        onClick={() => setSelectedVideoId(video.id)}
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedVideo ? (
            <aside className="h-fit rounded-card border border-border bg-surface xl:sticky xl:top-4">
              <div className="space-y-4 p-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Selected video</p>
                  <div className="relative aspect-video overflow-hidden rounded-card border border-hairline bg-black">
                    {selectedVideo.videoUrl ? (
                      <video
                        src={normalizeMediaUrl(selectedVideo.videoUrl) ?? selectedVideo.videoUrl}
                        poster={
                          selectedVideo.thumbUrl
                            ? normalizeMediaUrl(selectedVideo.thumbUrl) ?? selectedVideo.thumbUrl
                            : undefined
                        }
                        className="absolute inset-0 h-full w-full object-cover"
                        controls
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : selectedVideo.thumbUrl ? (
                      <Image
                        src={normalizeMediaUrl(selectedVideo.thumbUrl) ?? selectedVideo.thumbUrl}
                        alt="Thumbnail"
                        fill
                        className="object-cover"
                        sizes="352px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-on-media-70">
                        No preview
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-text-primary">{selectedVideo.engineLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {(playlistAssignments[selectedVideo.id] ?? []).map((playlist) => (
                        <span
                          key={`${selectedVideo.id}-${playlist.id}`}
                          className="rounded-full border border-success-border bg-success-bg px-2 py-0.5 text-[11px] font-semibold text-success"
                        >
                          {playlist.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                    <span>Duration: {selectedVideo.durationSec}s</span>
                    <span>Aspect: {selectedVideo.aspectRatio ?? 'auto'}</span>
                    <span>Created: {formatDate(selectedVideo.createdAt)}</span>
                    <span>Updated: {selectedVideo.updatedAt ? formatDate(selectedVideo.updatedAt) : '—'}</span>
                    <span>Visibility: {selectedVideo.visibility}</span>
                    <span>Indexable: {selectedVideo.indexable ? 'Yes' : 'No'}</span>
                    <span>User: {selectedVideo.userId ?? '—'}</span>
                    <span>Status: {selectedVideo.status ?? '—'}</span>
                  </div>
                  {selectedVideo.message ? (
                    <div className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning">
                      Fal message: {selectedVideo.message}
                    </div>
                  ) : null}
                  <details className="rounded-md border border-border bg-bg px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-micro text-text-muted">
                      Prompt
                    </summary>
                    <p className="mt-2 text-sm text-text-secondary">{selectedVideo.prompt}</p>
                  </details>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Moderation</p>
                  <div className="flex flex-wrap gap-2">
                    {renderModerationActions(selectedVideo)}
                  </div>
                </div>

                {renderPlaylistControls(selectedVideo, { emphasizeAssigned: true })}
              </div>
            </aside>
          ) : null}

          {nextCursor ? (
            <div className="xl:col-span-2">
              <div className="rounded-card border border-border bg-surface px-4 py-3 text-center">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="rounded-input border-border bg-bg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface"
                >
                  {isLoadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-bg text-xs uppercase tracking-micro text-text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">Preview</th>
                <th scope="col" className="px-4 py-3 text-left">Details</th>
                <th scope="col" className="px-4 py-3 text-left">Prompt</th>
                <th scope="col" className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
            {displayItems.map((video) => {
                const normalizedVideoUrl = video.videoUrl ? normalizeMediaUrl(video.videoUrl) ?? video.videoUrl : undefined;
                const normalizedThumbUrl = video.thumbUrl ? normalizeMediaUrl(video.thumbUrl) ?? video.thumbUrl : undefined;
                const hasThumbPreview = Boolean(normalizedThumbUrl && !isPlaceholderMediaUrl(normalizedThumbUrl));
                const hasVideoPreview = Boolean(normalizedVideoUrl);
                const posterUrl = hasThumbPreview ? normalizedThumbUrl : undefined;
                return (
                  <tr key={video.id} className={clsx(isPending && 'opacity-90')}>
                  <td className="px-4 py-4">
                    <div className="relative h-24 w-40 overflow-hidden rounded-card border border-hairline bg-black">
                      <span
                        className={clsx(
                          'absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro',
                          video.indexable
                            ? 'bg-success-bg text-success ring-1 ring-success-border'
                            : 'bg-warning-bg text-warning ring-1 ring-warning-border'
                        )}
                      >
                        {video.indexable ? 'Indexable' : 'No index'}
                      </span>
                      {video.archived ? (
                        <span className="absolute right-2 top-2 rounded-full bg-warning-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-warning ring-1 ring-warning-border">
                          Archived
                        </span>
                      ) : null}
                      {hasVideoPreview ? (
                        <video
                          src={normalizedVideoUrl}
                          poster={posterUrl}
                          className="absolute inset-0 h-full w-full object-cover"
                          muted
                          loop
                          playsInline
                          autoPlay
                          preload="metadata"
                        />
                      ) : hasThumbPreview && normalizedThumbUrl ? (
                        <Image
                          src={normalizedThumbUrl}
                          alt="Thumbnail"
                          fill
                          className="object-cover"
                          sizes="160px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-on-media-70">
                          No preview
                        </div>
                      )}
                    </div>
                  </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1 text-xs text-text-secondary">
                        <span className="font-semibold text-text-primary">{video.engineLabel}</span>
                        <span>Duration: {video.durationSec}s</span>
                        <span>Aspect: {video.aspectRatio ?? 'auto'}</span>
                        <span>Created: {formatDate(video.createdAt)}</span>
                        {video.updatedAt ? <span>Updated: {formatDate(video.updatedAt)}</span> : null}
                        <span>User: {video.userId ?? '—'}</span>
                        <span>Visibility: {video.visibility}</span>
                        <span>Indexable: {video.indexable ? 'Yes' : 'No'}</span>
                        {video.status ? <span>Status: {video.status}</span> : null}
                        {video.message ? (
                          <span className="text-warning">Fal message: {video.message}</span>
                        ) : null}
                      </div>
                    </td>
                  <td className="px-4 py-4 align-top text-xs text-text-secondary">
                    <p className="max-w-xs whitespace-pre-line">
                      {video.prompt}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-col gap-2">
                      {renderModerationActions(video)}
                      <div className="mt-3">{renderPlaylistControls(video)}</div>
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
          {nextCursor ? (
            <div className="border-t border-border bg-surface px-4 py-3 text-center">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="rounded-input border-border bg-bg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface"
              >
                {isLoadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
