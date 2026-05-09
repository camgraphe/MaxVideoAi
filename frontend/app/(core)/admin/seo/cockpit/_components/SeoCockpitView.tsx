import {
  BarChart3,
  ClipboardList,
  Search,
} from 'lucide-react';
import { GscRefreshButton } from '@/components/admin/GscRefreshButton';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import type { GscRangeKey } from '@/lib/seo/gsc-analysis';
import type { UnifiedPageActionBrief, UrlInspectionItem } from '@/lib/seo/internal-seo-types';
import type { SeoCockpitData } from '@/server/seo/cockpit';
import {
  ActionCard,
  CodexPreviewCard,
  FamilyStrategyCard,
  OpportunityClusterGrid,
  PageActionBriefCard,
} from './SeoCockpitActionCards';
import { SeoCommandDeck } from './SeoCockpitCommandDeck';
import {
  CtrDoctorCard,
  InternalLinkCard,
  MissingContentCard,
  MomentumCard,
  UrlInspectionPreviewCard,
} from './SeoCockpitPreviewCards';
import { RangeTabs } from './SeoCockpitRangeTabs';

type SeoCockpitViewProps = {
  data: SeoCockpitData;
  range: GscRangeKey;
  unifiedBriefs: UnifiedPageActionBrief[];
  urlInspectionItems: UrlInspectionItem[];
};

const numberFormatter = new Intl.NumberFormat('en-US');

