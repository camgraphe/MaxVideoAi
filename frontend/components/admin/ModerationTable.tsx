"use client";

import Link from 'next/link';
import Image from 'next/image';
import clsx from 'clsx';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { TARGET_MODERATION_PLAYLIST_SLUGS } from '@/config/playlists';
import { authFetch } from '@/lib/authFetch';
import { isPlaceholderMediaUrl, normalizeMediaUrl } from '@/lib/media';

type PlaylistOption = {
  id: string;
  name: string;
  slug: string;
};

type PlaylistTag = {
  id: string;
  name: string;
};

export type PublicationState = 'published' | 'private' | 'legacy-mismatch';
export type ModerationBucket = 'not-published' | 'published' | 'all';
export type ModerationSurface = 'video' | 'image' | 'audio' | 'character' | 'angle';

export type ModerationVideo = {
  id: string;
  userId: string | null;
  status?: string | null;
  message?: string;
  updatedAt?: string;
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
  seoWatch: boolean;
  publicationState: PublicationState;
  isPublishedOnSite: boolean;
  hasLegacyMismatch: boolean;
};

type ModerationTableProps = {
  videos: ModerationVideo[];
  initialCursor: string | null;
  initialBucket?: ModerationBucket;
  initialSurface?: ModerationSurface;
};

type ModerationViewMode = 'wall' | 'table';

const TARGET_PLAYLIST_SLUGS = new Set<string>(TARGET_MODERATION_PLAYLIST_SLUGS as readonly string[]);
const FAILURE_STATES = new Set(['failed', 'error', 'errored', 'cancelled', 'canceled', 'aborted']);
const BUCKET_OPTIONS: Array<{ id: ModerationBucket; label: string; helper: string }> = [
  { id: 'not-published', label: 'Not published', helper: 'Anything not yet published on the site' },
  { id: 'published', label: 'Published', helper: 'Live on site and eligible for public surfaces' },
  { id: 'all', label: 'All', helper: 'Everything in the editorial publication queue' },
];
const SURFACE_OPTIONS: Array<{ id: ModerationSurface; label: string }> = [
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Image' },
  { id: 'audio', label: 'Audio' },
  { id: 'character', label: 'Character' },
  { id: 'angle', label: 'Angle' },
];

function compareChronologically(a: Pick<ModerationVideo, 'createdAt' | 'id'>, b: Pick<ModerationVideo, 'createdAt' | 'id'>) {
  const aTime = Number.isNaN(Date.parse(a.createdAt)) ? 0 : Date.parse(a.createdAt);
  const bTime = Number.isNaN(Date.parse(b.createdAt)) ? 0 : Date.parse(b.createdAt);
  if (aTime !== bTime) {
    return bTime - aTime;
  }
  return b.id.localeCompare(a.id);
}

function formatDate(value?: string | null) {
  if (!value) return 'Unknown';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function isFailedVideo(video: Pick<ModerationVideo, 'status'>) {
  const normalized = video.status?.trim().toLowerCase() ?? '';
  return FAILURE_STATES.has(normalized);
}

function resolvePublicationState(video: Pick<ModerationVideo, 'visibility' | 'indexable'>): PublicationState {
  if (video.visibility === 'public' && video.indexable) {
    return 'published';
  }
  if (video.visibility === 'private' && !video.indexable) {
    return 'private';
  }
  return 'legacy-mismatch';
}

function getPublicationLabel(video: Pick<ModerationVideo, 'visibility' | 'isPublishedOnSite'>) {
  if (video.isPublishedOnSite) return 'Published';
  if (video.visibility === 'private') return 'Private';
  return 'Not published';
}

function matchesBucket(video: Pick<ModerationVideo, 'status' | 'visibility' | 'isPublishedOnSite'>, bucket: ModerationBucket) {
  if (isFailedVideo(video)) return false;
  if (bucket === 'all') return true;
  if (bucket === 'published') return video.isPublishedOnSite;
  return !video.isPublishedOnSite;
}

function PublicationPill({ state }: { state: PublicationState }) {
  const className =
    state === 'published'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
      : 'border-warning-border/60 bg-warning-bg/20 text-warning';

  const label =
    state === 'published'
      ? 'Published'
      : state === 'private'
        ? 'Private'
        : 'Not published';

  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${className}`}>{label}</span>;
}

function StatePill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'ok' | 'warn' | 'neutral';
}) {
  const className =
    tone === 'ok'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
      : tone === 'warn'
        ? 'border-warning-border/60 bg-warning-bg/20 text-warning'
        : 'border-border bg-bg text-text-secondary';

  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${className}`}>{children}</span>;
}

