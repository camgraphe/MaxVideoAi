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
} from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';
import { PlaylistCreateForm } from '@/components/admin/playlists/PlaylistCreateForm';
import { PlaylistDetailsPanel } from '@/components/admin/playlists/PlaylistDetailsPanel';
import { PlaylistFeedbackBanners } from '@/components/admin/playlists/PlaylistFeedbackBanners';
import { PlaylistsSidebar } from '@/components/admin/playlists/PlaylistsSidebar';
import { StatusPill } from '@/components/admin/playlists/PlaylistStatusPill';
import {
  buildFamilyHelpers,
  buildPlaylistUpdateFromItems,
  getPlaceholderThumb,
  getPlaylistGroup,
  slugify,
  sortItemsForDisplay,
  sortPlaylists,
} from '@/components/admin/playlists/playlist-helpers';
import type { DropPlacement, EditablePlaylist, PlaylistItemRecord, PlaylistsManagerProps, PlaylistSummary } from '@/components/admin/playlists/playlist-types';

export function PlaylistsManager({
  initialPlaylists,
  initialPlaylistId,
  initialItems,
  embedded = false,
  className,
}: PlaylistsManagerProps) {
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
    <div className={clsx('space-y-8', isItemsDirty && 'pb-28', className)}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        {!embedded ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Admin</p>
            <h1 className="text-3xl font-semibold text-text-primary">Collections curation</h1>
            <p className="max-w-3xl text-sm text-text-secondary">
              Keep the runtime surfaces stable while preparing family playlists. The main examples hub stays on <code>examples</code>,
              guest starter stays on <code>welcome</code>, and family pages can be seeded from the current live order before you
              start reordering them.
            </p>
          </div>
        ) : null}
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
        <PlaylistCreateForm
          createDescription={createDescription}
          createName={createName}
          createSlug={createSlug}
          isPending={isPending}
          onCancel={() => setShowCreateForm(false)}
          onDescriptionChange={setCreateDescription}
          onNameChange={(nextName) => {
            setCreateName(nextName);
            if (!createSlug.trim()) {
              setCreateSlug(slugify(nextName));
            }
          }}
          onSlugChange={(value) => setCreateSlug(slugify(value))}
          onSubmit={handleCreatePlaylist}
        />
      ) : null}

      <PlaylistFeedbackBanners error={error} feedback={feedback} />

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <PlaylistsSidebar
          emptyFamilyCount={emptyFamilyCount}
          familyHelpers={familyHelpers}
          groupedPlaylists={groupedPlaylists}
          onCreateMissingFamilyPlaylists={handleCreateMissingFamilyPlaylists}
          onSeedFamilyPlaylist={handleSeedFamilyPlaylist}
          onSelectPlaylist={handleSelectPlaylist}
          onToggleFamilyCollections={() => setShowFamilyCollections((current) => !current)}
          onToggleModelCollections={() => setShowModelCollections((current) => !current)}
          pending={isPending}
          selectedId={selectedId}
          showDraftCollections={showDraftCollections}
          showFamilyCollections={showFamilyCollections}
          showModelCollections={showModelCollections}
        />

        <section className="space-y-6">
          {selectedPlaylist ? (
            <>
              <PlaylistDetailsPanel
                isPending={isPending}
                onDeletePlaylist={handleDeletePlaylist}
                onFieldChange={handleFieldChange}
                onSavePlaylist={handleSavePlaylist}
                onSeedFamilyPlaylist={handleSeedFamilyPlaylist}
                playlist={selectedPlaylist}
              />

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
