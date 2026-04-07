import { FolderKanban, Layers3, LockKeyhole, Sparkles } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PlaylistsManager } from '@/components/admin/PlaylistsManager';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { ButtonLink } from '@/components/ui/Button';
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
  const initialId = playlists.find((playlist) => playlist.kind !== 'draft')?.id ?? playlists[0]?.id ?? null;
  const initialItems = initialId ? await getPlaylistItems(initialId) : [];
  const metrics = buildPlaylistMetrics(playlists, initialItems.length);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Curation"
        title="Collections curation"
        description="Pilotage des collections runtime, familles et modèles. Cette surface sert à maintenir les surfaces éditoriales stables tout en préparant les familles et variantes."
        actions={
          <>
            <ButtonLink href="/admin/moderation" variant="outline" size="sm" className="border-border bg-surface">
              Moderation
            </ButtonLink>
            <ButtonLink href="/admin/home" variant="outline" size="sm" className="border-border bg-surface">
              Homepage
            </ButtonLink>
            <ButtonLink href="/examples" variant="outline" size="sm" className="border-border bg-surface" prefetch={false}>
              Examples hub
            </ButtonLink>
          </>
        }
      />

      <AdminSection
        title="Collections Pulse"
        description="Vue courte de la topologie des playlists avant d’ouvrir le rail détaillé et les opérations de réordonnancement."
      >
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-4" density="compact" />
      </AdminSection>

      <PlaylistsManager initialPlaylists={playlists} initialPlaylistId={initialId} initialItems={initialItems} embedded />
    </div>
  );
}

function buildPlaylistMetrics(
  playlists: Awaited<ReturnType<typeof listPlaylists>>,
  selectedItemCount: number
): AdminMetricItem[] {
  const runtimeCount = playlists.filter((playlist) => playlist.surfaceRole === 'starter' || playlist.surfaceRole === 'examplesHub').length;
  const familyReadyCount = playlists.filter((playlist) => playlist.surfaceRole === 'family' && playlist.surfaceStatus === 'ready').length;
  const lockedCount = playlists.filter((playlist) => playlist.isLocked).length;

  return [
    {
      label: 'Collections',
      value: String(playlists.length),
      helper: 'All runtime, family, model and draft collections',
      icon: FolderKanban,
    },
    {
      label: 'Runtime surfaces',
      value: String(runtimeCount),
      helper: 'Starter and examples surfaces tied to production routes',
      tone: runtimeCount ? 'success' : 'default',
      icon: Sparkles,
    },
    {
      label: 'Family ready',
      value: String(familyReadyCount),
      helper: 'Family playlists already populated and routable',
      tone: familyReadyCount ? 'info' : 'default',
      icon: Layers3,
    },
    {
      label: 'Locked',
      value: String(lockedCount),
      helper: `${selectedItemCount} items loaded in the current collection`,
      tone: lockedCount ? 'warning' : 'default',
      icon: LockKeyhole,
    },
  ];
}