export function ModerationTable({
  videos,
  initialCursor,
  initialBucket = 'not-published',
  initialSurface = 'video',
}: ModerationTableProps) {
  const initialPlaylistAssignments = useMemo(
    () =>
      videos.reduce<Record<string, PlaylistTag[]>>((acc, video) => {
        acc[video.id] = video.assignedPlaylists ?? [];
        return acc;
      }, {}),
    [videos]
  );

  const [items, setItems] = useState(videos);
  const [bucket, setBucket] = useState<ModerationBucket>(initialBucket);
  const [surface, setSurface] = useState<ModerationSurface>(initialSurface);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [isLoadingBucket, setLoadingBucket] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistFetchError, setPlaylistFetchError] = useState<string | null>(null);
  const [playlistAssignments, setPlaylistAssignments] = useState<Record<string, PlaylistTag[]>>(initialPlaylistAssignments);
  const [playlistStatus, setPlaylistStatus] = useState<Record<string, { loading: boolean; message: string | null; error: string | null }>>({});
  const [viewMode, setViewMode] = useState<ModerationViewMode>('wall');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(videos[0]?.id ?? null);
  const playlistAssignmentsRef = useRef<Record<string, PlaylistTag[]>>({});

  const displayItems = useMemo(() => [...items].sort(compareChronologically), [items]);
  const hasVideos = displayItems.length > 0;
  const selectedVideo = useMemo(
    () => displayItems.find((item) => item.id === selectedVideoId) ?? displayItems[0] ?? null,
    [displayItems, selectedVideoId]
  );

  const stats = useMemo(() => {
    const total = items.length;
    const publishedCount = items.filter((item) => item.isPublishedOnSite).length;
    const legacyMismatchCount = items.filter((item) => item.hasLegacyMismatch).length;
    const notPublishedCount = total - publishedCount;
    const seoWatchCount = items.filter((item) => item.seoWatch).length;
    return { total, publishedCount, legacyMismatchCount, notPublishedCount, seoWatchCount };
  }, [items]);

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
          (json.playlists as Array<{ id: string; name: string; slug: string }>).map((playlist) => ({
            id: playlist.id,
            name: playlist.name,
            slug: playlist.slug,
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

  const loadBucket = useCallback(
    async (nextBucket: ModerationBucket, options?: { append?: boolean; surface?: ModerationSurface }) => {
      const append = options?.append ?? false;
      const nextSurface = options?.surface ?? surface;
      if (append && !nextCursor) return;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingBucket(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: append ? '50' : '30',
          bucket: nextBucket,
          surface: nextSurface,
        });
        if (append && nextCursor) {
          params.set('cursor', nextCursor);
        }

        const response = await authFetch(`/api/admin/videos/pending?${params.toString()}`, {
          cache: 'no-store',
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok || !Array.isArray(json?.videos)) {
          throw new Error(json?.error ?? `Failed to load moderation queue (${response.status})`);
        }

        const incoming = json.videos as ModerationVideo[];

        if (append) {
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
            const nextAssignments = { ...current };
            incoming.forEach((item) => {
              nextAssignments[item.id] = item.assignedPlaylists ?? [];
            });
            return nextAssignments;
          });
        } else {
          setBucket(nextBucket);
          setSurface(nextSurface);
          setItems(incoming);
          setPlaylistAssignments(
            incoming.reduce<Record<string, PlaylistTag[]>>((acc, item) => {
              acc[item.id] = item.assignedPlaylists ?? [];
              return acc;
            }, {})
          );
          setPlaylistStatus({});
        }

        setNextCursor(typeof json.nextCursor === 'string' ? json.nextCursor : null);
      } catch (loadError) {
        console.error('[moderation] failed to load bucket', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load moderation queue');
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoadingBucket(false);
        }
      }
    },
    [nextCursor, surface]
  );

  const updateVisibility = useCallback(
    (video: ModerationVideo, visibility: 'public' | 'private', indexable: boolean) => {
      startTransition(async () => {
        setError(null);
        try {
          const response = await authFetch(`/api/admin/videos/${video.id}/visibility`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visibility, indexable }),
          });
          const json = await response.json().catch(() => null);
          if (!response.ok || !json?.ok || !json.video) {
            throw new Error(json?.error ?? 'Failed to update moderation state');
          }

          const nextVideo: ModerationVideo = {
            ...video,
            visibility: json.video.visibility === 'private' ? 'private' : 'public',
            indexable: Boolean(json.video.indexable),
          };
          nextVideo.publicationState = resolvePublicationState(nextVideo);
          nextVideo.isPublishedOnSite = nextVideo.publicationState === 'published';
          nextVideo.hasLegacyMismatch = nextVideo.publicationState === 'legacy-mismatch';

          setItems((current) => {
            if (!matchesBucket(nextVideo, bucket)) {
              return current.filter((item) => item.id !== video.id);
            }
            return current.map((item) => (item.id === video.id ? nextVideo : item));
          });
        } catch (updateError) {
          console.error('[moderation] update failed', updateError);
          setError(updateError instanceof Error ? updateError.message : 'Failed to update moderation state');
        }
      });
    },
    [bucket, startTransition]
  );

  const handleAssignToPlaylist = useCallback(
    async (video: ModerationVideo, playlistId: string) => {
      if (!playlistId) return;
      const existing = playlistAssignmentsRef.current[video.id] ?? [];
      if (existing.some((entry) => entry.id === playlistId) && video.isPublishedOnSite) {
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
        const publishedVideo: ModerationVideo | null =
          json?.video && typeof json.video === 'object'
            ? {
                ...video,
                visibility: json.video.visibility === 'private' ? 'private' : 'public',
                indexable: Boolean(json.video.indexable ?? true),
              }
            : null;
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
        if (publishedVideo) {
          publishedVideo.publicationState = resolvePublicationState(publishedVideo);
          publishedVideo.isPublishedOnSite = publishedVideo.publicationState === 'published';
          publishedVideo.hasLegacyMismatch = publishedVideo.publicationState === 'legacy-mismatch';
          setItems((current) => {
            if (!matchesBucket(publishedVideo, bucket)) {
              return current.filter((item) => item.id !== video.id);
            }
            return current.map((item) => (item.id === video.id ? publishedVideo : item));
          });
        }
        const successMessage = publishedVideo ? `Added to ${playlistName} and published on site` : `Added to ${playlistName}`;
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
    [bucket, getPlaylistName, scheduleStatusClear, updateStatusMessage]
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
      if (!enabled) return null;
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
            <label className="block text-[11px] font-semibold uppercase tracking-micro text-text-muted">Add to playlist</label>
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

  const renderModerationActions = useCallback(
    (video: ModerationVideo, options?: { compact?: boolean }) => {
      if (isFailedVideo(video)) {
        return null;
      }
      const compact = options?.compact ?? false;
      const baseClass = compact
        ? 'h-8 rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-micro'
        : 'rounded-input px-3 py-1 text-xs font-semibold uppercase tracking-micro';

      return (
        <>
          {video.isPublishedOnSite ? (
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
          ) : (
            <Button
              type="button"
              size="sm"
              className={clsx(baseClass, 'bg-success text-on-inverse hover:bg-success')}
              onClick={() => updateVisibility(video, 'public', true)}
              disabled={isPending}
            >
              Publish on site
            </Button>
          )}
        </>
      );
    },
    [isPending, updateVisibility]
  );

  return (
    <div className="stack-gap-lg">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Publication queue</h1>
            <p className="text-sm text-text-secondary">
              Manage publishable media by surface, publish or unpublish assets on the site, and curate playlists for video only. Incidents and
              failures live in Jobs. Google Video rollout stays separate.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SURFACE_OPTIONS.map((option) => {
              const active = surface === option.id;
              return (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isLoadingBucket}
                  onClick={() => void loadBucket(bucket, { surface: option.id })}
                  className={clsx(
                    'gap-2 border-border px-3 text-left',
                    active ? 'border-text-primary bg-surface text-text-primary' : 'bg-bg text-text-secondary hover:bg-surface'
                  )}
                >
                  <span>{option.label}</span>
                </Button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {BUCKET_OPTIONS.map((option) => {
              const active = bucket === option.id;
              return (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isLoadingBucket}
                  onClick={() => void loadBucket(option.id)}
                  className={clsx(
                    'gap-2 border-border px-3 text-left',
                    active ? 'border-text-primary bg-surface text-text-primary' : 'bg-bg text-text-secondary hover:bg-surface'
                  )}
                >
                  <span>{option.label}</span>
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-text-muted">
            {BUCKET_OPTIONS.find((option) => option.id === bucket)?.helper ?? 'Moderation queue'}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <ButtonLink href="/admin/jobs?outcome=failed_action_required" variant="outline" size="sm" prefetch={false}>
              Open job issues
            </ButtonLink>
            <ButtonLink href="/admin/jobs?outcome=refunded_failure_resolved" variant="outline" size="sm" prefetch={false}>
              Refunded failures
            </ButtonLink>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
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
            <ButtonLink href="/admin/video-seo" variant="outline" size="sm" prefetch={false}>
              Open Video SEO
            </ButtonLink>
          </div>
          <div className="grid gap-1 text-right text-xs text-text-muted sm:grid-cols-2 xl:grid-cols-3">
            <span>Rows: {stats.total}</span>
            <span>Not published: {stats.notPublishedCount}</span>
            <span>Published: {stats.publishedCount}</span>
            <span>Legacy mismatch: {stats.legacyMismatchCount}</span>
            <span>In Google Video rollout: {stats.seoWatchCount}</span>
          </div>
        </div>
      </header>

      {surface === 'video' && playlistFetchError ? (
        <div className="rounded-card border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning">{playlistFetchError}</div>
      ) : null}

      {error ? <div className="rounded-card border border-error-border bg-error-bg px-4 py-3 text-sm text-error">{error}</div> : null}

      {!hasVideos ? (
        <div className="rounded-card border border-hairline bg-surface p-8 text-center text-sm text-text-secondary">
          {isLoadingBucket ? 'Loading moderation queue…' : `No ${surface} items in this moderation bucket.`}
        </div>
      ) : viewMode === 'wall' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {displayItems.map((video) => {
              const isFailed = isFailedVideo(video);
              const canManagePlaylists = surface === 'video' && !isFailed;
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
                  <button type="button" onClick={() => setSelectedVideoId(video.id)} className="block w-full text-left">
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
                        <div className="flex h-full w-full items-center justify-center text-xs text-on-media-70">No preview</div>
                      )}
                      <div className="absolute left-2 top-2 flex flex-wrap gap-2">
                        <PublicationPill state={video.publicationState} />
                        {video.hasLegacyMismatch ? <StatePill tone="warn">Legacy mismatch</StatePill> : null}
                        {isFailed ? <StatePill tone="warn">Issue</StatePill> : null}
                        {video.seoWatch ? <StatePill tone="neutral">Google Video rollout</StatePill> : null}
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 py-2">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{video.engineLabel}</p>
                            <p className="text-[11px] text-white/70">
                              {getPublicationLabel(video)} · {video.durationSec}s
                              {video.aspectRatio ? ` · ${video.aspectRatio}` : ''}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/20 bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-white">
                            Queued
                          </span>
                        </div>
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
                    {renderPlaylistControls(video, { compact: true, emphasizeAssigned: true, enabled: canManagePlaylists })}
                    <div className="flex flex-wrap gap-2">
                      {renderModerationActions(video, { compact: true })}
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
                {(() => {
                  const selectedIsFailed = isFailedVideo(selectedVideo);
                  const canManageSelectedPlaylists = surface === 'video' && !selectedIsFailed;
                  return (
                    <>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Selected item</p>
                  <div className="relative aspect-video overflow-hidden rounded-card border border-hairline bg-black">
                    {selectedVideo.videoUrl ? (
                      <video
                        src={normalizeMediaUrl(selectedVideo.videoUrl) ?? selectedVideo.videoUrl}
                        poster={selectedVideo.thumbUrl ? normalizeMediaUrl(selectedVideo.thumbUrl) ?? selectedVideo.thumbUrl : undefined}
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
                      <div className="flex h-full w-full items-center justify-center text-xs text-on-media-70">No preview</div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-text-primary">{selectedVideo.engineLabel}</p>
                      <div className="flex flex-wrap gap-2">
                      <PublicationPill state={selectedVideo.publicationState} />
                      <StatePill tone={selectedVideo.isPublishedOnSite ? 'ok' : 'warn'}>
                        {getPublicationLabel(selectedVideo)}
                      </StatePill>
                      {selectedVideo.hasLegacyMismatch ? <StatePill tone="warn">Legacy mismatch</StatePill> : null}
                      {selectedIsFailed ? <StatePill tone="warn">Issue</StatePill> : null}
                      {selectedVideo.seoWatch ? (
                        <Link href="/admin/video-seo" className="inline-flex rounded-full border border-border bg-bg px-2 py-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary">
                          In Google Video rollout
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                    <span>Duration: {selectedVideo.durationSec}s</span>
                    <span>Aspect: {selectedVideo.aspectRatio ?? 'auto'}</span>
                    <span>Created: {formatDate(selectedVideo.createdAt)}</span>
                    <span>Updated: {selectedVideo.updatedAt ? formatDate(selectedVideo.updatedAt) : '—'}</span>
                    <span>User: {selectedVideo.userId ?? '—'}</span>
                    <span>Status: {selectedVideo.status ?? '—'}</span>
                  </div>

                  {selectedVideo.message ? (
                    <div className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning">
                      Runtime message: {selectedVideo.message}
                    </div>
                  ) : null}

                  <details className="rounded-md border border-border bg-bg px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-micro text-text-muted">Prompt</summary>
                    <p className="mt-2 text-sm text-text-secondary">{selectedVideo.prompt}</p>
                  </details>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Moderation</p>
                  <div className="flex flex-wrap gap-2">{renderModerationActions(selectedVideo)}</div>
                  {selectedIsFailed ? (
                    <p className="text-xs text-warning">This item should be handled in Job Audit, not in the editorial moderation queue.</p>
                  ) : (
                    <p className="text-xs text-text-muted">
                      Publishing on site controls whether the asset is live on public surfaces. Google Video rollout membership is managed separately.
                    </p>
                  )}
                  {selectedVideo.hasLegacyMismatch ? (
                    <p className="text-xs text-warning">
                      This row still has a legacy visibility/indexable mismatch. Publishing or making it private will normalize it.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {surface === 'video' && !selectedIsFailed && selectedVideo.isPublishedOnSite ? (
                    <ButtonLink href={`/video/${encodeURIComponent(selectedVideo.id)}`} variant="outline" size="sm" prefetch={false}>
                      Open watch page
                    </ButtonLink>
                  ) : null}
                  <ButtonLink href={`/admin/jobs?jobId=${encodeURIComponent(selectedVideo.id)}`} variant="outline" size="sm" prefetch={false}>
                    Open job audit
                  </ButtonLink>
                  {selectedVideo.seoWatch ? (
                    <ButtonLink href="/admin/video-seo" variant="outline" size="sm" prefetch={false}>
                      Open Video SEO
                    </ButtonLink>
                  ) : null}
                </div>

                {renderPlaylistControls(selectedVideo, { emphasizeAssigned: true, enabled: canManageSelectedPlaylists })}
                    </>
                  );
                })()}
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
                  onClick={() => void loadBucket(bucket, { append: true })}
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
                <th scope="col" className="px-4 py-3 text-left">State</th>
                <th scope="col" className="px-4 py-3 text-left">Prompt</th>
                <th scope="col" className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayItems.map((video) => {
                const isFailed = isFailedVideo(video);
                const normalizedVideoUrl = video.videoUrl ? normalizeMediaUrl(video.videoUrl) ?? video.videoUrl : undefined;
                const normalizedThumbUrl = video.thumbUrl ? normalizeMediaUrl(video.thumbUrl) ?? video.thumbUrl : undefined;
                const hasThumbPreview = Boolean(normalizedThumbUrl && !isPlaceholderMediaUrl(normalizedThumbUrl));
                const hasVideoPreview = Boolean(normalizedVideoUrl);
                const posterUrl = hasThumbPreview ? normalizedThumbUrl : undefined;
                const canOpenWatchPage = surface === 'video' && !isFailed && video.isPublishedOnSite;
                const canManagePlaylists = surface === 'video' && !isFailed;

                return (
                  <tr key={video.id} className={clsx(isPending && 'opacity-90')}>
                    <td className="px-4 py-4">
                      <div className="relative h-24 w-40 overflow-hidden rounded-card border border-hairline bg-black">
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
                          <Image src={normalizedThumbUrl} alt="Thumbnail" fill className="object-cover" sizes="160px" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-on-media-70">No preview</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2 text-xs text-text-secondary">
                        <div className="flex flex-wrap gap-2">
                          <PublicationPill state={video.publicationState} />
                          <StatePill tone={video.isPublishedOnSite ? 'ok' : 'warn'}>{getPublicationLabel(video)}</StatePill>
                          {video.hasLegacyMismatch ? <StatePill tone="warn">Legacy mismatch</StatePill> : null}
                          {isFailed ? <StatePill tone="warn">Issue</StatePill> : null}
                          {video.seoWatch ? <StatePill tone="neutral">Google Video rollout</StatePill> : null}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-text-primary">{video.engineLabel}</span>
                          <span>Duration: {video.durationSec}s</span>
                          <span>Aspect: {video.aspectRatio ?? 'auto'}</span>
                          <span>Created: {formatDate(video.createdAt)}</span>
                          {video.updatedAt ? <span>Updated: {formatDate(video.updatedAt)}</span> : null}
                          <span>User: {video.userId ?? '—'}</span>
                          {video.status ? <span>Status: {video.status}</span> : null}
                          {video.message ? <span className="text-warning">Runtime message: {video.message}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-xs text-text-secondary">
                      <p className="max-w-xs whitespace-pre-line">{video.prompt}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex min-w-[18rem] flex-col gap-3">
                        <div className="flex flex-wrap gap-2">{renderModerationActions(video)}</div>
                        <div>{renderPlaylistControls(video, { enabled: canManagePlaylists })}</div>
                        <div className="flex flex-wrap gap-2">
                          {canOpenWatchPage ? (
                            <ButtonLink href={`/video/${encodeURIComponent(video.id)}`} variant="outline" size="sm" prefetch={false}>
                              Watch page
                            </ButtonLink>
                          ) : null}
                          <ButtonLink href={`/admin/jobs?jobId=${encodeURIComponent(video.id)}`} variant="outline" size="sm" prefetch={false}>
                            Job audit
                          </ButtonLink>
                          {video.seoWatch ? (
                            <ButtonLink href="/admin/video-seo" variant="outline" size="sm" prefetch={false}>
                              Video SEO
                            </ButtonLink>
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
            <div className="border-t border-border bg-surface px-4 py-3 text-center">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void loadBucket(bucket, { append: true })}
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
