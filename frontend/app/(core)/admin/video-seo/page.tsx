import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { listSeoWatchVideoRows } from '@/server/video-seo';
import { VideoSeoCandidateForm } from './_components/VideoSeoCandidateForm.client';
import { VideoSeoInventoryTable } from './_components/VideoSeoInventoryTable';
import {
  buildOverviewItems,
  buildVideoSeoSummary,
  buildWatchRows,
  splitVideoSeoRows,
} from './_lib/video-seo-admin-helpers';

export const dynamic = 'force-dynamic';

export default async function AdminVideoSeoPage() {
  const rows = buildWatchRows(await listSeoWatchVideoRows());
  const metrics = buildOverviewItems(rows);
  const { candidateCount, issueCount, sitemapCount, strongRows } = buildVideoSeoSummary(rows);
  const { candidateRows, indexedRows } = splitVideoSeoRows(rows);

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
        title="Add Candidate"
        description="Ajoute une vidéo publique comme brouillon éditorial. Elle reste hors sitemap tant que le statut et la QA ne passent pas."
      >
        <VideoSeoCandidateForm />
      </AdminSection>

      <AdminSection
        title="Indexed Watch Pages"
        description="Pages calculées comme éligibles au sitemap vidéo : statut approved, fiche complète, QA OK et assets publics."
        action={
          <AdminSectionMeta
            title={`${sitemapCount} page${sitemapCount === 1 ? '' : 's'} in sitemap`}
            lines={[`${strongRows} page${strongRows === 1 ? '' : 's'} with strong completeness + differentiation scores`]}
          />
        }
      >
        {indexedRows.length ? (
          <VideoSeoInventoryTable rows={indexedRows} />
        ) : (
          <AdminEmptyState>No watch pages currently pass the video sitemap contract.</AdminEmptyState>
        )}
      </AdminSection>

      <AdminSection
        title="Candidates And Drafts"
        description="Pages candidates, brouillons, désactivées ou bloquées par la QA éditoriale/technique avant indexation."
        action={
          <AdminSectionMeta
            title={`${candidateCount} page${candidateCount === 1 ? '' : 's'} outside sitemap`}
            lines={[
              issueCount ? `${issueCount} page${issueCount > 1 ? 's' : ''} still need attention` : 'No rollout blockers detected',
              `${rows.length} total cockpit row${rows.length === 1 ? '' : 's'}`,
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

          {candidateRows.length ? (
            <VideoSeoInventoryTable rows={candidateRows} />
          ) : (
            <AdminEmptyState>No candidates are currently blocked outside the sitemap.</AdminEmptyState>
          )}
        </div>
      </AdminSection>
    </div>
  );
}
