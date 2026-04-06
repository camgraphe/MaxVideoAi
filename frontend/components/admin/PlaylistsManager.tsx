"use client";

import Image from 'next/image';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';
import { getExampleFamilyDescriptor, getExampleFamilyIds, getExampleFamilyModelSlugs } from '@/lib/model-families';

type PlaylistKind = 'core' | 'model' | 'draft';
type PlaylistSurfaceRole = 'starter' | 'examplesHub' | 'family' | 'model' | 'draft' | 'other';
type PlaylistSurfaceStatus = 'ready' | 'missing' | 'empty' | 'other';
type PlaylistGroup = 'runtime' | 'family' | 'model' | 'draft';

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
  surfaceRole: PlaylistSurfaceRole;
  surfaceStatus: PlaylistSurfaceStatus;
  familyId: string | null;
  modelSlug: string | null;
  helperText: string | null;
  drivesRoute: string | null;
  fallbackModelSlugs: string[];
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
type FamilyPlaylistHelperCard = {
  familyId: string;
  label: string;
  slug: string;
  route: string;
  fallbackModelSlugs: string[];
  helperText: string;
  status: 'ready' | 'missing' | 'empty';
  playlistId: string | null;
};

const PLACEHOLDER_MAP: Record<string, string> = {
  '9:16': '/assets/frames/thumb-9x16.svg',
  '16:9': '/assets/frames/thumb-16x9.svg',
  '1:1': '/assets/frames/thumb-1x1.svg',
};

const GROUP_LABELS: Record<PlaylistGroup, string> = {
  runtime: 'Runtime surfaces',
  family: 'Family playlists',
  model: 'Model playlists',
  draft: 'Draft / misc',
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

function getPlaylistPriority(playlist: Pick<EditablePlaylist, 'surfaceRole'>) {
  if (playlist.surfaceRole === 'starter') return 0;
  if (playlist.surfaceRole === 'examplesHub') return 1;
  if (playlist.surfaceRole === 'family') return 2;
  if (playlist.surfaceRole === 'model') return 3;
  if (playlist.surfaceRole === 'other') return 4;
  return 5;
}

function comparePlaylists(a: EditablePlaylist, b: EditablePlaylist) {
  const priorityDelta = getPlaylistPriority(a) - getPlaylistPriority(b);
  if (priorityDelta !== 0) return priorityDelta;
  if (a.itemCount !== b.itemCount) return b.itemCount - a.itemCount;
  const lastAddedDelta = compareDatesDescending(a.lastAddedAt, b.lastAddedAt);
  if (lastAddedDelta !== 0) return lastAddedDelta;
  return a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
}

function sortPlaylists(playlists: EditablePlaylist[]): EditablePlaylist[] {
  return [...playlists].sort(comparePlaylists);
}

function getUsageLabel(target: string): string {
  if (target === 'starter-tab') return 'Starter tab';
  if (target === 'examples-hub') return 'Examples hub';
  if (target.startsWith('family-page:')) {
    return `Family page · ${target.slice('family-page:'.length)}`;
  }
  if (target.startsWith('family-fallback:')) {
    return `Family fallback · ${target.slice('family-fallback:'.length)}`;
  }
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

function getPlaylistGroup(playlist: Pick<PlaylistSummary, 'surfaceRole'>): PlaylistGroup {
  if (playlist.surfaceRole === 'starter' || playlist.surfaceRole === 'examplesHub') {
    return 'runtime';
  }
  if (playlist.surfaceRole === 'family') {
    return 'family';
  }
  if (playlist.surfaceRole === 'model') {
    return 'model';
  }
  return 'draft';
}

function buildFamilyHelpers(playlists: PlaylistSummary[]): FamilyPlaylistHelperCard[] {
  const byFamilyId = new Map<string, PlaylistSummary>();
  playlists.forEach((playlist) => {
    if (playlist.surfaceRole === 'family' && playlist.familyId) {
      byFamilyId.set(playlist.familyId, playlist);
    }
  });

  return getExampleFamilyIds().map((familyId) => {
    const descriptor = getExampleFamilyDescriptor(familyId);
    const playlist = byFamilyId.get(familyId) ?? null;
    const fallbackModelSlugs = getExampleFamilyModelSlugs(familyId);
    return {
      familyId,
      label: descriptor?.label ?? familyId,
      slug: `family-${familyId}`,
      route: `/examples/${familyId}`,
      fallbackModelSlugs,
      helperText: `Feeds /examples/${familyId}. Auto-fills from ${
        fallbackModelSlugs.length
          ? `${fallbackModelSlugs.map((modelSlug) => `examples-${modelSlug}`).join(', ')} then examples`
          : 'examples'
      }.`,
      status: playlist ? (playlist.itemCount > 0 ? 'ready' : 'empty') : 'missing',
      playlistId: playlist?.id ?? null,
    };
  });
}

function sortItemsForDisplay(items: PlaylistItemRecord[]): PlaylistItemRecord[] {
  return [...items].sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) {
      return b.orderIndex - a.orderIndex;
    }
    return compareDatesDescending(a.createdAt, b.createdAt);
  });
}

