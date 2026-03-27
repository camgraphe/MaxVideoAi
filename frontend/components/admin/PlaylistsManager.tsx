"use client";

import Image from 'next/image';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition, type DragEvent, type FormEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';

type PlaylistKind = 'core' | 'model' | 'draft';

type PlaylistSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  siteVisibleCount: number;
  withVideoAssetCount: number;
  lastAddedAt: string | null;
  kind: PlaylistKind;
  isLocked: boolean;
  usageTargets: string[];
};

type PlaylistItemRecord = {
  playlistId: string;
  videoId: string;
  orderIndex: number;
  pinned: boolean;
  createdAt: string;
  thumbUrl?: string | null;
  videoUrl?: string | null;
  engineLabel?: string | null;
  aspectRatio?: string | null;
  prompt?: string | null;
  durationSec?: number | null;
  visibility: 'public' | 'private';
  indexable: boolean;
  isPublishedOnSite: boolean;
};

type PlaylistsManagerProps = {
  initialPlaylists: PlaylistSummary[];
  initialPlaylistId: string | null;
  initialItems: PlaylistItemRecord[];
};

type EditablePlaylist = PlaylistSummary & { dirty?: boolean; loading?: boolean };
type DropPlacement = 'before' | 'after';
type FutureCollectionSection = 'image' | 'audio' | 'character' | 'angle';

const PLACEHOLDER_MAP: Record<string, string> = {
  '9:16': '/assets/frames/thumb-9x16.svg',
  '16:9': '/assets/frames/thumb-16x9.svg',
  '1:1': '/assets/frames/thumb-1x1.svg',
};

const GROUP_LABELS: Record<PlaylistKind, string> = {
  core: 'Core surfaces',
  model: 'Model collections',
  draft: 'Draft / empty',
};

const FUTURE_SECTION_LABELS: Record<FutureCollectionSection, string> = {
  image: 'Image',
  audio: 'Audio',
  character: 'Character',
  angle: 'Angle',
};

function getPlaceholderThumb(aspectRatio?: string | null): string {
  const key = (aspectRatio ?? '').trim();
  return PLACEHOLDER_MAP[key] ?? '/assets/frames/thumb-16x9.svg';
}

function formatDate(value?: string | null): string {
  if (!value) return 'Never';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function compareDatesDescending(a?: string | null, b?: string | null) {
  const aTime = a ? Date.parse(a) : Number.NaN;
  const bTime = b ? Date.parse(b) : Number.NaN;
  const safeA = Number.isFinite(aTime) ? aTime : 0;
  const safeB = Number.isFinite(bTime) ? bTime : 0;
  return safeB - safeA;
}

function getPlaylistPriority(playlist: Pick<EditablePlaylist, 'kind' | 'slug' | 'usageTargets'>) {
  if (playlist.usageTargets.includes('starter-tab')) {
    return 0;
  }
  if (playlist.usageTargets.includes('examples-hub')) {
    return 1;
  }
  return 2;
}

function comparePlaylists(a: EditablePlaylist, b: EditablePlaylist) {
  const kindWeight: Record<PlaylistKind, number> = { core: 0, model: 1, draft: 2 };
  if (kindWeight[a.kind] !== kindWeight[b.kind]) {
    return kindWeight[a.kind] - kindWeight[b.kind];
  }
  const priorityDelta = getPlaylistPriority(a) - getPlaylistPriority(b);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }
  if (a.itemCount !== b.itemCount) {
    return b.itemCount - a.itemCount;
  }
  const lastAddedDelta = compareDatesDescending(a.lastAddedAt, b.lastAddedAt);
  if (lastAddedDelta !== 0) {
    return lastAddedDelta;
  }
  return a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
}

function sortPlaylists(playlists: EditablePlaylist[]): EditablePlaylist[] {
  return [...playlists].sort(comparePlaylists);
}

