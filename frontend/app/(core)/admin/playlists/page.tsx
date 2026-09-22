import { curationSchemaAvailable } from '@/server/playlists/curation-store';
import { notFound } from 'next/navigation';
import { PlaylistsManager } from '@/components/admin/PlaylistsManager';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
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
  const enableCuration = await curationSchemaAvailable();
  const initialId = playlists.find((playlist) => playlist.kind !== 'draft')?.id ?? playlists[0]?.id ?? null;
  const initialItems = initialId ? await getPlaylistItems(initialId) : [];

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Curation"
        title="Site placements"
        description="Choose a site destination, then arrange its curated media."
        actions={
          <>
            <AdminActionLink href="/admin/moderation">Moderation</AdminActionLink>
            <AdminActionLink href="/admin/home">Homepage</AdminActionLink>
            <AdminActionLink href="/examples" prefetch={false}>
              Examples hub
            </AdminActionLink>
          </>
        }
      />

      <PlaylistsManager
        initialPlaylists={playlists}
        initialPlaylistId={initialId}
        initialItems={initialItems}
        enableCuration={enableCuration}
        embedded
      />
    </div>
  );
}