function getSurfaceRoleLabel(role: PlaylistSurfaceRole): string {
  switch (role) {
    case 'starter':
      return 'Starter surface';
    case 'examplesHub':
      return 'Examples hub';
    case 'family':
      return 'Family playlist';
    case 'model':
      return 'Model playlist';
    case 'draft':
      return 'Draft';
    case 'other':
    default:
      return 'Misc collection';
  }
}

function getSurfaceRoleTone(role: PlaylistSurfaceRole): 'neutral' | 'ok' | 'warn' {
  if (role === 'starter' || role === 'examplesHub') return 'ok';
  if (role === 'family' || role === 'model') return 'neutral';
  return 'warn';
}

function getSurfaceStatusTone(status: PlaylistSurfaceStatus | FamilyPlaylistHelperCard['status']): 'neutral' | 'ok' | 'warn' {
  if (status === 'ready') return 'ok';
  if (status === 'missing' || status === 'empty') return 'warn';
  return 'neutral';
}

function getSurfaceStatusLabel(status: PlaylistSurfaceStatus | FamilyPlaylistHelperCard['status']): string {
  if (status === 'ready') return 'Ready';
  if (status === 'missing') return 'Missing';
  if (status === 'empty') return 'Empty';
  return 'General';
}

function buildHelperFallbackLabel(modelSlug: string): string {
  return `examples-${modelSlug}`;
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

function PlaylistRailCard({
  playlist,
  isActive,
  onSelect,
}: {
  playlist: EditablePlaylist;
  isActive: boolean;
  onSelect: (playlistId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(playlist.id)}
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
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <StatusPill tone={getSurfaceRoleTone(playlist.surfaceRole)}>{getSurfaceRoleLabel(playlist.surfaceRole)}</StatusPill>
          <StatusPill tone={getSurfaceStatusTone(playlist.surfaceStatus)}>{getSurfaceStatusLabel(playlist.surfaceStatus)}</StatusPill>
        </div>
      </div>
      <p className="mt-3 text-xs text-text-secondary">{summarizePlaylist(playlist)}</p>
      {playlist.helperText ? <p className="mt-2 text-[11px] leading-5 text-text-muted">{playlist.helperText}</p> : null}
      <p className="mt-2 text-[11px] text-text-muted">Last added: {formatDate(playlist.lastAddedAt)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {playlist.usageTargets.map((target) => (
          <StatusPill key={target} tone={playlist.surfaceRole === 'starter' || playlist.surfaceRole === 'examplesHub' ? 'ok' : 'neutral'}>
            {getUsageLabel(target)}
          </StatusPill>
        ))}
        {playlist.isLocked ? <StatusPill tone="neutral">Locked</StatusPill> : null}
      </div>
    </button>
  );
}

function MissingFamilyCard({
  helper,
  onCreate,
  onSeed,
  pending,
}: {
  helper: FamilyPlaylistHelperCard;
  onCreate: (familyId: string) => void;
  onSeed: (familyId: string) => void;
  pending: boolean;
}) {
  return (
    <div className="rounded-card border border-dashed border-hairline bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-semibold text-text-primary">{helper.label}</p>
          <p className="truncate text-xs text-text-muted">{helper.slug}</p>
        </div>
        <StatusPill tone={getSurfaceStatusTone(helper.status)}>{getSurfaceStatusLabel(helper.status)}</StatusPill>
      </div>
      <p className="mt-3 text-xs text-text-secondary">{helper.helperText}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusPill tone="neutral">{helper.route}</StatusPill>
        {helper.fallbackModelSlugs.map((modelSlug) => (
          <StatusPill key={modelSlug} tone="neutral">
            {buildHelperFallbackLabel(modelSlug)}
          </StatusPill>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onCreate(helper.familyId)} disabled={pending}>
          Create empty
        </Button>
        <Button type="button" size="sm" onClick={() => onSeed(helper.familyId)} disabled={pending}>
          Seed from auto
        </Button>
      </div>
    </div>
  );
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
  const [showFamilyCollections, setShowFamilyCollections] = useState(true);
  const [showModelCollections, setShowModelCollections] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const dragGhostRef = useRef<HTMLElement | null>(null);
  const draggingIdRef = useRef<string | null>(null);

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
  }, [initialItems, initialPlaylistId, initialPlaylists]);

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedId) ?? null,
    [playlists, selectedId]
  );

  useEffect(() => {
    if (selectedPlaylist && getPlaylistGroup(selectedPlaylist) === 'draft') {
      setShowDraftCollections(true);
    }
  }, [selectedPlaylist]);

  const groupedPlaylists = useMemo(
    () => ({
      runtime: playlists.filter((playlist) => getPlaylistGroup(playlist) === 'runtime'),
      family: playlists.filter((playlist) => getPlaylistGroup(playlist) === 'family'),
      model: playlists.filter((playlist) => getPlaylistGroup(playlist) === 'model'),
      draft: playlists.filter((playlist) => getPlaylistGroup(playlist) === 'draft'),
    }),
    [playlists]
  );

  const familyHelpers = useMemo(() => buildFamilyHelpers(playlists), [playlists]);

  const clearDragState = useCallback(() => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
    setDropAtEnd(false);
    setDropPlacement('before');
  }, []);

  const clearDragGhost = useCallback(() => {
    if (dragGhostRef.current) {
      dragGhostRef.current.remove();
      dragGhostRef.current = null;
    }
  }, []);

  const syncPlaylistDetail = useCallback(
    (playlistId: string, nextPlaylist: PlaylistSummary | undefined, nextItems: PlaylistItemRecord[], basePlaylists?: EditablePlaylist[]) => {
      setItems(sortItemsForDisplay(nextItems));
      setPlaylists((current) => {
        const source = basePlaylists ?? current;
        let found = false;
        const mapped = source.map((playlist) => {
          if (playlist.id !== playlistId) return playlist;
          found = true;
          const merged = nextPlaylist ? { ...playlist, ...nextPlaylist } : playlist;
          return { ...buildPlaylistUpdateFromItems(merged, nextItems), dirty: false, loading: false };
        });
        if (!found && nextPlaylist) {
          mapped.push({ ...buildPlaylistUpdateFromItems({ ...nextPlaylist }, nextItems), dirty: false, loading: false });
        }
        return sortPlaylists(mapped);
      });
      setItemsDirty(false);
      clearDragState();
    },
    [clearDragState]
  );

  const refreshPlaylistItems = useCallback(
    async (playlistId: string, basePlaylists?: EditablePlaylist[]) => {
      const res = await authFetch(`/api/admin/playlists/${playlistId}`);
      if (!res.ok) {
        throw new Error(`Failed to load items (${res.status})`);
      }
      const json = await res.json().catch(() => ({ ok: false }));
      if (!json?.ok || !Array.isArray(json.items)) {
        throw new Error(json?.error ?? 'Unable to load collection items');
      }

      syncPlaylistDetail(playlistId, json.playlist as PlaylistSummary | undefined, json.items as PlaylistItemRecord[], basePlaylists);
    },
    [syncPlaylistDetail]
  );

  const refreshPlaylistsState = useCallback(
    async (preferredPlaylistId?: string | null) => {
      const res = await authFetch('/api/admin/playlists');
      if (!res.ok) {
        throw new Error(`Failed to load collections (${res.status})`);
      }
      const json = await res.json().catch(() => ({ ok: false }));
      if (!json?.ok || !Array.isArray(json.playlists)) {
        throw new Error(json?.error ?? 'Unable to load collections');
      }

      const nextPlaylists = sortPlaylists((json.playlists as PlaylistSummary[]).map((playlist) => ({ ...playlist })));
      const preferredId =
        preferredPlaylistId && nextPlaylists.some((playlist) => playlist.id === preferredPlaylistId)
          ? preferredPlaylistId
          : nextPlaylists.find((playlist) => getPlaylistGroup(playlist) !== 'draft')?.id ?? nextPlaylists[0]?.id ?? null;

      setPlaylists(nextPlaylists);
      setSelectedId(preferredId);
      if (preferredId) {
        await refreshPlaylistItems(preferredId, nextPlaylists);
      } else {
        setItems([]);
        setItemsDirty(false);
        clearDragState();
      }
      return { nextPlaylists, selectedId: preferredId };
    },
    [clearDragState, refreshPlaylistItems]
  );

  const handleSelectPlaylist = useCallback(
    (playlistId: string) => {
      setSelectedId(playlistId);
      setFeedback(null);
      setError(null);
      startTransition(async () => {
        try {
          await refreshPlaylistItems(playlistId);
        } catch (loadError) {
          console.error('[PlaylistsManager] load items failed', loadError);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load collection items');
        }
      });
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

          await refreshPlaylistsState(playlistId);
          setFeedback('Collection details saved');
        } catch (saveError) {
          console.error('[PlaylistsManager] save playlist failed', saveError);
          setError(saveError instanceof Error ? saveError.message : 'Failed to save collection');
          setPlaylists((current) =>
            current.map((entry) => (entry.id === playlistId ? { ...entry, loading: false } : entry))
          );
        }
      });
    },
    [playlists, refreshPlaylistsState]
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
    [createDescription, createName, createSlug, refreshPlaylistsState]
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

          const currentIndex = playlists.findIndex((entry) => entry.id === playlistId);
          const nextFallback =
            playlists.filter((entry) => entry.id !== playlistId).find((entry) => getPlaylistGroup(entry) !== 'draft')?.id ??
            playlists.filter((entry) => entry.id !== playlistId)[Math.max(0, currentIndex - 1)]?.id ??
            null;
          await refreshPlaylistsState(nextFallback);
          setFeedback('Collection deleted');
        } catch (deleteError) {
          console.error('[PlaylistsManager] delete playlist failed', deleteError);
          setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete collection');
        }
      });
    },
    [playlists, refreshPlaylistsState]
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
          await refreshPlaylistItems(selectedId);
          setFeedback('Clip removed from collection');
        } catch (removeError) {
          console.error('[PlaylistsManager] remove video failed', removeError);
          setError(removeError instanceof Error ? removeError.message : 'Failed to remove clip');
        }
      });
    },
    [refreshPlaylistItems, selectedId]
  );

  const handleCreateMissingFamilyPlaylists = useCallback(
    (preferredFamilyId?: string | null) => {
      startTransition(async () => {
        try {
          setFeedback(null);
          setError(null);
          const res = await authFetch('/api/admin/playlists/helpers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create-missing-family-playlists' }),
          });
          const json = await res.json().catch(() => ({ ok: false }));
          if (!res.ok || !json?.ok || !Array.isArray(json.playlists)) {
            throw new Error(json?.error ?? `Failed to create family playlists (${res.status})`);
          }
          const selectedFamilyPlaylistId =
            preferredFamilyId
              ? (json.playlists as PlaylistSummary[]).find((playlist) => playlist.familyId === preferredFamilyId)?.id ?? null
              : null;
          await refreshPlaylistsState(selectedFamilyPlaylistId ?? selectedId);
          setFeedback('Family playlists synced');
        } catch (helperError) {
          console.error('[PlaylistsManager] create missing family playlists failed', helperError);
          setError(helperError instanceof Error ? helperError.message : 'Failed to create family playlists');
        }
      });
    },
    [refreshPlaylistsState, selectedId]
  );

  const handleSeedFamilyPlaylist = useCallback(
    (familyId: string) => {
      startTransition(async () => {
        try {
          setFeedback(null);
          setError(null);
          const res = await authFetch('/api/admin/playlists/helpers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'seed-family-playlist', familyId }),
          });
          const json = await res.json().catch(() => ({ ok: false }));
          if (!res.ok || !json?.ok || !json.result?.playlist?.id) {
            throw new Error(json?.error ?? `Failed to seed family playlist (${res.status})`);
          }
          await refreshPlaylistsState(json.result.playlist.id as string);
          setFeedback(`Family playlist seeded for ${familyId}`);
        } catch (helperError) {
          console.error('[PlaylistsManager] seed family playlist failed', helperError);
          setError(helperError instanceof Error ? helperError.message : 'Failed to seed family playlist');
        }
      });
    },
    [refreshPlaylistsState]
  );

  const handleSeedAllFamilyPlaylists = useCallback(() => {
    startTransition(async () => {
      try {
        setFeedback(null);
        setError(null);
        const res = await authFetch('/api/admin/playlists/helpers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'seed-all-family-playlists' }),
        });
        const json = await res.json().catch(() => ({ ok: false }));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error ?? `Failed to seed family playlists (${res.status})`);
        }
        await refreshPlaylistsState(selectedId);
        setFeedback('All family playlists seeded from the current live order');
      } catch (helperError) {
        console.error('[PlaylistsManager] seed all family playlists failed', helperError);
        setError(helperError instanceof Error ? helperError.message : 'Failed to seed family playlists');
      }
    });
  }, [refreshPlaylistsState, selectedId]);

  const commitDragMove = useCallback((fromId: string, toId: string | null, placement: DropPlacement = 'before') => {
    setItems((current) => {
      const fromIndex = current.findIndex((item) => item.videoId === fromId);
      if (fromIndex === -1) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      const insertIndex = toId ? next.findIndex((item) => item.videoId === toId) : next.length;
      const targetIndex = insertIndex === -1 ? next.length : placement === 'after' ? insertIndex + 1 : insertIndex;
      next.splice(targetIndex, 0, moved);
      return next.map((item, orderIndex) => ({ ...item, orderIndex }));
    });
    setItemsDirty(true);
    clearDragState();
  }, [clearDragState]);

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
    setDraggingId(videoId);
    setDropTargetId(null);
    setDropAtEnd(false);
    setDropPlacement('before');
  }, [clearDragGhost]);

  const handleDragEnd = useCallback(() => {
    clearDragGhost();
    clearDragState();
  }, [clearDragGhost, clearDragState]);

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (event.target === event.currentTarget) {
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
      const nextPlacement: DropPlacement = event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before';
      commitDragMove(activeDraggingId, targetVideoId, nextPlacement);
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
        setFeedback(null);
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
        await refreshPlaylistItems(selectedId);
        setItemsDirty(false);
        setFeedback('Collection order saved');
      } catch (saveError) {
        console.error('[PlaylistsManager] save items failed', saveError);
        setError(saveError instanceof Error ? saveError.message : 'Failed to save collection order');
      }
    });
  }, [items, refreshPlaylistItems, selectedId]);

  const missingFamilyCount = familyHelpers.filter((helper) => helper.status === 'missing').length;
  const emptyFamilyCount = familyHelpers.filter((helper) => helper.status === 'empty').length;

  return (
    <div className={clsx('space-y-8', isItemsDirty && 'pb-28')}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Admin</p>
          <h1 className="text-3xl font-semibold text-text-primary">Collections curation</h1>
          <p className="max-w-3xl text-sm text-text-secondary">
            Keep the runtime surfaces stable while preparing family playlists. The main examples hub stays on <code>examples</code>,
            guest starter stays on <code>welcome</code>, and family pages can be seeded from the current live order before you
            start reordering them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowDraftCollections((current) => !current)}>
            {showDraftCollections ? 'Hide draft / empty' : `Show draft / empty (${groupedPlaylists.draft.length})`}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleCreateMissingFamilyPlaylists()}>
            {missingFamilyCount > 0 ? `Create missing family playlists (${missingFamilyCount})` : 'Sync family playlists'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleSeedAllFamilyPlaylists}>
            Seed all family playlists
          </Button>
          <Button type="button" size="sm" onClick={() => setShowCreateForm((current) => !current)}>
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
        <div className="rounded-card border border-success-border bg-success-bg px-4 py-3 text-sm text-success">{feedback}</div>
      ) : null}
      {error ? (
        <div className="rounded-card border border-error-border bg-error-bg px-4 py-3 text-sm text-error">{error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-6">
          {groupedPlaylists.runtime.length ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{GROUP_LABELS.runtime}</h2>
                <span className="text-xs text-text-muted">{groupedPlaylists.runtime.length}</span>
              </div>
              <div className="space-y-2">
                {groupedPlaylists.runtime.map((playlist) => (
                  <PlaylistRailCard
                    key={playlist.id}
                    playlist={playlist}
                    isActive={playlist.id === selectedId}
                    onSelect={handleSelectPlaylist}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowFamilyCollections((current) => !current)}
                className="flex min-w-0 items-center gap-2 text-left"
              >
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className={clsx('h-4 w-4 text-text-muted transition-transform', showFamilyCollections ? 'rotate-90' : 'rotate-0')}
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
                <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{GROUP_LABELS.family}</h2>
              </button>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                {emptyFamilyCount ? <span>{emptyFamilyCount} empty</span> : null}
                <span>{familyHelpers.length}</span>
              </div>
            </div>
            {showFamilyCollections ? (
              <div className="space-y-2">
                {familyHelpers.map((helper) => {
                  const playlist = helper.playlistId
                    ? groupedPlaylists.family.find((entry) => entry.id === helper.playlistId) ?? null
                    : null;
                  if (playlist) {
                    return (
                      <PlaylistRailCard
                        key={playlist.id}
                        playlist={playlist}
                        isActive={playlist.id === selectedId}
                        onSelect={handleSelectPlaylist}
                      />
                    );
                  }
                  return (
                    <MissingFamilyCard
                      key={helper.familyId}
                      helper={helper}
                      onCreate={handleCreateMissingFamilyPlaylists}
                      onSeed={handleSeedFamilyPlaylist}
                      pending={isPending}
                    />
                  );
                })}
              </div>
            ) : null}
          </section>

          {groupedPlaylists.model.length ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowModelCollections((current) => !current)}
                  className="flex min-w-0 items-center gap-2 text-left"
                >
                  <svg
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    className={clsx('h-4 w-4 text-text-muted transition-transform', showModelCollections ? 'rotate-90' : 'rotate-0')}
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
                  <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{GROUP_LABELS.model}</h2>
                </button>
                <span className="text-xs text-text-muted">{groupedPlaylists.model.length}</span>
              </div>
              {showModelCollections ? (
                <div className="space-y-2">
                  {groupedPlaylists.model.map((playlist) => (
                    <PlaylistRailCard
                      key={playlist.id}
                      playlist={playlist}
                      isActive={playlist.id === selectedId}
                      onSelect={handleSelectPlaylist}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {showDraftCollections && groupedPlaylists.draft.length ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{GROUP_LABELS.draft}</h2>
                <span className="text-xs text-text-muted">{groupedPlaylists.draft.length}</span>
              </div>
              <div className="space-y-2">
                {groupedPlaylists.draft.map((playlist) => (
                  <PlaylistRailCard
                    key={playlist.id}
                    playlist={playlist}
                    isActive={playlist.id === selectedId}
                    onSelect={handleSelectPlaylist}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </aside>

        <section className="space-y-6">
          {selectedPlaylist ? (
            <>
              <section className="rounded-card border border-border bg-surface p-6 shadow-card">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-text-primary">{selectedPlaylist.name}</h2>
                      <StatusPill tone={getSurfaceRoleTone(selectedPlaylist.surfaceRole)}>
                        {getSurfaceRoleLabel(selectedPlaylist.surfaceRole)}
                      </StatusPill>
                      <StatusPill tone={getSurfaceStatusTone(selectedPlaylist.surfaceStatus)}>
                        {getSurfaceStatusLabel(selectedPlaylist.surfaceStatus)}
                      </StatusPill>
                      {selectedPlaylist.isLocked ? <StatusPill tone="neutral">Locked by runtime</StatusPill> : null}
                    </div>
                    <p className="text-sm text-text-secondary">
                      {selectedPlaylist.surfaceRole === 'family'
                        ? 'The first positions are fully editorial here. When this playlist runs out, the page auto-fills from model playlists and then the main examples hub.'
                        : selectedPlaylist.isLocked
                          ? 'This collection powers a live runtime surface. You can curate clips and order, but metadata is read-only here.'
                          : 'Editable collection metadata. Clips and ordering are managed separately below.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlaylist.surfaceRole === 'family' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleSeedFamilyPlaylist(selectedPlaylist.familyId ?? selectedPlaylist.slug.replace(/^family-/, ''))}
                        disabled={isPending}
                      >
                        Seed from current order
                      </Button>
                    ) : null}
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

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-card border border-hairline bg-bg px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Helper</p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {selectedPlaylist.helperText ?? 'No helper text for this collection.'}
                    </p>
                    {selectedPlaylist.drivesRoute ? (
                      <div className="mt-3">
                        <StatusPill tone="neutral">{selectedPlaylist.drivesRoute}</StatusPill>
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-card border border-hairline bg-bg px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Fallback model playlists</p>
                    {selectedPlaylist.fallbackModelSlugs.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedPlaylist.fallbackModelSlugs.map((modelSlug) => (
                          <StatusPill key={modelSlug} tone="neutral">
                            {buildHelperFallbackLabel(modelSlug)}
                          </StatusPill>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-text-secondary">No automatic fallback configured.</p>
                    )}
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
                      Drag clips to change the visible order, then save the gallery. Family playlists define the editorial top of the page.
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
                            const nextPlacement: DropPlacement = event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before';
                            setDropTargetId(item.videoId);
                            setDropAtEnd(false);
                            setDropPlacement(nextPlacement);
                          }}
                          onDrop={(event) => handleDropOnCard(event, item.videoId)}
                          className={clsx(
                            'cursor-grab overflow-hidden rounded-card border border-hairline bg-bg shadow-card transition active:cursor-grabbing',
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
                            <p className="truncate text-sm font-semibold text-text-primary">{item.engineLabel ?? 'Unknown model'}</p>
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
                    This collection is empty. Use the family seed helpers or add clips from moderation, then reorder them here.
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