export function SeoCockpitView({ data, range, unifiedBriefs, urlInspectionItems }: SeoCockpitViewProps) {
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="SEO"
        title="SEO Cockpit"
        description="Internal command center for Search Console signals, family strategy, and Codex-ready SEO actions."
        actions={
          <>
            <RangeTabs current={range} basePath="/admin/seo/cockpit" />
            <GscRefreshButton range={range} />
            <AdminActionLink href={`/admin/seo/gsc?range=${range}`} prefetch={false}>
              Raw GSC
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/actions?range=${range}`} prefetch={false}>
              Action queue
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/page-actions?range=${range}`} prefetch={false}>
              Page actions
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/ctr-doctor?range=${range}`} prefetch={false}>
              CTR Doctor
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/missing-content?range=${range}`} prefetch={false}>
              Missing content
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/internal-links?range=${range}`} prefetch={false}>
              Internal links
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/momentum?range=${range}`} prefetch={false}>
              Momentum
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/url-inspection?range=${range}`} prefetch={false}>
              URL inspection
            </AdminActionLink>
          </>
        }
      />

      {data.gsc.error ? (
        <AdminNotice tone={data.gsc.configured ? 'warning' : 'info'}>
          {data.gsc.error}
          {data.gsc.fetchedAt ? ' Showing the latest cached snapshot.' : ''}
        </AdminNotice>
      ) : null}

      <SeoCommandDeck data={data} range={range} urlInspectionCount={urlInspectionItems.length} />

      <AdminSection
        title="Recommended Page Actions"
        description="Unified page/cluster briefs that combine opportunities, CTR, missing content, internal links, momentum, and URL Inspection context."
        action={<AdminActionLink href={`/admin/seo/page-actions?range=${range}`} prefetch={false}>Open page actions</AdminActionLink>}
      >
        {unifiedBriefs.length ? (
          <div className="grid gap-4">
            {unifiedBriefs.slice(0, 5).map((brief, index) => (
              <PageActionBriefCard key={brief.id} brief={brief} rank={index + 1} featured={index === 0} />
            ))}
          </div>
        ) : (
          <EmptyPanel message="No unified page action briefs generated for this cached snapshot." />
        )}
      </AdminSection>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)]">
        <AdminSection
          title="Urgent SEO Actions"
          description="Highest-leverage Codex task drafts generated from GSC clusters, business priority, and intent scoring."
          action={<AdminActionLink href={`/admin/seo/actions?range=${range}`} prefetch={false}>View all</AdminActionLink>}
        >
          {data.urgentActions.length ? (
            <div className="grid gap-4">
              {data.urgentActions.slice(0, 5).map((action, index) => (
                <ActionCard key={action.id} action={action} rank={index + 1} featured={index === 0} />
              ))}
            </div>
          ) : (
            <EmptyPanel message="No urgent actions detected for this date range yet." />
          )}
        </AdminSection>

        <AdminSection
          title="Family Strategy"
          description="Real MaxVideoAI model families, categorized by strategy and supported by GSC demand."
        >
          <div className="grid gap-3">
            {data.familyTracker.slice(0, 10).map((family) => (
              <FamilyStrategyCard key={family.family} family={family} />
            ))}
          </div>
        </AdminSection>
      </section>

      <AdminSection
        title="CTR Doctor"
        description="Snippet and first-screen recommendations for clusters where visibility is not converting into enough clicks."
        action={<AdminActionLink href={`/admin/seo/ctr-doctor?range=${range}`} prefetch={false}>Open CTR Doctor</AdminActionLink>}
      >
        {data.ctrDoctorItems.length ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {data.ctrDoctorItems.slice(0, 3).map((item) => (
              <CtrDoctorCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyPanel message="No CTR Doctor items for this cached snapshot." />
        )}
      </AdminSection>

      <AdminSection
        title="Missing Content"
        description="Section, FAQ, specs, examples, and page-fit recommendations from cached GSC intent clusters."
        action={<AdminActionLink href={`/admin/seo/missing-content?range=${range}`} prefetch={false}>Open detector</AdminActionLink>}
      >
        {data.missingContentItems.length ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {data.missingContentItems.slice(0, 3).map((item) => (
              <MissingContentCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyPanel message="No missing-content recommendations for this cached snapshot." />
        )}
      </AdminSection>

      <AdminSection
        title="Internal Links"
        description="Source-to-target link recommendations from cached GSC signals and MaxVideoAI model/page relationships."
        action={<AdminActionLink href={`/admin/seo/internal-links?range=${range}`} prefetch={false}>Open builder</AdminActionLink>}
      >
        {data.internalLinkSuggestions.length ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {data.internalLinkSuggestions.slice(0, 3).map((item) => (
              <InternalLinkCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyPanel message="No internal link suggestions for this cached snapshot." />
        )}
      </AdminSection>

      <AdminSection
        title="Momentum / Decay"
        description="Period-over-period signals for pages, query clusters, and model families that are gaining, declining, or need refresh attention."
        action={<AdminActionLink href={`/admin/seo/momentum?range=${range}`} prefetch={false}>Open momentum</AdminActionLink>}
      >
        {data.momentumItems.length ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {data.momentumItems.slice(0, 3).map((item) => (
              <MomentumCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyPanel message="No momentum items for this cached comparison snapshot." />
        )}
      </AdminSection>

      <AdminSection
        title="URL Inspection"
        description="Manual-only indexation checks for curated priority URLs. Uses cached inspection results until an admin clicks inspect."
        action={<AdminActionLink href={`/admin/seo/url-inspection?range=${range}`} prefetch={false}>Open inspection</AdminActionLink>}
      >
        {urlInspectionItems.length ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {urlInspectionItems.slice(0, 3).map((item) => (
              <UrlInspectionPreviewCard key={item.path} item={item} />
            ))}
          </div>
        ) : (
          <EmptyPanel message="No curated URL inspection targets available yet." />
        )}
      </AdminSection>

      <AdminSection
        title="Opportunity Clusters"
        description="Action clusters grouped by intent so the cockpit stays strategic instead of becoming a dense keyword table."
      >
        {data.opportunities.length ? (
          <OpportunityClusterGrid opportunities={data.opportunities} />
        ) : (
          <EmptyPanel message="No strategic opportunities found. Expand the date range or refresh once more Search Console data is available." />
        )}
      </AdminSection>

      <AdminSection
        title="Codex Action Queue Preview"
        description="Copy-ready task briefs, kept secondary to the cockpit but visible enough for fast handoff."
        action={<AdminActionLink href={`/admin/seo/actions?range=${range}`} prefetch={false}>Open queue</AdminActionLink>}
      >
        {data.actions.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.actions.slice(0, 4).map((action) => (
              <CodexPreviewCard key={action.id} action={action} />
            ))}
          </div>
        ) : (
          <EmptyPanel message="No Codex actions generated for this date range yet." />
        )}
      </AdminSection>

      <AdminSection
        title="Raw Search Console Diagnostics"
        description="Open the Phase 1 raw dashboard when you need row-level queries, landing pages, trend bars, and refresh diagnostics."
        action={<AdminActionLink href={`/admin/seo/gsc?range=${range}`} prefetch={false}>Inspect raw rows</AdminActionLink>}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <MiniPanel icon={Search} label="Raw queries" value={numberFormatter.format(data.gsc.topQueries.length)} helper="Top aggregated visible query rows" />
          <MiniPanel icon={BarChart3} label="Detail rows" value={numberFormatter.format(data.gsc.rows.length)} helper="Visible query/page rows, not total" />
          <MiniPanel icon={ClipboardList} label="Actions" value={numberFormatter.format(data.actions.length)} helper="Generated Codex tasks" />
        </div>
      </AdminSection>
    </div>
  );
}

function MiniPanel({ icon: Icon, label, value, helper }: { icon: typeof Search; label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
        </div>
        <Icon className="h-4 w-4 text-text-muted" />
      </div>
      <p className="mt-1 text-xs text-text-secondary">{helper}</p>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <AdminEmptyState>
      <p className="font-semibold text-text-primary">No SEO actions</p>
      <p className="mt-1">{message}</p>
    </AdminEmptyState>
  );
}
