"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from 'react';
import clsx from 'clsx';
import { authFetch } from '@/lib/authFetch';
import { PlaylistFeedbackBanners } from '@/components/admin/playlists/PlaylistFeedbackBanners';
import { PlaylistOrderDirtyBar } from '@/components/admin/playlists/PlaylistItemsSection';
import { PlaylistsManagerToolbar } from '@/components/admin/playlists/PlaylistsManagerToolbar';
import { PlaylistsManagerSelectionPanel } from '@/components/admin/playlists/PlaylistsManagerSelectionPanel';
import { PlaylistsSidebar } from '@/components/admin/playlists/PlaylistsSidebar';
import { usePlaylistDragReorder } from '@/components/admin/playlists/usePlaylistDragReorder';
import {
  buildFamilyHelpers,
  buildPlaylistUpdateFromItems,
  getPlaylistGroup,
  sortItemsForDisplay,
  sortPlaylists,
} from '@/components/admin/playlists/playlist-helpers';
import type { EditablePlaylist, PlaylistItemRecord, PlaylistsManagerProps, PlaylistSummary } from '@/components/admin/playlists/playlist-types';

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
    setItems(sortItemsForDisplay(initialItems));
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
      <PlaylistsManagerToolbar
        createDescription={createDescription} createName={createName} createSlug={createSlug}
        draftCount={groupedPlaylists.draft.length} embedded={embedded} isPending={isPending}
        missingFamilyCount={missingFamilyCount} onCreateDescriptionChange={setCreateDescription}
        onCreateMissingFamilyPlaylists={() => handleCreateMissingFamilyPlaylists()}
        onCreateNameChange={setCreateName} onCreateSlugChange={setCreateSlug} onCreateSubmit={handleCreatePlaylist}
        onSeedAllFamilyPlaylists={handleSeedAllFamilyPlaylists} showCreateForm={showCreateForm}
        onToggleCreateForm={() => setShowCreateForm((current) => !current)}
        onToggleDraftCollections={() => setShowDraftCollections((current) => !current)}
        showDraftCollections={showDraftCollections}
      />

      <PlaylistFeedbackBanners error={error} feedback={feedback} />

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <PlaylistsSidebar
          emptyFamilyCount={emptyFamilyCount} familyHelpers={familyHelpers} groupedPlaylists={groupedPlaylists}
          onCreateMissingFamilyPlaylists={handleCreateMissingFamilyPlaylists}
          onSeedFamilyPlaylist={handleSeedFamilyPlaylist} onSelectPlaylist={handleSelectPlaylist}
          onToggleFamilyCollections={() => setShowFamilyCollections((current) => !current)}
          onToggleModelCollections={() => setShowModelCollections((current) => !current)}
          pending={isPending} selectedId={selectedId} showDraftCollections={showDraftCollections}
          showFamilyCollections={showFamilyCollections} showModelCollections={showModelCollections}
        />

        <section className="space-y-6">
          <PlaylistsManagerSelectionPanel
            draggingId={draggingId} dropAtEnd={dropAtEnd} dropPlacement={dropPlacement} dropTargetId={dropTargetId}
            isItemsDirty={isItemsDirty} isPending={isPending} items={items}
            onCardDragOver={handleCardDragOver} onDeletePlaylist={handleDeletePlaylist} onDragEnd={handleDragEnd}
            onDragOver={handleDragOver} onDragStart={handleDragStart} onDropAtEnd={handleDropAtEnd}
            onDropOnCard={handleDropOnCard} onDropOnPlaceholder={handleDropOnPlaceholder}
            onFieldChange={handleFieldChange} onRemoveVideo={handleRemoveVideo} onSaveItems={handleSaveItems}
            onSavePlaylist={handleSavePlaylist} onSeedFamilyPlaylist={handleSeedFamilyPlaylist}
            playlist={selectedPlaylist}
          />
        </section>
      </div>

      {selectedPlaylist && isItemsDirty ? (
        <PlaylistOrderDirtyBar isPending={isPending} playlistName={selectedPlaylist.name} onSaveItems={handleSaveItems} />
      ) : null}
    </div>
  );
}
