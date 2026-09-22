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
  const { candidateCount, disabledCount, issueCount, sitemapCount, strongRows } = buildVideoSeoSummary(rows);
  const { candidateRows, disabledRows, indexedRows } = splitVideoSeoRows(rows);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Curation"
        title="Video SEO watch pages"
        description="Review candidate `/video/[id]` pages for Google Video. Check eligibility, public media and watch pages."
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
        description="Review the candidate list before inspecting individual watch pages."
      >
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-4" density="compact" />
      </AdminSection>

      <AdminSection
        title="Add Candidate"
        description="Add a public video as an editorial draft. It stays outside the sitemap until approval and quality checks pass."
      >
        <VideoSeoCandidateForm />
      </AdminSection>

      <AdminSection
        title="Indexed Watch Pages"
        description="Pages eligible for the video sitemap: approved, complete, quality checked and backed by public media."
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
        description="Candidates, drafts and pages awaiting editorial or technical checks. Disabled pages are listed separately."
        action={
          <AdminSectionMeta
            title={`${candidateCount} page${candidateCount === 1 ? '' : 's'} outside sitemap`}
            lines={[
              issueCount ? `${issueCount} page${issueCount > 1 ? 's' : ''} still need attention` : 'No rollout blockers detected',
              `${disabledCount} disabled archive row${disabledCount === 1 ? '' : 's'}`,
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

      {disabledRows.length ? (
        <AdminSection title="Disabled Archive" description="Database exclusions prevent config fallbacks from restoring these videos to the sitemap. The archive shows up to 20 rows by default." action={<AdminSectionMeta title={`${disabledRows.length} disabled`} lines={['No sitemap, noindex follow']} />}>
          <details className="rounded-2xl border border-hairline bg-bg/40">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-text-primary">Show disabled video SEO pages</summary>
            <div className="border-t border-hairline">
              <VideoSeoInventoryTable rows={disabledRows.slice(0, 20)} />
            </div>
          </details>
        </AdminSection>
      ) : null}
    </div>
  );
}
