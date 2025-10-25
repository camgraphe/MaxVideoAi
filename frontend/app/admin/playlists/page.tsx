import { notFound } from 'next/navigation';
import { PlaylistsManager } from '@/components/admin/PlaylistsManager';
import { requireAdmin } from '@/server/admin';
import { getPlaylistItems, listPlaylists } from '@/server/playlists';

export const dynamic = 'force-dynamic';

export default async function AdminPlaylistsPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/playlists] access denied', error);
    notFound();
  }

  const playlists = await listPlaylists();
  const initialId = playlists[0]?.id ?? null;
  const initialItems = initialId ? await getPlaylistItems(initialId) : [];

  const clientPlaylists = playlists.map((playlist) => ({
    id: playlist.id,
    slug: playlist.slug,
    name: playlist.name,
    description: playlist.description,
    isPublic: playlist.isPublic,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
    itemCount: playlist.itemCount,
  }));

  const clientItems = initialItems.map((item) => ({
    playlistId: item.playlistId,
    videoId: item.videoId,
    orderIndex: item.orderIndex,
    pinned: item.pinned,
    createdAt: item.createdAt,
    thumbUrl: item.thumbUrl ?? null,
    videoUrl: item.videoUrl ?? null,
    engineLabel: item.engineLabel ?? null,
    aspectRatio: item.aspectRatio ?? null,
  }));

  return (
    <PlaylistsManager
      initialPlaylists={clientPlaylists}
      initialPlaylistId={initialId}
      initialItems={clientItems}
    />
  );
}