function getUsageLabel(target: string): string {
  if (target === 'starter-tab') return 'Starter tab';
  if (target === 'examples-hub') return 'Examples hub';
  if (target.startsWith('model-page:')) {
    return `Model page · ${target.slice('model-page:'.length)}`;
  }
  return target;
}

function summarizePlaylist(playlist: PlaylistSummary): string {
  if (!playlist.itemCount) return 'Empty collection';
  return `${playlist.itemCount} items · ${playlist.siteVisibleCount} live · ${playlist.withVideoAssetCount} with video`;
}

function buildPlaylistUpdateFromItems(playlist: EditablePlaylist, items: PlaylistItemRecord[]): EditablePlaylist {
  const lastAddedAt = items.reduce<string | null>((latest, item) => {
    if (!latest) return item.createdAt;
    return compareDatesDescending(item.createdAt, latest) < 0 ? item.createdAt : latest;
  }, null);

  return {
    ...playlist,
    itemCount: items.length,
    siteVisibleCount: items.filter((item) => item.isPublishedOnSite).length,
    withVideoAssetCount: items.filter((item) => Boolean(item.videoUrl)).length,
    lastAddedAt,
  };
}

function sortItemsForDisplay(items: PlaylistItemRecord[]): PlaylistItemRecord[] {
  return [...items].sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) {
      return b.orderIndex - a.orderIndex;
    }
    return compareDatesDescending(a.createdAt, b.createdAt);
  });
}

function StatusPill({
  tone,
  children,
}: {
  tone: 'neutral' | 'ok' | 'warn';
  children: ReactNode;
}) {
  const classes =
    tone === 'ok'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
      : tone === 'warn'
        ? 'border-warning-border/60 bg-warning-bg/20 text-warning'
        : 'border-border bg-bg text-text-secondary';

  return <span className={clsx('inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold', classes)}>{children}</span>;
}

