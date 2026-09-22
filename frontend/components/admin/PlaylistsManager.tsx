'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { usePlaylistAction } from '@/components/admin/playlists/usePlaylistAction';
import { movePlaylistItem } from '@/lib/admin/playlist-order';
import { authFetch } from '@/lib/authFetch';
import { PlaylistFeedbackBanners } from '@/components/admin/playlists/PlaylistFeedbackBanners';
import { PlaylistOrderDirtyBar } from '@/components/admin/playlists/PlaylistItemsSection';
import { PlaylistsManagerToolbar } from '@/components/admin/playlists/PlaylistsManagerToolbar';
import { PlaylistsManagerSelectionPanel } from '@/components/admin/playlists/PlaylistsManagerSelectionPanel';
import { PlaylistsSidebar } from '@/components/admin/playlists/PlaylistsSidebar';
import { usePlaylistHelperActions } from '@/components/admin/playlists/usePlaylistHelperActions';
import { usePlaylistDragReorder } from '@/components/admin/playlists/usePlaylistDragReorder';
import {
  buildFamilyHelpers,
  buildModelHelpers,
  buildPlaylistUpdateFromItems,
  getPlaylistGroup,
  sortItemsForDisplay,
  sortPlaylists,
} from '@/components/admin/playlists/playlist-helpers';
import type {
  EditablePlaylist,
  PlaylistItemRecord,
  PlaylistsManagerProps,
  PlaylistSummary,
} from '@/components/admin/playlists/playlist-types';

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
  const savedItems = useRef(sortItemsForDisplay(initialItems));
  const [isItemsDirty, setItemsDirty] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isPending, busy, runAction } = usePlaylistAction(setError);
  const [showDraftCollections, setShowDraftCollections] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const {
    clearDragState,
    draggingId,
    dropAtEnd,
    dropPlacement,
    dropTargetId,
    handleCardDragOver,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    handleDropAtEnd,
    handleDropOnCard,
    handleDropOnPlaceholder,
  } = usePlaylistDragReorder({ setItems, setItemsDirty });

  useEffect(() => {
    setPlaylists(sortPlaylists(initialPlaylists));
    setSelectedId(initialPlaylistId);
    savedItems.current = sortItemsForDisplay(initialItems);
    setItems(savedItems.current);
    setItemsDirty(false);
    clearDragState();
  }, [clearDragState, initialItems, initialPlaylistId, initialPlaylists]);

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
  const modelHelpers = useMemo(() => buildModelHelpers(playlists), [playlists]);

  const syncPlaylistDetail = useCallback(
    (
      playlistId: string,
      nextPlaylist: PlaylistSummary | undefined,
      nextItems: PlaylistItemRecord[],
      basePlaylists?: EditablePlaylist[]
    ) => {
      setSelectedId(playlistId);
      savedItems.current = sortItemsForDisplay(nextItems);
      setItems(savedItems.current);
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
          mapped.push({
            ...buildPlaylistUpdateFromItems({ ...nextPlaylist }, nextItems),
            dirty: false,
            loading: false,
          });
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

      syncPlaylistDetail(
        playlistId,
        json.playlist as PlaylistSummary | undefined,
        json.items as PlaylistItemRecord[],
        basePlaylists
      );
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
          : (nextPlaylists.find((playlist) => getPlaylistGroup(playlist) !== 'draft')?.id ??
            nextPlaylists[0]?.id ??
            null);

      if (preferredId) {
        await refreshPlaylistItems(preferredId, nextPlaylists);
      } else {
        setPlaylists(nextPlaylists);
        setSelectedId(null);
        savedItems.current = [];
        setItems([]);
        setItemsDirty(false);
        clearDragState();
      }
      return { nextPlaylists, selectedId: preferredId };
    },
    [clearDragState, refreshPlaylistItems]
  );

  const {
    handleCreateMissingFamilyPlaylists,
    handleCreateMissingModelPlaylists,
    handleSeedAllFamilyPlaylists,
    handleSeedAllModelPlaylists,
    handleSeedFamilyPlaylist,
  } = usePlaylistHelperActions({
    refreshPlaylistsState,
    selectedId,
    setError,
    setFeedback,
    runAction,
  });

  const handleSelectPlaylist = useCallback(
    (playlistId: string) => {
      if (busy.current) return;
      if (isItemsDirty && !window.confirm('Discard the unsaved order and change destination?')) return;
      setFeedback(null);
      setError(null);
      runAction(async () => {
        try {
          await refreshPlaylistItems(playlistId);
        } catch (loadError) {
          console.error('[PlaylistsManager] load items failed', loadError);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load collection items');
        }
      });
    },
    [busy, isItemsDirty, refreshPlaylistItems, runAction]
  );

  const handleFieldChange = useCallback((playlistId: string, field: 'name' | 'slug' | 'description', value: string) => {
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
  }, []);

  const handleSavePlaylist = useCallback(
    (playlistId: string) => {
      const playlist = playlists.find((entry) => entry.id === playlistId);
      if (!playlist || playlist.isLocked) return;

      runAction(async () => {
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
    [playlists, refreshPlaylistsState, runAction]
  );

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
    [createDescription, createName, createSlug, refreshPlaylistsState, runAction]
  );

  const handleDeletePlaylist = useCallback(
    (playlistId: string) => {
      const playlist = playlists.find((entry) => entry.id === playlistId);
      if (!playlist || playlist.isLocked) return;
      if (!window.confirm(`Delete collection "${playlist.name}"?`)) return;

      runAction(async () => {
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
            playlists.filter((entry) => entry.id !== playlistId).find((entry) => getPlaylistGroup(entry) !== 'draft')
              ?.id ??
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
    [playlists, refreshPlaylistsState, runAction]
  );

  const handleRemoveVideo = useCallback(
    (videoId: string) => {
      if (!selectedId) return;
      if (isItemsDirty) {
        setError('Save or cancel the order before removing media.');
        return;
      }
      if (
        !window.confirm(
          'Remove this media from this collection now? It may still appear through an automatic family feed.'
        )
      )
        return;
      runAction(async () => {
        try {
          setFeedback(null);
          setError(null);
          const res = await authFetch(
            `/api/admin/playlists/${selectedId}/items?videoId=${encodeURIComponent(videoId)}`,
            {
              method: 'DELETE',
            }
          );
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
    [isItemsDirty, refreshPlaylistItems, runAction, selectedId]
  );

  const handleSaveItems = useCallback(() => {
    if (!selectedId) return;
    runAction(async () => {
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
        savedItems.current = items;
        setItemsDirty(false);
        setFeedback('Collection order saved');
        await refreshPlaylistItems(selectedId);
      } catch (saveError) {
        console.error('[PlaylistsManager] save items failed', saveError);
        setError(saveError instanceof Error ? saveError.message : 'Failed to save collection order');
      }
    });
  }, [items, refreshPlaylistItems, runAction, selectedId]);

  const missingFamilyCount = familyHelpers.filter((helper) => helper.status === 'missing').length;
  const missingModelCount = modelHelpers.filter((helper) => helper.status === 'missing').length;

  return (
    <div className={clsx('space-y-4', isItemsDirty && 'pb-28', className)}>
      <PlaylistsManagerToolbar
        createDescription={createDescription}
        createName={createName}
        createSlug={createSlug}
        draftCount={groupedPlaylists.draft.length}
        embedded={embedded}
        isPending={isPending || isItemsDirty}
        missingFamilyCount={missingFamilyCount}
        missingModelCount={missingModelCount}
        onCreateDescriptionChange={setCreateDescription}
        onCreateMissingFamilyPlaylists={() => handleCreateMissingFamilyPlaylists()}
        onCreateMissingModelPlaylists={() => handleCreateMissingModelPlaylists()}
        onCreateNameChange={setCreateName}
        onCreateSlugChange={setCreateSlug}
        onCreateSubmit={handleCreatePlaylist}
        onSeedAllFamilyPlaylists={handleSeedAllFamilyPlaylists}
        onSeedAllModelPlaylists={handleSeedAllModelPlaylists}
        showCreateForm={showCreateForm}
        onToggleCreateForm={() => setShowCreateForm((current) => !current)}
        onToggleDraftCollections={() => setShowDraftCollections((current) => !current)}
        showDraftCollections={showDraftCollections}
      />

      <PlaylistFeedbackBanners error={error} feedback={feedback} />

      <div className="grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
        <PlaylistsSidebar
          groupedPlaylists={groupedPlaylists}
          onSelectPlaylist={handleSelectPlaylist}
          pending={isPending}
          selectedId={selectedId}
          showDraftCollections={showDraftCollections}
        />

        <section className="space-y-6">
          <PlaylistsManagerSelectionPanel
            draggingId={draggingId}
            dropAtEnd={dropAtEnd}
            dropPlacement={dropPlacement}
            dropTargetId={dropTargetId}
            isItemsDirty={isItemsDirty}
            isPending={isPending}
            items={items}
            onCardDragOver={handleCardDragOver}
            onDeletePlaylist={handleDeletePlaylist}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragStart={handleDragStart}
            onDropAtEnd={handleDropAtEnd}
            onDropOnCard={handleDropOnCard}
            onDropOnPlaceholder={handleDropOnPlaceholder}
            onFieldChange={handleFieldChange}
            onRemoveVideo={handleRemoveVideo}
            onSaveItems={handleSaveItems}
            onSavePlaylist={handleSavePlaylist}
            onSeedFamilyPlaylist={handleSeedFamilyPlaylist}
            onMoveItem={(videoId, offset) => {
              setItems((current) => movePlaylistItem(current, videoId, offset));
              setItemsDirty(true);
            }}
            onCancelOrder={() => {
              setItems(savedItems.current);
              setItemsDirty(false);
              clearDragState();
            }}
            playlist={selectedPlaylist}
          />
        </section>
      </div>

      {selectedPlaylist && isItemsDirty ? (
        <PlaylistOrderDirtyBar
          isPending={isPending}
          playlistName={selectedPlaylist.name}
          onSaveItems={handleSaveItems}
        />
      ) : null}
    </div>
  );
}
