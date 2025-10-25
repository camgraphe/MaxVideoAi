"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import clsx from 'clsx';
type PlaylistSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
};

type PlaylistItemRecord = {
  playlistId: string;
  videoId: string;
  orderIndex: number;
  pinned: boolean;
  createdAt: string;
};

type PlaylistsManagerProps = {
  initialPlaylists: PlaylistSummary[];
  initialPlaylistId: string | null;
  initialItems: PlaylistItemRecord[];
};

type EditablePlaylist = PlaylistSummary & { dirty?: boolean; loading?: boolean };

const PLACEHOLDER_MAP: Record<string, string> = {
  '9:16': '/assets/frames/thumb-9x16.svg',
  '16:9': '/assets/frames/thumb-16x9.svg',
  '1:1': '/assets/frames/thumb-1x1.svg',
};

function getPlaceholderThumb(aspectRatio?: string | null): string {
  const key = (aspectRatio ?? '').trim();
  return PLACEHOLDER_MAP[key] ?? '/assets/frames/thumb-16x9.svg';
}

export function PlaylistsManager({ initialPlaylists, initialPlaylistId, initialItems }: PlaylistsManagerProps) {
  const [playlists, setPlaylists] = useState<EditablePlaylist[]>(initialPlaylists);
  const [selectedId, setSelectedId] = useState<string | null>(initialPlaylistId);
  const [items, setItems] = useState<PlaylistItemRecord[]>(initialItems);
  const [isItemsDirty, setItemsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPlaylist = useMemo(() => playlists.find((p) => p.id === selectedId) ?? null, [playlists, selectedId]);

  useEffect(() => {
    setPlaylists(initialPlaylists);
    setSelectedId(initialPlaylistId);
    setItems(initialItems);
    setItemsDirty(false);
  }, [initialPlaylists, initialPlaylistId, initialItems]);

  const refreshPlaylistItems = useCallback((playlistId: string) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/playlists/${playlistId}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Failed to load items (${res.status})`);
        const json = await res.json().catch(() => ({ ok: false }));
        if (!json?.ok) throw new Error(json?.error ?? 'Unable to load playlist items');
        const list = json.items as PlaylistItemRecord[];
        setItems(list);
        setPlaylists((current) =>
          current.map((playlist) =>
            playlist.id === playlistId
              ? { ...playlist, itemCount: list.length }
              : playlist
          )
        );
        setItemsDirty(false);
      } catch (err) {
        console.error('[PlaylistsManager] load items failed', err);
        setError(err instanceof Error ? err.message : 'Failed to load playlist items');
      }
    });
  }, []);

  const handleSelectPlaylist = useCallback(
    (playlistId: string) => {
      setSelectedId(playlistId);
      refreshPlaylistItems(playlistId);
    },
    [refreshPlaylistItems]
  );

  const handleFieldChange = useCallback(
    (playlistId: string, field: 'name' | 'slug' | 'description' | 'isPublic', value: string | boolean) => {
      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id === playlistId
            ? {
                ...playlist,
                [field === 'isPublic' ? 'isPublic' : field]: value,
                dirty: true,
              }
            : playlist
        )
      );
    },
    []
  );

  const handleSavePlaylist = useCallback(
    (playlistId: string) => {
      const playlist = playlists.find((p) => p.id === playlistId);
      if (!playlist) return;
      startTransition(async () => {
        try {
          setFeedback(null);
          setError(null);
          setPlaylists((current) =>
            current.map((p) => (p.id === playlistId ? { ...p, loading: true } : p))
          );
          const res = await fetch(`/api/admin/playlists/${playlistId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: playlist.name,
              slug: playlist.slug,
              description: playlist.description,
              isPublic: playlist.isPublic,
            }),
            credentials: 'include',
          });
          if (!res.ok) throw new Error(`Failed to save playlist (${res.status})`);
          const json = await res.json().catch(() => ({ ok: false }));
          if (!json?.ok) throw new Error(json?.error ?? 'Save failed');
          setFeedback('Playlist saved');
          setPlaylists((current) =>
            current.map((p) =>
              p.id === playlistId
                ? { ...p, dirty: false, loading: false, updatedAt: new Date().toISOString() }
                : p
            )
          );
        } catch (err) {
          console.error('[PlaylistsManager] save playlist failed', err);
          setError(err instanceof Error ? err.message : 'Failed to save playlist');
          setPlaylists((current) =>
            current.map((p) => (p.id === playlistId ? { ...p, loading: false } : p))
          );
        }
      });
    },
    [playlists]
  );

  const handleCreatePlaylist = useCallback(() => {
    const slug = prompt('Slug (e.g. starter)');
    if (!slug) return;
    const name = prompt('Display name', slug) ?? slug;
    startTransition(async () => {
      try {
        setFeedback(null);
        setError(null);
        const res = await fetch('/api/admin/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, name }),
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to create playlist (${res.status})`);
        const json = await res.json().catch(() => ({ ok: false }));
        if (!json?.ok || !json.playlist) throw new Error(json?.error ?? 'Create failed');
        const playlist = json.playlist as PlaylistSummary;
        setPlaylists((current) => [{ ...playlist, dirty: false }, ...current]);
        setSelectedId(playlist.id);
        setItems([]);
        setItemsDirty(false);
        setFeedback('Playlist created');
      } catch (err) {
        console.error('[PlaylistsManager] create playlist failed', err);
        setError(err instanceof Error ? err.message : 'Failed to create playlist');
      }
    });
  }, []);

  const handleDeletePlaylist = useCallback(
    (playlistId: string) => {
      if (!confirm('Delete this playlist?')) return;
      startTransition(async () => {
        try {
          setFeedback(null);
          setError(null);
        const res = await fetch(`/api/admin/playlists/${playlistId}`, { method: 'DELETE', credentials: 'include' });
          if (!res.ok) throw new Error(`Failed to delete playlist (${res.status})`);
          const json = await res.json().catch(() => ({ ok: false }));
          if (!json?.ok) throw new Error(json?.error ?? 'Delete failed');
          let nextId: string | null = null;
          setPlaylists((current) => {
            const filtered = current.filter((p) => p.id !== playlistId);
            nextId = filtered[0]?.id ?? null;
            return filtered;
          });
          if (selectedId === playlistId) {
            setSelectedId(nextId);
            if (nextId) {
              refreshPlaylistItems(nextId);
            } else {
              setItems([]);
            }
          }
          setFeedback('Playlist deleted');
        } catch (err) {
          console.error('[PlaylistsManager] delete playlist failed', err);
          setError(err instanceof Error ? err.message : 'Failed to delete playlist');
        }
      });
    },
    [refreshPlaylistItems, selectedId]
  );

  const handleAddVideo = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedId) return;
      const formData = new FormData(event.currentTarget);
      const videoId = (formData.get('videoId') as string | null)?.trim();
      if (!videoId) return;
      event.currentTarget.reset();
      startTransition(async () => {
        try {
          setError(null);
          const res = await fetch(`/api/admin/playlists/${selectedId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId }),
            credentials: 'include',
          });
          if (!res.ok) throw new Error(`Failed to add video (${res.status})`);
          const json = await res.json().catch(() => ({ ok: false }));
          if (!json?.ok) throw new Error(json?.error ?? 'Add failed');
          refreshPlaylistItems(selectedId);
          setFeedback('Video added to playlist');
        } catch (err) {
          console.error('[PlaylistsManager] add video failed', err);
          setError(err instanceof Error ? err.message : 'Failed to add video');
        }
      });
    },
    [refreshPlaylistItems, selectedId]
  );

  const handleRemoveVideo = useCallback(
    (videoId: string) => {
      if (!selectedId) return;
      startTransition(async () => {
        try {
          setError(null);
          const res = await fetch(`/api/admin/playlists/${selectedId}/items`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId }),
            credentials: 'include',
          });
          if (!res.ok) throw new Error(`Failed to remove video (${res.status})`);
          const json = await res.json().catch(() => ({ ok: false }));
          if (!json?.ok) throw new Error(json?.error ?? 'Remove failed');
          refreshPlaylistItems(selectedId);
          setFeedback('Video removed from playlist');
        } catch (err) {
          console.error('[PlaylistsManager] remove video failed', err);
          setError(err instanceof Error ? err.message : 'Failed to remove video');
        }
      });
    },
    [refreshPlaylistItems, selectedId]
  );

  const moveItem = useCallback(
    (videoId: string, direction: -1 | 1) => {
      setItems((current) => {
        const index = current.findIndex((item) => item.videoId === videoId);
        if (index === -1) return current;
        const target = index + direction;
        if (target < 0 || target >= current.length) return current;
        const next = [...current];
        const [removed] = next.splice(index, 1);
        next.splice(target, 0, removed);
        return next.map((item, idx) => ({ ...item, orderIndex: idx }));
      });
      setItemsDirty(true);
    },
    []
  );

  const handleSaveItems = useCallback(() => {
    if (!selectedId) return;
    startTransition(async () => {
      try {
        setError(null);
        const payload = items.map((item) => ({ videoId: item.videoId, pinned: item.pinned }));
        const res = await fetch(`/api/admin/playlists/${selectedId}/items`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to save order (${res.status})`);
        const json = await res.json().catch(() => ({ ok: false }));
        if (!json?.ok) throw new Error(json?.error ?? 'Save failed');
        setItemsDirty(false);
        setFeedback('Playlist order saved');
      } catch (err) {
        console.error('[PlaylistsManager] save items failed', err);
        setError(err instanceof Error ? err.message : 'Failed to save playlist items');
      }
    });
  }, [items, selectedId]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Playlist curation</h1>
          <p className="text-sm text-text-secondary">
            Control the Starter tab and other public collections surfaced in the gallery.
          </p>
        </div>
        <button
          type="button"
          className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={handleCreatePlaylist}
          disabled={isPending}
        >
          + New playlist
        </button>
      </header>

      {feedback ? (
        <div className="rounded-card border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">Playlists</h2>
          <div className="space-y-2">
            {playlists.map((playlist) => {
              const isActive = playlist.id === selectedId;
              return (
                <button
                  key={playlist.id}
                  type="button"
                  className={clsx(
                    'w-full rounded-card border px-4 py-3 text-left transition',
                    isActive ? 'border-accent bg-accent/10 text-text-primary' : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50'
                  )}
                  onClick={() => handleSelectPlaylist(playlist.id)}
                  disabled={isPending}
                >
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                    <span>{playlist.name}</span>
                    {playlist.dirty ? <span className="text-xs text-amber-600">Unsaved</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {playlist.slug} · {playlist.itemCount} item{playlist.itemCount === 1 ? '' : 's'}
                  </p>
                </button>
              );
            })}
            {playlists.length === 0 ? (
              <div className="rounded-card border border-dashed border-hairline bg-white p-6 text-center text-sm text-text-secondary">
                No playlists yet. Create one to get started.
              </div>
            ) : null}
          </div>
        </aside>

        <section className="space-y-6">
          {selectedPlaylist ? (
            <div className="rounded-card border border-border bg-white p-6 shadow-card space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Playlist details</h2>
                  <p className="text-sm text-text-secondary">Update name, slug, or visibility defaults.</p>
                </div>
                <button
                  type="button"
                  className="rounded-input border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  onClick={() => handleDeletePlaylist(selectedPlaylist.id)}
                  disabled={isPending}
                >
                  Delete
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Name</span>
                  <input
                    type="text"
                    value={selectedPlaylist.name}
                    onChange={(event) => handleFieldChange(selectedPlaylist.id, 'name', event.target.value)}
                    className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Slug</span>
                  <input
                    type="text"
                    value={selectedPlaylist.slug}
                    onChange={(event) => handleFieldChange(selectedPlaylist.id, 'slug', event.target.value)}
                    className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Description (optional)</span>
                <textarea
                  value={selectedPlaylist.description ?? ''}
                  onChange={(event) => handleFieldChange(selectedPlaylist.id, 'description', event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={selectedPlaylist.isPublic}
                  onChange={(event) => handleFieldChange(selectedPlaylist.id, 'isPublic', event.target.checked)}
                />
                Public playlist (visible on gallery tabs)
              </label>
              <button
                type="button"
                className="rounded-pill bg-text-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => handleSavePlaylist(selectedPlaylist.id)}
                disabled={!selectedPlaylist.dirty || isPending}
              >
                Save details
              </button>
            </div>
          ) : (
            <div className="rounded-card border border-dashed border-hairline bg-white p-8 text-center text-sm text-text-secondary">
              Select a playlist to edit.
            </div>
          )}

          {selectedPlaylist ? (
            <div className="rounded-card border border-border bg-white p-6 shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Playlist items</h2>
                  <p className="text-sm text-text-secondary">Add videos by job ID and arrange their order as displayed in the gallery.</p>
                </div>
                <button
                  type="button"
                  className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={handleSaveItems}
                  disabled={!isItemsDirty || isPending}
                >
                  Save order
                </button>
              </div>

              <form className="flex flex-wrap items-center gap-2" onSubmit={handleAddVideo}>
                <input
                  type="text"
                  name="videoId"
                  placeholder="job_..."
                  className="flex-1 min-w-[200px] rounded-input border border-border px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={isPending}
                />
                <button
                  type="submit"
                  className="rounded-pill bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-micro text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={isPending}
                >
                  Add video
                </button>
              </form>

              <div className="overflow-hidden rounded-card border border-border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-bg text-xs uppercase tracking-micro text-text-muted">
                    <tr>
              <th className="px-4 py-3 text-left">Order</th>
              <th className="px-4 py-3 text-left">Video</th>
              <th className="px-4 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item, index) => (
              <tr key={item.videoId} className={clsx(isPending && 'opacity-90')}>
                <td className="px-4 py-3 text-xs text-text-secondary">{index + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-28 overflow-hidden rounded border border-border bg-neutral-100">
                      <img
                        src={item.thumbUrl || getPlaceholderThumb(item.aspectRatio)}
                        alt={`Thumbnail for ${item.videoId}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="truncate font-mono text-xs text-text-primary">{item.videoId}</div>
                      {item.engineLabel ? (
                        <div className="truncate text-xs text-text-muted">{item.engineLabel}</div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2 text-xs">
                            <button
                              type="button"
                              className="rounded-input border border-hairline px-2 py-1 text-text-secondary hover:border-accent hover:text-accent"
                              onClick={() => moveItem(item.videoId, -1)}
                              disabled={index === 0 || isPending}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="rounded-input border border-hairline px-2 py-1 text-text-secondary hover:border-accent hover:text-accent"
                              onClick={() => moveItem(item.videoId, 1)}
                              disabled={index === items.length - 1 || isPending}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="rounded-input border border-hairline px-2 py-1 text-rose-600 hover:border-rose-400 hover:text-rose-700"
                              onClick={() => handleRemoveVideo(item.videoId)}
                              disabled={isPending}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-sm text-text-secondary">
                          Playlist is empty. Add video IDs to populate it.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
