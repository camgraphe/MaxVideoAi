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
  const initialId =
    playlists.find((playlist) => playlist.kind !== 'draft')?.id ??
    playlists[0]?.id ??
    null;
  const initialItems = initialId ? await getPlaylistItems(initialId) : [];

  return (
    <PlaylistsManager
      initialPlaylists={playlists}
      initialPlaylistId={initialId}
      initialItems={initialItems}
    />
  );
}
