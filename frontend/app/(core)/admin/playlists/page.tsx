import { curationSchemaAvailable } from '@/server/playlists/curation-store';
import { notFound } from 'next/navigation';
import { PlaylistsManager } from '@/components/admin/PlaylistsManager';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { requireAdmin } from '@/server/admin';
import { getPlaylistItems, listPlaylists } from '@/server/playlists';
import { loadPlaylistDestinations } from '@/server/playlists/destinations';

export const dynamic = 'force-dynamic';

export default async function AdminPlaylistsPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/playlists] access denied', error);
    notFound();
  }

  const playlists = await listPlaylists();
  const destinations = await loadPlaylistDestinations(playlists);
  const enableCuration = await curationSchemaAvailable();
  const initialId = destinations.find((destination) => destination.id === 'examples' && destination.status === 'connected')?.playlistId
    ?? destinations.find((destination) => destination.kind === 'family' && destination.status === 'connected')?.playlistId
    ?? destinations.find((destination) => destination.status === 'connected')?.playlistId
    ?? null;
  const initialItems = initialId ? await getPlaylistItems(initialId) : [];

  return (
    <div className="flex flex-col gap-3">
      <AdminPageHeader eyebrow="Curation" title="Galleries" />

      <PlaylistsManager
        initialPlaylists={playlists}
        initialDestinations={destinations}
        initialPlaylistId={initialId}
        initialItems={initialItems}
        enableCuration={enableCuration}
        embedded
      />
    </div>
  );
}
