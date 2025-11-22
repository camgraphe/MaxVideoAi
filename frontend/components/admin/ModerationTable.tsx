"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import clsx from 'clsx';
import Image from 'next/image';
import { TARGET_MODERATION_PLAYLIST_SLUGS } from '@/config/playlists';
import { isPlaceholderMediaUrl, normalizeMediaUrl } from '@/lib/media';

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

const TARGET_PLAYLIST_SLUGS = new Set(TARGET_MODERATION_PLAYLIST_SLUGS);

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
  const [items, setItems] = useState(videos);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistFetchError, setPlaylistFetchError] = useState<string | null>(null);
  const [playlistAssignments, setPlaylistAssignments] = useState<Record<string, PlaylistTag[]>>({});
  const [playlistStatus, setPlaylistStatus] = useState<Record<string, { loading: boolean; message: string | null; error: string | null }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const playlistAssignmentsRef = useRef<Record<string, PlaylistTag[]>>({});

  const displayItems = useMemo(() => {
    if (showArchived) return items;
    return items.filter((item) => !item.archived);
  }, [items, showArchived]);

  const hasVideos = displayItems.length > 0;

  const stats = useMemo(() => {
    const total = displayItems.length;
    const nonIndexable = displayItems.filter((item) => !item.indexable).length;
    const archivedCount = items.filter((item) => item.archived).length;
    return { total, nonIndexable, archivedCount };
  }, [displayItems, items]);

  const mutateVideo = (id: string, updates: Partial<ModerationVideo>) => {
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
  };

  const removeVideo = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, [setItems]);

  const updateVisibility = (video: ModerationVideo, visibility: 'public' | 'private', indexable: boolean) => {
    startTransition(async () => {
      setError(null);
      mutateVideo(video.id, { visibility, indexable, archived: false });
      try {
        const res = await fetch(`/api/admin/videos/${video.id}/visibility`, {
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
  };

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({ cursor: nextCursor, limit: '50' });
      const res = await fetch(`/api/admin/videos/pending?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
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
    let cancelled = false;
    async function loadPlaylists() {
      setPlaylistsLoading(true);
      setPlaylistFetchError(null);
      try {
        const res = await fetch('/api/admin/playlists', { cache: 'no-store', credentials: 'include' });
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

  useEffect(() => {
    if (!playlists.length || !items.length) return;
    const targetPlaylists = playlists.filter((playlist) => TARGET_PLAYLIST_SLUGS.has(playlist.slug));
    if (!targetPlaylists.length) return;

    let cancelled = false;
    async function loadMembership() {
      const videoIdSet = new Set(items.map((item) => item.id));
      const collected: Record<string, PlaylistTag[]> = {};
      for (const playlist of targetPlaylists) {
        try {
          const res = await fetch(`/api/admin/playlists/${playlist.id}`, { cache: 'no-store', credentials: 'include' });
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.ok || !Array.isArray(json.items)) continue;
          (json.items as Array<{ videoId: string }>).forEach((entry) => {
            if (!videoIdSet.has(entry.videoId)) return;
            if (!collected[entry.videoId]) {
              collected[entry.videoId] = [];
            }
            collected[entry.videoId].push({ id: playlist.id, name: playlist.name });
          });
        } catch (error) {
          console.warn('[moderation] failed to load playlist membership', error);
        }
      }
      if (cancelled) return;
      const targetIds = new Set(targetPlaylists.map((playlist) => playlist.id));
      setPlaylistAssignments((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((videoId) => {
          const filtered = next[videoId]?.filter((entry) => !targetIds.has(entry.id)) ?? [];
          if (filtered.length) {
            next[videoId] = filtered;
          } else {
            delete next[videoId];
          }
        });
        Object.entries(collected).forEach(([videoId, tags]) => {
          const existing = next[videoId] ?? [];
          const merged = [...existing];
          tags.forEach((tag) => {
            if (!merged.some((entry) => entry.id === tag.id)) {
              merged.push(tag);
            }
          });
          next[videoId] = merged;
        });
        return next;
      });
    }
    void loadMembership();
    return () => {
      cancelled = true;
    };
  }, [playlists, items]);

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
        const res = await fetch(`/api/admin/playlists/${playlistId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
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
        const res = await fetch(`/api/admin/videos/${video.id}`, {
          method: 'DELETE',
          credentials: 'include',
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
        const res = await fetch(url, {
          method: 'DELETE',
          credentials: 'include',
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

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Moderate live videos</h1>
          <p className="text-sm text-text-secondary">
            Review gallery clips, adjust indexing, or hide them from the public experience.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-xs text-text-muted sm:items-end">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowArchived((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:border-accentSoft/60 hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </button>
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
        <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {playlistFetchError}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!hasVideos ? (
        <div className="rounded-card border border-hairline bg-white p-8 text-center text-sm text-text-secondary">
          No public videos to review.
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-white">
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
                const assignedPlaylists = playlistAssignments[video.id] ?? [];
                const playlistState = playlistStatus[video.id];
                const isAssigningPlaylist = Boolean(playlistState?.loading);
                const playlistMessage = playlistState?.message ?? null;
                const playlistErrorMessage = playlistState?.error ?? null;
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
                            ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
                            : 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
                        )}
                      >
                        {video.indexable ? 'Indexable' : 'No index'}
                      </span>
                      {video.archived ? (
                        <span className="absolute right-2 top-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-amber-700 ring-1 ring-amber-200">
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
                        <div className="flex h-full w-full items-center justify-center text-xs text-white/70">
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
                          <span className="text-amber-700">Fal message: {video.message}</span>
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
                      {video.visibility === 'public' ? (
                        <>
                          <button
                            type="button"
                            className="rounded-input border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                            onClick={() => updateVisibility(video, 'private', false)}
                            disabled={isPending}
                          >
                            Make private
                          </button>
                          <button
                            type="button"
                            className={clsx(
                              'rounded-input px-3 py-1 text-xs font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              video.indexable
                                ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            )}
                            onClick={() => updateVisibility(video, 'public', !video.indexable)}
                            disabled={isPending}
                          >
                            {video.indexable ? 'Disable indexing' : 'Enable indexing'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="rounded-input bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => updateVisibility(video, 'public', true)}
                            disabled={isPending}
                          >
                            Publish & index
                          </button>
                          <button
                            type="button"
                            className="rounded-input border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => updateVisibility(video, 'public', false)}
                            disabled={isPending}
                          >
                            Publish (no index)
                          </button>
                          <button
                            type="button"
                            className="rounded-input border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => updateVisibility(video, 'private', false)}
                            disabled={isPending}
                          >
                            Keep private
                          </button>
                          <button
                            type="button"
                            className="rounded-input border border-rose-300 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                            onClick={() => handleDeleteVideo(video)}
                            disabled={deletingId === video.id}
                          >
                            {deletingId === video.id ? 'Deleting…' : 'Delete video'}
                          </button>
                        </>
                      )}
                      <div className="mt-3 space-y-2 text-xs">
                        <label className="block text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                          Add to playlist
                        </label>
                        <select
                          className="w-full rounded-input border border-hairline bg-bg px-2 py-1 text-xs text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        {assignedPlaylists.length ? (
                          <div className="flex flex-wrap gap-2">
                            {assignedPlaylists.map((playlist) => (
                              <button
                                key={`${video.id}-${playlist.id}`}
                                type="button"
                                onClick={() => handleRemoveFromPlaylist(video, playlist.id)}
                                disabled={isAssigningPlaylist}
                                className="inline-flex items-center gap-1 rounded-pill border border-border bg-bg px-2 py-1 text-[11px] text-text-secondary transition hover:border-rose-300 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
                              >
                                {playlist.name}
                                <span aria-hidden>×</span>
                                <span className="sr-only">Remove from {playlist.name}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {playlistMessage ? (
                          <p className="text-[11px] text-emerald-600">{playlistMessage}</p>
                        ) : null}
                        {playlistErrorMessage ? (
                          <p className="text-[11px] text-rose-600">{playlistErrorMessage}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
          {nextCursor ? (
            <div className="border-t border-border bg-white px-4 py-3 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="rounded-input border border-border bg-bg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