export function PlaylistsManager({ initialPlaylists, initialPlaylistId, initialItems }: PlaylistsManagerProps) {
  const [playlists, setPlaylists] = useState<EditablePlaylist[]>(() => sortPlaylists(initialPlaylists));
  const [selectedId, setSelectedId] = useState<string | null>(initialPlaylistId);
  const [items, setItems] = useState<PlaylistItemRecord[]>(() => sortItemsForDisplay(initialItems));
  const [isItemsDirty, setItemsDirty] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropAtEnd, setDropAtEnd] = useState(false);
  const [dropPlacement, setDropPlacement] = useState<DropPlacement>('before');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDraftCollections, setShowDraftCollections] = useState(false);
  const [showModelCollections, setShowModelCollections] = useState(true);
  const [expandedFutureSections, setExpandedFutureSections] = useState<Record<FutureCollectionSection, boolean>>({
    image: false,
    audio: false,
    character: false,
    angle: false,
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const dragGhostRef = useRef<HTMLElement | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const dropPlacementRef = useRef<DropPlacement>('before');

  useEffect(() => {
    setPlaylists(sortPlaylists(initialPlaylists));
    setSelectedId(initialPlaylistId);
    setItems(sortItemsForDisplay(initialItems));
    setItemsDirty(false);
    setDraggingId(null);
    setDropTargetId(null);
    setDropAtEnd(false);
    setDropPlacement('before');
    draggingIdRef.current = null;
    dropPlacementRef.current = 'before';
  }, [initialItems, initialPlaylistId, initialPlaylists]);

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedId) ?? null,
    [playlists, selectedId]
  );

  const groupedPlaylists = useMemo(
    () => ({
      core: playlists.filter((playlist) => playlist.kind === 'core'),
      model: playlists.filter((playlist) => playlist.kind === 'model'),
      draft: playlists.filter((playlist) => playlist.kind === 'draft'),
    }),
    [playlists]
  );

  const refreshPlaylistItems = useCallback((playlistId: string) => {
    startTransition(async () => {
      try {
        const res = await authFetch(`/api/admin/playlists/${playlistId}`);
        if (!res.ok) throw new Error(`Failed to load items (${res.status})`);
        const json = await res.json().catch(() => ({ ok: false }));
        if (!json?.ok || !Array.isArray(json.items)) {
          throw new Error(json?.error ?? 'Unable to load collection items');
        }

        const nextItems = json.items as PlaylistItemRecord[];
        const nextPlaylist = json.playlist as PlaylistSummary | undefined;
        setItems(sortItemsForDisplay(nextItems));
        setPlaylists((current) =>
          sortPlaylists(
            current.map((playlist) => {
              if (playlist.id !== playlistId) return playlist;
              const merged = nextPlaylist ? { ...playlist, ...nextPlaylist } : playlist;
              return { ...buildPlaylistUpdateFromItems(merged, nextItems), dirty: false, loading: false };
            })
          )
        );
        setItemsDirty(false);
        setDropTargetId(null);
        setDropAtEnd(false);
        setDropPlacement('before');
        draggingIdRef.current = null;
        dropPlacementRef.current = 'before';
      } catch (loadError) {
        console.error('[PlaylistsManager] load items failed', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load collection items');
      }
    });
  }, []);

  useEffect(() => {
    if (selectedPlaylist?.kind === 'draft') {
      setShowDraftCollections(true);
    }
  }, [selectedPlaylist?.kind]);

  const handleSelectPlaylist = useCallback(
    (playlistId: string) => {
      setSelectedId(playlistId);
      setFeedback(null);
      setError(null);
      refreshPlaylistItems(playlistId);
    },
    [refreshPlaylistItems]
  );

  const handleFieldChange = useCallback(
    (playlistId: string, field: 'name' | 'slug' | 'description', value: string) => {
      setPlaylists((current) =>
        sortPlaylists(
          current.map((playlist) =>
            playlist.id === playlistId
              ? {
                  ...playlist,
                  [field]: value,
                  dirty: true,
                }
              : playlist
          )
        )
      );
    },
    []
  );

  const handleSavePlaylist = useCallback(
    (playlistId: string) => {
      const playlist = playlists.find((entry) => entry.id === playlistId);
      if (!playlist || playlist.isLocked) return;

      startTransition(async () => {
        try {
          setFeedback(null);
          setError(null);
          setPlaylists((current) =>
            current.map((entry) => (entry.id === playlistId ? { ...entry, loading: true } : entry))
          );
          const res = await authFetch(`/api/admin/playlists/${playlistId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: playlist.name.trim(),
              slug: playlist.slug.trim(),
              description: playlist.description?.trim() ? playlist.description.trim() : null,
            }),
          });
          const json = await res.json().catch(() => ({ ok: false }));
          if (!res.ok || !json?.ok) {
            throw new Error(json?.error ?? `Failed to save collection (${res.status})`);
          }

          setFeedback('Collection details saved');
          setPlaylists((current) =>
            sortPlaylists(
              current.map((entry) =>
                entry.id === playlistId
                  ? { ...entry, dirty: false, loading: false, updatedAt: new Date().toISOString() }
                  : entry
              )
            )
          );
        } catch (saveError) {
          console.error('[PlaylistsManager] save playlist failed', saveError);
          setError(saveError instanceof Error ? saveError.message : 'Failed to save collection');
          setPlaylists((current) =>
            current.map((entry) => (entry.id === playlistId ? { ...entry, loading: false } : entry))
          );
        }
      });
    },
    [playlists]
  );

  const handleCreatePlaylist = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const name = createName.trim();
      const slug = createSlug.trim();
      if (!name || !slug) return;

      startTransition(async () => {
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
          setPlaylists((current) => sortPlaylists([{ ...playlist, dirty: false, loading: false }, ...current]));
          setSelectedId(playlist.id);
          setItems([]);
          setItemsDirty(false);
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
    [createDescription, createName, createSlug]
  );

  const handleDeletePlaylist = useCallback(
    (playlistId: string) => {
      const playlist = playlists.find((entry) => entry.id === playlistId);
      if (!playlist || playlist.isLocked) return;
      if (!window.confirm(`Delete collection "${playlist.name}"?`)) return;

      startTransition(async () => {
        try {
          setFeedback(null);
          setError(null);
          const res = await authFetch(`/api/admin/playlists/${playlistId}`, { method: 'DELETE' });
          const json = await res.json().catch(() => ({ ok: false }));
          if (!res.ok || !json?.ok) {
            throw new Error(json?.error ?? `Failed to delete collection (${res.status})`);
          }

          let nextSelectedId: string | null = null;
          setPlaylists((current) => {
            const filtered = current.filter((entry) => entry.id !== playlistId);
            nextSelectedId = filtered.find((entry) => entry.kind !== 'draft')?.id ?? filtered[0]?.id ?? null;
            return filtered;
          });

          setSelectedId(nextSelectedId);
          if (nextSelectedId) {
            refreshPlaylistItems(nextSelectedId);
          } else {
            setItems([]);
          }
          setFeedback('Collection deleted');
        } catch (deleteError) {
          console.error('[PlaylistsManager] delete playlist failed', deleteError);
          setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete collection');
        }
      });
    },
    [playlists, refreshPlaylistItems]
  );

  const handleRemoveVideo = useCallback(
    (videoId: string) => {
      if (!selectedId) return;
      startTransition(async () => {
        try {
          setFeedback(null);
          setError(null);
          const res = await authFetch(`/api/admin/playlists/${selectedId}/items?videoId=${encodeURIComponent(videoId)}`, {
            method: 'DELETE',
          });
          const json = await res.json().catch(() => ({ ok: false }));
          if (!res.ok || !json?.ok) {
            throw new Error(json?.error ?? `Failed to remove clip (${res.status})`);
          }
          refreshPlaylistItems(selectedId);
          setFeedback('Clip removed from collection');
        } catch (removeError) {
          console.error('[PlaylistsManager] remove video failed', removeError);
          setError(removeError instanceof Error ? removeError.message : 'Failed to remove clip');
        }
      });
    },
    [refreshPlaylistItems, selectedId]
  );

  const commitDragMove = useCallback((fromId: string, toId: string | null, placement: DropPlacement = 'before') => {
    setItems((current) => {
      const fromIndex = current.findIndex((item) => item.videoId === fromId);
      if (fromIndex === -1) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      const insertIndex = toId ? next.findIndex((item) => item.videoId === toId) : next.length;
      const targetIndex =
        insertIndex === -1 ? next.length : placement === 'after' ? insertIndex + 1 : insertIndex;
      next.splice(targetIndex, 0, moved);
      return next.map((item, orderIndex) => ({ ...item, orderIndex }));
    });
    setItemsDirty(true);
  }, []);

  const clearDragGhost = useCallback(() => {
    if (dragGhostRef.current) {
      dragGhostRef.current.remove();
      dragGhostRef.current = null;
    }
  }, []);

  const handleDragStart = useCallback((event: DragEvent<HTMLElement>, videoId: string) => {
    clearDragGhost();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', videoId);
    const source = event.currentTarget;
    const ghost = source.cloneNode(true) as HTMLElement;
    ghost.style.position = 'fixed';
    ghost.style.top = '-10000px';
    ghost.style.left = '-10000px';
    ghost.style.width = `${source.clientWidth}px`;
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.92';
    ghost.style.transform = 'scale(0.98)';
    ghost.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.28)';
    ghost.style.borderRadius = '20px';
    ghost.style.overflow = 'hidden';
    ghost.style.zIndex = '9999';
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    event.dataTransfer.setDragImage(ghost, source.clientWidth / 2, 32);
    draggingIdRef.current = videoId;
    dropPlacementRef.current = 'before';
    setDraggingId(videoId);
    setDropTargetId(null);
    setDropAtEnd(false);
    setDropPlacement('before');
  }, [clearDragGhost]);

  const handleDragEnd = useCallback(() => {
    clearDragGhost();
    draggingIdRef.current = null;
    dropPlacementRef.current = 'before';
    setDraggingId(null);
    setDropTargetId(null);
    setDropAtEnd(false);
    setDropPlacement('before');
  }, [clearDragGhost]);

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (event.target === event.currentTarget) {
      dropPlacementRef.current = 'after';
      setDropTargetId(null);
      setDropAtEnd(true);
      setDropPlacement('after');
    }
  }, []);

  const handleDropOnCard = useCallback(
    (event: DragEvent<HTMLElement>, targetVideoId: string) => {
      event.preventDefault();
      const activeDraggingId = draggingIdRef.current;
      if (!activeDraggingId || activeDraggingId === targetVideoId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const nextPlacement: DropPlacement =
        event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before';
      commitDragMove(activeDraggingId, targetVideoId, nextPlacement);
      draggingIdRef.current = null;
      dropPlacementRef.current = 'before';
      setDraggingId(null);
      setDropTargetId(null);
      setDropAtEnd(false);
      setDropPlacement('before');
    },
    [commitDragMove]
  );

  const handleDropAtEnd = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      const activeDraggingId = draggingIdRef.current;
      if (!activeDraggingId) return;
      commitDragMove(activeDraggingId, null, 'after');
      draggingIdRef.current = null;
      dropPlacementRef.current = 'before';
      setDraggingId(null);
      setDropTargetId(null);
      setDropAtEnd(false);
      setDropPlacement('before');
    },
    [commitDragMove]
  );

  const renderDropPlaceholder = useCallback(
    (key: string, targetVideoId: string | null, placement: DropPlacement) => (
      <div
        key={key}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const activeDraggingId = draggingIdRef.current;
          if (!activeDraggingId) return;
          commitDragMove(activeDraggingId, targetVideoId, placement);
          draggingIdRef.current = null;
          dropPlacementRef.current = 'before';
          setDraggingId(null);
          setDropTargetId(null);
          setDropAtEnd(false);
          setDropPlacement('before');
        }}
        className="rounded-card border-2 border-dashed border-brand/55 bg-brand/5 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)]"
      >
        <div className="flex aspect-video items-center justify-center rounded-card border border-white/30 bg-gradient-to-br from-brand/10 to-brand/5 text-center">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand/80">Drop here</p>
            <p className="text-xs text-text-muted">New gallery position</p>
          </div>
        </div>
      </div>
    ),
    [commitDragMove]
  );

  const handleSaveItems = useCallback(() => {
    if (!selectedId) return;
    startTransition(async () => {
      try {
        setError(null);
        const payload = [...items].reverse().map((item) => ({ videoId: item.videoId, pinned: item.pinned }));
        const res = await authFetch(`/api/admin/playlists/${selectedId}/items`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({ ok: false }));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error ?? `Failed to save order (${res.status})`);
        }
        setItemsDirty(false);
        setFeedback('Collection order saved');
      } catch (saveError) {
        console.error('[PlaylistsManager] save items failed', saveError);
        setError(saveError instanceof Error ? saveError.message : 'Failed to save collection order');
      }
    });
  }, [items, selectedId]);

  return (
    <div className={clsx('space-y-8', isItemsDirty && 'pb-28')}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Admin</p>
          <h1 className="text-3xl font-semibold text-text-primary">Collections curation</h1>
          <p className="max-w-3xl text-sm text-text-secondary">
            Curate the starter surface, examples hub, and model collections with a visual workflow. Runtime collections are
            locked for metadata and can only be edited through their clips and order.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDraftCollections((current) => !current)}
          >
            {showDraftCollections ? 'Hide draft / empty' : `Show draft / empty (${groupedPlaylists.draft.length})`}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowCreateForm((current) => !current)}
          >
            {showCreateForm ? 'Close new collection' : '+ New collection'}
          </Button>
        </div>
      </header>

      {showCreateForm ? (
        <section className="rounded-card border border-border bg-surface p-5 shadow-card">
          <form className="grid gap-3 lg:grid-cols-[1.2fr_1fr_minmax(0,1.5fr)_auto]" onSubmit={handleCreatePlaylist}>
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Name</span>
              <input
                type="text"
                value={createName}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setCreateName(nextName);
                  if (!createSlug.trim()) {
                    setCreateSlug(slugify(nextName));
                  }
                }}
                className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Homepage holiday edits"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Slug</span>
              <input
                type="text"
                value={createSlug}
                onChange={(event) => setCreateSlug(slugify(event.target.value))}
                className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="homepage-holiday-edits"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Description</span>
              <input
                type="text"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Optional internal note"
              />
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm" disabled={isPending || !createName.trim() || !createSlug.trim()}>
                Create
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {feedback ? (
        <div className="rounded-card border border-success-border bg-success-bg px-4 py-3 text-sm text-success">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-card border border-error-border bg-error-bg px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-6">
          {(['core', 'model', 'draft'] as PlaylistKind[]).map((kind) => {
            if (kind === 'draft' && !showDraftCollections) {
              return null;
            }
            const entries = groupedPlaylists[kind];
            if (!entries.length) return null;
            const isCollapsible = kind === 'model';
            const isExpanded = kind === 'model' ? showModelCollections : true;

            return (
              <section key={kind} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  {isCollapsible ? (
                    <button
                      type="button"
                      onClick={() => setShowModelCollections((current) => !current)}
                      className="flex min-w-0 items-center gap-2 text-left"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className={clsx('h-4 w-4 text-text-muted transition-transform', isExpanded ? 'rotate-90' : 'rotate-0')}
                      >
                        <path
                          d="M7.5 5.5 12 10l-4.5 4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                      <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{GROUP_LABELS[kind]}</h2>
                    </button>
                  ) : (
                    <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{GROUP_LABELS[kind]}</h2>
                  )}
                  <span className="text-xs text-text-muted">{entries.length}</span>
                </div>
                {isExpanded ? <div className="space-y-2">
                  {entries.map((playlist) => {
                    const isActive = playlist.id === selectedId;
                    return (
                      <button
                        key={playlist.id}
                        type="button"
                        onClick={() => handleSelectPlaylist(playlist.id)}
                        className={clsx(
                          'w-full rounded-card border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                          isActive
                            ? 'border-brand bg-surface-2 shadow-card'
                            : 'border-hairline bg-surface hover:border-text-muted hover:bg-surface-2'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-semibold text-text-primary">{playlist.name}</p>
                            <p className="truncate text-xs text-text-muted">{playlist.slug}</p>
                          </div>
                          {playlist.isLocked ? <StatusPill tone="neutral">Locked</StatusPill> : null}
                        </div>
                        <p className="mt-3 text-xs text-text-secondary">{summarizePlaylist(playlist)}</p>
                        <p className="mt-1 text-[11px] text-text-muted">Last added: {formatDate(playlist.lastAddedAt)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {playlist.usageTargets.map((target) => (
                            <StatusPill key={target} tone={playlist.kind === 'core' ? 'ok' : 'neutral'}>
                              {getUsageLabel(target)}
                            </StatusPill>
                          ))}
                          {playlist.kind === 'draft' && !playlist.itemCount ? (
                            <StatusPill tone="warn">Empty placeholder</StatusPill>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div> : null}
              </section>
            );
          })}

          {(Object.keys(FUTURE_SECTION_LABELS) as FutureCollectionSection[]).map((section) => {
            const expanded = expandedFutureSections[section];
            return (
              <section key={section} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedFutureSections((current) => ({
                        ...current,
                        [section]: !current[section],
                      }))
                    }
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                      className={clsx('h-4 w-4 text-text-muted transition-transform', expanded ? 'rotate-90' : 'rotate-0')}
                    >
                      <path
                        d="M7.5 5.5 12 10l-4.5 4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                    <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{FUTURE_SECTION_LABELS[section]}</h2>
                  </button>
                  <span className="text-xs text-text-muted">0</span>
                </div>
                {expanded ? (
                  <div className="rounded-card border border-dashed border-hairline bg-surface px-4 py-4 text-sm text-text-secondary">
                    No collections yet.
                  </div>
                ) : null}
              </section>
            );
          })}
        </aside>

        <section className="space-y-6">
          {selectedPlaylist ? (
            <>
              <section className="rounded-card border border-border bg-surface p-6 shadow-card">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-text-primary">{selectedPlaylist.name}</h2>
                      <StatusPill tone={selectedPlaylist.kind === 'core' ? 'ok' : selectedPlaylist.kind === 'model' ? 'neutral' : 'warn'}>
                        {selectedPlaylist.kind === 'core' ? 'Core surface' : selectedPlaylist.kind === 'model' ? 'Model collection' : 'Draft'}
                      </StatusPill>
                      {selectedPlaylist.isLocked ? <StatusPill tone="neutral">Locked by runtime</StatusPill> : null}
                    </div>
                    <p className="text-sm text-text-secondary">
                      {selectedPlaylist.isLocked
                        ? 'This collection powers a live runtime surface. You can curate clips and order, but metadata is read-only here.'
                        : 'Editable collection metadata. Clips and ordering are managed separately below.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!selectedPlaylist.isLocked ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeletePlaylist(selectedPlaylist.id)}
                          disabled={isPending}
                        >
                          Delete collection
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSavePlaylist(selectedPlaylist.id)}
                          disabled={!selectedPlaylist.dirty || isPending}
                        >
                          Save details
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="text-sm">
                    <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Name</span>
                    <input
                      type="text"
                      value={selectedPlaylist.name}
                      onChange={(event) => handleFieldChange(selectedPlaylist.id, 'name', event.target.value)}
                      disabled={selectedPlaylist.isLocked}
                      className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-surface-2 disabled:text-text-muted"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Slug</span>
                    <input
                      type="text"
                      value={selectedPlaylist.slug}
                      onChange={(event) => handleFieldChange(selectedPlaylist.id, 'slug', slugify(event.target.value))}
                      disabled={selectedPlaylist.isLocked}
                      className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-surface-2 disabled:text-text-muted"
                    />
                  </label>
                </div>

                <label className="mt-4 block text-sm">
                  <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Description</span>
                  <textarea
                    value={selectedPlaylist.description ?? ''}
                    onChange={(event) => handleFieldChange(selectedPlaylist.id, 'description', event.target.value)}
                    disabled={selectedPlaylist.isLocked}
                    rows={3}
                    className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-surface-2 disabled:text-text-muted"
                  />
                </label>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-card border border-hairline bg-bg px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Items</p>
                    <p className="mt-2 text-lg font-semibold text-text-primary">{selectedPlaylist.itemCount}</p>
                  </div>
                  <div className="rounded-card border border-hairline bg-bg px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Live on site</p>
                    <p className="mt-2 text-lg font-semibold text-text-primary">{selectedPlaylist.siteVisibleCount}</p>
                  </div>
                  <div className="rounded-card border border-hairline bg-bg px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Last added</p>
                    <p className="mt-2 text-sm font-semibold text-text-primary">{formatDate(selectedPlaylist.lastAddedAt)}</p>
                  </div>
                </div>

                {selectedPlaylist.usageTargets.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedPlaylist.usageTargets.map((target) => (
                      <StatusPill key={target} tone="neutral">
                        {getUsageLabel(target)}
                      </StatusPill>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="rounded-card border border-border bg-surface p-6 shadow-card">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">Collection items</h2>
                    <p className="text-sm text-text-secondary">
                      Drag clips with the mouse, then save the live gallery order.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveItems}
                    disabled={!isItemsDirty || isPending}
                    className={clsx(isItemsDirty && 'shadow-card ring-2 ring-brand/20')}
                  >
                    Save order
                  </Button>
                </div>

                {items.length ? (
                  <div
                    className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                    onDragOver={handleDragOver}
                    onDrop={handleDropAtEnd}
                  >
                    {items.map((item, index) => (
                      <Fragment key={item.videoId}>
                        {draggingId && dropTargetId === item.videoId && dropPlacement === 'before'
                          ? renderDropPlaceholder(`placeholder-before-${item.videoId}`, item.videoId, 'before')
                          : null}
                        <article
                          draggable
                          onDragStart={(event) => handleDragStart(event, item.videoId)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(event) => {
                            handleDragOver(event);
                            const activeDraggingId = draggingIdRef.current;
                            if (!activeDraggingId || activeDraggingId === item.videoId) return;
                            const rect = event.currentTarget.getBoundingClientRect();
                            const nextPlacement: DropPlacement =
                              event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before';
                            dropPlacementRef.current = nextPlacement;
                            setDropTargetId(item.videoId);
                            setDropAtEnd(false);
                            setDropPlacement(nextPlacement);
                          }}
                          onDrop={(event) => handleDropOnCard(event, item.videoId)}
                          className={clsx(
                            'overflow-hidden rounded-card border border-hairline bg-bg shadow-card transition cursor-grab active:cursor-grabbing',
                            draggingId === item.videoId && 'scale-[0.985] opacity-35'
                          )}
                        >
                          <div className="relative aspect-video overflow-hidden bg-placeholder">
                            <Image
                              src={item.thumbUrl || getPlaceholderThumb(item.aspectRatio)}
                              alt={`Thumbnail for ${item.videoId}`}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 via-black/25 to-transparent p-3">
                              <StatusPill tone="neutral">#{index + 1}</StatusPill>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemoveVideo(item.videoId)}
                                disabled={isPending}
                                className="min-h-[32px] rounded-full border-white/35 bg-black/35 px-2.5 text-white hover:border-white/60 hover:bg-black/50 hover:text-white"
                                aria-label={`Remove ${item.engineLabel ?? item.videoId} from collection`}
                              >
                                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
                                  <path d="M7.5 2.5h5a1 1 0 0 1 1 1V5H17a.75.75 0 0 1 0 1.5h-.64l-.62 9.23A2 2 0 0 1 13.75 17.5h-7.5a2 2 0 0 1-1.99-1.77L3.64 6.5H3A.75.75 0 0 1 3 5h3.5V3.5a1 1 0 0 1 1-1Zm4.5 2.5V4h-4v1h4Zm-3 3.25a.75.75 0 0 0-1.5 0v5a.75.75 0 0 0 1.5 0v-5Zm3.5-.75a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5a.75.75 0 0 1 .75-.75Z" />
                                </svg>
                              </Button>
                            </div>
                          </div>

                          <div className="px-4 py-4">
                            <p className="truncate text-sm font-semibold text-text-primary">
                              {item.engineLabel ?? 'Unknown model'}
                            </p>
                          </div>
                        </article>
                        {draggingId && dropTargetId === item.videoId && dropPlacement === 'after'
                          ? renderDropPlaceholder(`placeholder-after-${item.videoId}`, item.videoId, 'after')
                          : null}
                      </Fragment>
                    ))}
                    {draggingId && dropAtEnd ? renderDropPlaceholder('placeholder-end', null, 'after') : null}
                  </div>
                ) : (
                  <div className="mt-5 rounded-card border border-dashed border-hairline bg-bg px-4 py-8 text-center text-sm text-text-secondary">
                    This collection is empty. Add clips from moderation, then reorder them here.
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="rounded-card border border-dashed border-hairline bg-surface p-10 text-center text-sm text-text-secondary">
              Select a collection from the left rail to start curating.
            </div>
          )}
        </section>
      </div>

      {selectedPlaylist && isItemsDirty ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex w-full max-w-xl items-center justify-between gap-4 rounded-full border border-brand/30 bg-surface/95 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">Order changed</p>
              <p className="truncate text-xs text-text-secondary">{selectedPlaylist.name}</p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveItems}
              disabled={isPending}
              className="shrink-0 shadow-card ring-2 ring-brand/20"
            >
              Save order
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
