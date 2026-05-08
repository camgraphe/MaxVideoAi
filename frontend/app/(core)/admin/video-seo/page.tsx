import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { listSeoWatchVideoRows } from '@/server/video-seo';
import { VideoSeoInventoryTable } from './_components/VideoSeoInventoryTable';
import {
  buildOverviewItems,
  buildVideoSeoSummary,
  buildWatchRows,
} from './_lib/video-seo-admin-helpers';

export const dynamic = 'force-dynamic';

export default async function AdminVideoSeoPage() {
  const rows = buildWatchRows(await listSeoWatchVideoRows());
  const metrics = buildOverviewItems(rows);
  const { issueCount, readyCount, strongRows } = buildVideoSeoSummary(rows);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Curation"
        title="Video SEO watch pages"
        description="Vue opérationnelle du shortlist `/video/[id]` pour le rollout Google Video. On contrôle ici l’éligibilité, les assets publics et les watch pages, sans mélanger cette surface avec la publication générale."
        actions={
          <>
            <AdminActionLink href="/admin/moderation">
              Moderation
            </AdminActionLink>
            <AdminActionLink href="/sitemap-video.xml" prefetch={false}>
              Video sitemap
            </AdminActionLink>
            <AdminActionLink href="/examples" prefetch={false}>
              Examples hub
            </AdminActionLink>
          </>
        }
      />

      <AdminSection
        title="Rollout Pulse"
        description="Lecture rapide du shortlist actuellement sous surveillance avant d’inspecter chaque watch page."
      >
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-4" density="compact" />
      </AdminSection>

      <AdminSection
        title="Watch Page Inventory"
        description="Valide la watch page publique, les assets live et les signaux de qualité pour chaque vidéo du rollout."
        action={
          <AdminSectionMeta
            title={`${readyCount}/${rows.length} rollout pages ready`}
            lines={[
              issueCount ? `${issueCount} page${issueCount > 1 ? 's' : ''} still need attention` : 'No rollout blockers detected',
              `${strongRows} page${strongRows === 1 ? '' : 's'} with strong completeness + differentiation scores`,
            ]}
          />
        }
      >
        <div className="space-y-4">
          <AdminNotice tone={issueCount ? 'warning' : 'success'}>
            {issueCount
              ? 'Blocked watch pages are pinned first. The rollout contract stays simple: public, discovery-on, with video + thumbnail, and editorially differentiated.'
              : 'The shortlist currently satisfies the rollout contract: public, discovery-on, with assets and no detected blockers.'}
          </AdminNotice>

          {rows.length ? (
            <VideoSeoInventoryTable rows={rows} />
          ) : (
            <AdminEmptyState>No watch pages are currently configured for the rollout.</AdminEmptyState>
          )}
        </div>
      </AdminSection>
    </div>
  );
}
