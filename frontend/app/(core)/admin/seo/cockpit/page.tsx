import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleGauge,
  ClipboardList,
  ExternalLink,
  FileQuestion,
  Gauge,
  Layers3,
  MousePointerClick,
  Network,
  RadioTower,
  Search,
  SearchCheck,
  Sparkles,
  Stethoscope,
  Target,
  TrendingUp,
} from 'lucide-react';
import { GscRefreshButton } from '@/components/admin/GscRefreshButton';
import { SeoCopyButton } from '@/components/admin/SeoCopyButton';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { normalizeGscRange, type GscRangeKey } from '@/lib/seo/gsc-analysis';
import type { CodexSeoAction, ContentMomentumItem, CtrDoctorItem, InternalLinkSuggestion, MissingContentItem, SeoFamilyTrackerItem, SeoIntentType, StrategicSeoOpportunity, UnifiedPageActionBrief, UrlInspectionItem } from '@/lib/seo/internal-seo-types';
import { labelizeMomentumType } from '@/lib/seo/content-momentum';
import { labelizeInternalLinkType } from '@/lib/seo/internal-link-builder';
import { labelizeRecommendation } from '@/lib/seo/missing-content';
import { compactIntentLabel, getSeoFamilyDictionary } from '@/lib/seo/seo-intents';
import { stripOrigin } from '@/lib/seo/seo-opportunity-engine';
import { buildUnifiedActionBriefs } from '@/lib/seo/unified-action-briefs';
import { labelizeUrlInspectionStatus } from '@/lib/seo/url-inspection';
import { fetchSeoCockpitData, type SeoCockpitData } from '@/server/seo/cockpit';
import { fetchUrlInspectionDashboardData } from '@/server/seo/url-inspection';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: {
    range?: string | string[];
  };
};

const RANGE_OPTIONS: Array<{ value: GscRangeKey; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '28d', label: '28 days' },
  { value: '3m', label: '3 months' },
];

const numberFormatter = new Intl.NumberFormat('en-US');
const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const precisePercentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const positionFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default async function AdminSeoCockpitPage({ searchParams }: PageProps) {
  const range = normalizeGscRange(Array.isArray(searchParams?.range) ? searchParams?.range[0] : searchParams?.range);
  const [data, urlInspection] = await Promise.all([
    fetchSeoCockpitData({ range }),
    fetchUrlInspectionDashboardData({ range }),
  ]);
  const unifiedBriefs = buildUnifiedActionBriefs({
    opportunities: data.opportunities,
    ctrDoctorItems: data.ctrDoctorItems,
    missingContentItems: data.missingContentItems,
    internalLinkSuggestions: data.internalLinkSuggestions,
    momentumItems: data.momentumItems,
    urlInspectionItems: urlInspection.items,
  });

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

      <SeoCommandDeck data={data} range={range} urlInspectionCount={urlInspection.items.length} />

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
        {urlInspection.items.length ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {urlInspection.items.slice(0, 3).map((item) => (
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
          <MiniPanel icon={Search} label="Raw queries" value={numberFormatter.format(data.gsc.topQueries.length)} helper="Top aggregated query rows" />
          <MiniPanel icon={BarChart3} label="Tracked rows" value={numberFormatter.format(data.gsc.rows.length)} helper="Cached Search Analytics rows" />
          <MiniPanel icon={ClipboardList} label="Actions" value={numberFormatter.format(data.actions.length)} helper="Generated Codex tasks" />
        </div>
      </AdminSection>
    </div>
  );
}

function PageActionBriefCard({ brief, rank, featured = false }: { brief: UnifiedPageActionBrief; rank: number; featured?: boolean }) {
  return (
    <article className={featured ? 'rounded-2xl border border-info/25 bg-info/10 p-4 shadow-card' : 'rounded-2xl border border-hairline bg-bg/60 p-4'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className={featured ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white' : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-sm font-semibold text-text-secondary'}>
            {rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityPill priority={brief.priority} />
              <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{brief.family}</span>
              <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{compactIntentLabel(brief.intent)}</span>
              {brief.pageStatus ? (
                <span className="rounded-full border border-success/25 bg-success-bg px-2 py-1 text-[11px] font-semibold text-success">{labelizeUrlInspectionStatus(brief.pageStatus)}</span>
              ) : null}
            </div>
            <h2 className={featured ? 'mt-3 text-base font-semibold leading-6 text-text-primary' : 'mt-3 text-sm font-semibold leading-6 text-text-primary'}>
              {brief.queryCluster}
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{brief.observedProblem}</p>
          </div>
        </div>
        <SeoCopyButton value={brief.copyReadyCodexTask} />
      </div>

      <div className="mt-4 grid gap-4 border-t border-hairline pt-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Recommended implementation</p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{brief.recommendedImplementation}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {brief.sourceModules.map((module) => (
              <span key={module} className="rounded-full border border-hairline bg-surface px-2 py-1 text-[11px] font-semibold text-text-secondary">
                {module.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
        <aside className="min-w-0 rounded-xl border border-hairline bg-surface px-3 py-3 text-xs text-text-secondary">
          <p className="font-semibold text-text-primary">{brief.metricsSummary}</p>
          <a href={brief.targetUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 hover:text-text-primary">
            <span className="truncate">{brief.targetUrl}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          <p className="mt-3 text-text-muted">{brief.supportingActions.length} supporting actions · {brief.acceptanceCriteria.length} acceptance checks</p>
        </aside>
      </div>
    </article>
  );
}

function CtrDoctorCard({ item }: { item: CtrDoctorItem }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-text-secondary">
          <Stethoscope className="h-4 w-4" />
        </span>
        <PriorityPill priority={item.priority} />
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-text-primary">{item.title}</p>
      <p className="mt-2 text-xs text-text-secondary">
        {item.queryCluster} · {compactIntentLabel(item.detectedIntent)}
      </p>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{item.likelyProblem}</p>
      <div className="mt-3 rounded-xl border border-hairline bg-surface px-3 py-2">
        <p className="text-xs leading-5 text-text-secondary">{item.recommendedTitleDirection}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <span>{item.currentMetrics.impressions} impr · {(item.currentMetrics.ctr * 100).toFixed(2)}% CTR · pos {item.currentMetrics.averagePosition.toFixed(1)}</span>
        {item.targetUrl ? (
          <a href={item.targetUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 hover:text-text-primary">
            <span className="truncate">{stripOrigin(item.targetUrl)}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function MissingContentCard({ item }: { item: MissingContentItem }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-text-secondary">
          <FileQuestion className="h-4 w-4" />
        </span>
        <PriorityPill priority={item.priority} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
          {labelizeRecommendation(item.recommendationType)}
        </span>
        <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
          {item.family}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-text-primary">{item.queryCluster}</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{item.recommendedAction}</p>
      <div className="mt-3 rounded-xl border border-hairline bg-surface px-3 py-2">
        <p className="text-xs leading-5 text-text-secondary">{item.whyNotCreatePage ?? item.whyThisAction}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <span>{item.currentMetrics.impressions} impr · {(item.currentMetrics.ctr * 100).toFixed(2)}% CTR · pos {item.currentMetrics.averagePosition.toFixed(1)}</span>
        {item.targetUrl ? (
          <a href={item.targetUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 hover:text-text-primary">
            <span className="truncate">{stripOrigin(item.targetUrl)}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function InternalLinkCard({ item }: { item: InternalLinkSuggestion }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-text-secondary">
          <Network className="h-4 w-4" />
        </span>
        <PriorityPill priority={item.priority} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
          {labelizeInternalLinkType(item.recommendationType)}
        </span>
        <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
          {item.family}
        </span>
      </div>
      <div className="mt-3 rounded-xl border border-hairline bg-surface px-3 py-3">
        <div className="grid gap-2 text-xs text-text-secondary">
          <span className="truncate font-semibold text-text-primary">{item.sourceUrl}</span>
          <span className="inline-flex items-center gap-2 text-text-muted">
            <ArrowRight className="h-3.5 w-3.5" />
            Suggested link
          </span>
          <span className="truncate font-semibold text-text-primary">{item.targetUrl}</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-text-primary">{item.suggestedAnchor}</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{item.reason}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <span>{item.currentMetrics.impressions} impr · {(item.currentMetrics.ctr * 100).toFixed(2)}% CTR · pos {item.currentMetrics.averagePosition.toFixed(1)}</span>
        {item.verifyExistingLinkFirst ? <span className="font-semibold text-text-muted">Verify first</span> : null}
      </div>
    </article>
  );
}

function MomentumCard({ item }: { item: ContentMomentumItem }) {
  const rising = item.impressionDelta >= 0 || item.clickDelta >= 0;
  const mixed = item.type === 'mixed_family_momentum';
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-text-secondary">
          <Activity className="h-4 w-4" />
        </span>
        <PriorityPill priority={item.priority} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={mixed ? 'rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary' : rising ? 'rounded-full border border-success/25 bg-success-bg px-2 py-1 text-[11px] font-semibold text-success' : 'rounded-full border border-warning-border bg-warning-bg px-2 py-1 text-[11px] font-semibold text-warning'}>
          {labelizeMomentumType(item.type)}
        </span>
        <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
          {item.family}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-text-primary">
        {item.queryCluster ?? (item.pageUrl ? stripOrigin(item.pageUrl) : item.family)}
      </p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{item.recommendedAction}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <MetricChip label="Clicks" value={`${formatSigned(item.clickDelta)} (${item.current.clicks})`} />
        <MetricChip label="Impr." value={`${formatSigned(item.impressionDelta)} (${item.current.impressions})`} />
        <MetricChip label="CTR" value={`${formatSignedPercent(item.ctrDelta)} now ${(item.current.ctr * 100).toFixed(2)}%`} />
        <MetricChip label="Pos." value={`${formatSigned(item.positionDelta)} now ${item.current.averagePosition.toFixed(1)}`} />
      </div>
      {item.pageUrl ? (
        <a href={item.pageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex max-w-full items-center gap-1 text-xs text-text-secondary hover:text-text-primary">
          <span className="truncate">{stripOrigin(item.pageUrl)}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : null}
    </article>
  );
}

function UrlInspectionPreviewCard({ item }: { item: UrlInspectionItem }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-text-secondary">
          <SearchCheck className="h-4 w-4" />
        </span>
        <span className={item.severity === 'ok' ? 'rounded-full border border-success/25 bg-success-bg px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-success' : item.severity === 'unknown' ? 'rounded-full border border-hairline bg-surface px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted' : 'rounded-full border border-warning-border bg-warning-bg px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-warning'}>
          {item.severity}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-text-primary">{item.path}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
          {labelizeUrlInspectionStatus(item.status)}
        </span>
        {item.sources.slice(0, 2).map((source) => (
          <span key={source} className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
            {source.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{item.suggestedAction}</p>
      <p className="mt-3 text-xs text-text-secondary">
        {item.lastInspectedAt ? `Last inspected ${dateTimeFormatter.format(new Date(item.lastInspectedAt))}` : 'Not inspected yet'}
      </p>
    </article>
  );
}

function SeoCommandDeck({ data, range, urlInspectionCount }: { data: SeoCockpitData; range: GscRangeKey; urlInspectionCount: number }) {
  const statusTone = data.gsc.ok ? 'text-success' : data.gsc.configured ? 'text-warning' : 'text-info';
  const familyCount = getSeoFamilyDictionary().length;

  return (
    <section className="overflow-hidden rounded-[24px] border border-border bg-surface shadow-card">
      <div className="grid xl:grid-cols-[minmax(0,1.35fr)_380px]">
        <div className="border-b border-hairline px-5 py-5 xl:border-b-0 xl:border-r">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Command deck</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal text-text-primary">SEO Cockpit</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Action-first read of MaxVideoAI Search Console demand, model-family priority, and Codex implementation work.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/seo/gsc?range=${range}`}
                prefetch={false}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-hairline bg-bg px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
              >
                Raw GSC
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={`/admin/seo/actions?range=${range}`}
                prefetch={false}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white shadow-[0_14px_35px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
              >
                Action Queue
                <ClipboardList className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-4">
            <CommandMetric icon={MousePointerClick} label="Clicks" value={numberFormatter.format(data.gsc.summary.clicks)} helper="Current period" />
            <CommandMetric icon={BarChart3} label="Impressions" value={compactFormatter.format(data.gsc.summary.impressions)} helper="Search visibility" tone="info" />
            <CommandMetric icon={CircleGauge} label="CTR" value={precisePercentFormatter.format(data.gsc.summary.ctr)} helper="Average click-through" tone={data.gsc.summary.ctr < 0.015 ? 'warning' : 'success'} />
            <CommandMetric icon={TrendingUp} label="Avg position" value={positionFormatter.format(data.gsc.summary.position)} helper="Weighted rank" />
            <CommandMetric icon={Target} label="High actions" value={numberFormatter.format(data.overview.highPriorityActions)} helper="Critical or high" tone={data.overview.highPriorityActions ? 'warning' : 'success'} />
            <CommandMetric icon={AlertTriangle} label="Opportunities" value={numberFormatter.format(data.overview.totalOpportunities)} helper="Strategic clusters" tone={data.overview.totalOpportunities ? 'warning' : 'default'} />
            <CommandMetric icon={FileQuestion} label="Missing content" value={numberFormatter.format(data.missingContentItems.length)} helper="Sections, FAQs, pages" tone={data.missingContentItems.length ? 'info' : 'default'} />
            <CommandMetric icon={Network} label="Internal links" value={numberFormatter.format(data.internalLinkSuggestions.length)} helper="Source to target suggestions" tone={data.internalLinkSuggestions.length ? 'info' : 'default'} />
            <CommandMetric icon={Activity} label="Momentum" value={numberFormatter.format(data.momentumItems.length)} helper="Rising and declining signals" tone={data.momentumItems.length ? 'info' : 'default'} />
            <CommandMetric icon={SearchCheck} label="URL inspection" value={numberFormatter.format(urlInspectionCount)} helper="Curated index checks" tone="info" />
            <CommandMetric icon={Sparkles} label="Strongest family" value={data.overview.strongestFamily?.family ?? 'None'} helper={data.overview.strongestFamily ? `${compactFormatter.format(data.overview.strongestFamily.impressions)} impressions` : `${familyCount} real families tracked`} tone="success" />
            <CommandMetric icon={Gauge} label="Weak CTR family" value={data.overview.weakestCtrFamily?.family ?? 'None'} helper={data.overview.weakestCtrFamily ? precisePercentFormatter.format(data.overview.weakestCtrFamily.ctr) : 'No weak family rows'} tone={data.overview.weakestCtrFamily ? 'warning' : 'default'} />
          </div>
        </div>

        <aside className="bg-bg/45 px-5 py-5">
          <div className="grid gap-3">
            <StatusTile
              icon={data.gsc.ok ? CheckCircle2 : AlertTriangle}
              label="GSC status"
              value={data.gsc.ok ? 'Connected' : data.gsc.configured ? 'Stale/error' : 'Not configured'}
              helper={data.gsc.fetchedAt ? `Last refreshed at ${dateTimeFormatter.format(new Date(data.gsc.fetchedAt))}` : 'No refreshed snapshot'}
              className={statusTone}
            />
            <StatusTile
              icon={RadioTower}
              label="Window"
              value={`${data.gsc.windows.current.startDate} to ${data.gsc.windows.current.endDate}`}
              helper={`Previous: ${data.gsc.windows.previous.startDate} to ${data.gsc.windows.previous.endDate}`}
            />
            <StatusTile
              icon={Layers3}
              label="Family dictionary"
              value={`${familyCount} app families`}
              helper="Derived from MaxVideoAI model-family config"
            />
          </div>
        </aside>
      </div>
    </section>
  );
}

function RangeTabs({ current, basePath }: { current: GscRangeKey; basePath: string }) {
  return (
    <div className="inline-flex rounded-lg border border-hairline bg-bg p-1">
      {RANGE_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={`${basePath}?range=${option.value}`}
          prefetch={false}
          className={
            option.value === current
              ? 'rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white'
              : 'rounded-md px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

function CommandMetric({
  icon: Icon,
  label,
  value,
  helper,
  tone = 'default',
}: {
  icon: typeof Search;
  label: string;
  value: string;
  helper: string;
  tone?: 'default' | 'success' | 'warning' | 'info';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'info'
          ? 'text-info'
          : 'text-text-primary';
  return (
    <div className="bg-surface px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
          <p className={`mt-2 text-[1.45rem] font-semibold leading-tight ${toneClass}`}>{value}</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{helper}</p>
        </div>
        <Icon className="h-4 w-4 shrink-0 text-text-muted" />
      </div>
    </div>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  helper,
  className = 'text-text-primary',
}: {
  icon: typeof Search;
  label: string;
  value: string;
  helper: string;
  className?: string;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-bg text-text-secondary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
          <p className={`mt-1 truncate text-sm font-semibold ${className}`}>{value}</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ action, rank, featured = false }: { action: CodexSeoAction; rank: number; featured?: boolean }) {
  return (
    <article className={featured ? 'rounded-2xl border border-warning-border bg-warning-bg/40 p-4 shadow-card' : 'rounded-2xl border border-hairline bg-bg/60 p-4'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className={featured ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white' : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-sm font-semibold text-text-secondary'}>
            {rank}
          </span>
          <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={action.priority} />
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{action.family}</span>
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{compactIntentLabel(action.intent)}</span>
          </div>
          <h2 className={featured ? 'mt-3 text-base font-semibold leading-6 text-text-primary' : 'mt-3 text-sm font-semibold leading-6 text-text-primary'}>{action.title}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{action.observedIssue}</p>
          </div>
        </div>
        <SeoCopyButton value={action.markdown} />
      </div>
      <div className="mt-3 grid gap-3 border-t border-hairline pt-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Recommended implementation</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{action.recommendedImplementation}</p>
        </div>
        <div className="text-xs text-text-secondary">
          <p className="font-semibold text-text-primary">{action.metricsSummary}</p>
          {action.targetUrl ? (
            <a href={action.targetUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 hover:text-text-primary">
              <span className="truncate">{stripOrigin(action.targetUrl)}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function FamilyStrategyCard({ family }: { family: SeoFamilyTrackerItem }) {
  return (
    <article className="group rounded-2xl border border-hairline bg-bg/60 p-4 transition hover:border-border hover:bg-surface">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">{family.family}</p>
            <FamilyStatusPill status={family.familyStatus} />
          </div>
          <p className="mt-1 text-xs font-semibold text-text-muted">{family.businessPriorityLabel} · {family.momentum}</p>
        </div>
        <span className={family.highPriorityOpportunityCount ? 'rounded-full bg-warning-bg px-2 py-1 text-xs font-semibold text-warning' : 'rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-text-secondary'}>
          {family.opportunityCount} opp · {family.highPriorityOpportunityCount} high
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        <MetricChip label="Clicks" value={numberFormatter.format(family.clicks)} />
        <MetricChip label="Impr." value={compactFormatter.format(family.impressions)} />
        <MetricChip label="CTR" value={precisePercentFormatter.format(family.ctr)} />
        <MetricChip label="Pos." value={positionFormatter.format(family.position)} />
      </div>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{family.recommendedNextAction}</p>
      {family.topQueryClusters.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {family.topQueryClusters.slice(0, 3).map((cluster, index) => (
            <span key={`${family.family}-${cluster}-${index}`} className="rounded-full border border-hairline bg-surface px-2 py-1 text-[11px] font-medium text-text-secondary">{cluster}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function CodexPreviewCard({ action }: { action: CodexSeoAction }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={action.priority} />
            <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{action.family}</span>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-text-primary">{action.title}</p>
          <p className="mt-1 text-xs text-text-secondary">{action.metricsSummary}</p>
        </div>
        <SeoCopyButton value={action.markdown} label="Copy" />
      </div>
      <div className="mt-3 rounded-xl border border-hairline bg-surface px-3 py-2">
        <p className="text-xs leading-5 text-text-secondary">{action.recommendedImplementation}</p>
      </div>
    </article>
  );
}

function OpportunityClusterGrid({ opportunities }: { opportunities: StrategicSeoOpportunity[] }) {
  const groups = buildIntentGroups(opportunities);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <div key={group.label} className="rounded-2xl border border-hairline bg-bg/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">{group.label}</p>
              <p className="mt-1 text-xs text-text-secondary">{group.items.length} opportunities</p>
            </div>
            <span className="rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-text-secondary">
              {group.items.filter((item) => item.priority === 'critical' || item.priority === 'high').length} high
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {group.items.slice(0, 4).map((opportunity) => (
              <div key={opportunity.id} className="border-t border-hairline pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{opportunity.queryCluster}</p>
                    <p className="mt-1 text-xs text-text-secondary">{opportunity.modelFamily} · {stripOrigin(opportunity.targetUrl)}</p>
                  </div>
                  <PriorityPill priority={opportunity.priority} />
                </div>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{opportunity.suggestedAction}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildIntentGroups(opportunities: StrategicSeoOpportunity[]) {
  const definitions: Array<{ label: string; intents: SeoIntentType[] }> = [
    { label: 'Prompt / Examples', intents: ['prompt_examples', 'prompt_guide', 'examples'] },
    { label: 'Comparisons', intents: ['comparison'] },
    { label: 'Pricing / Specs', intents: ['pricing_specs', 'pricing', 'specs', 'max_length'] },
    { label: 'Pay-as-you-go / No subscription', intents: ['pay_as_you_go'] },
    { label: 'Brand / Typos', intents: ['brand', 'brand_typo'] },
    { label: 'Model pages to strengthen', intents: ['model_page', 'generic', 'image_to_video', 'text_to_video'] },
  ];

  return definitions
    .map((definition) => ({
      label: definition.label,
      items: opportunities.filter((opportunity) => definition.intents.includes(opportunity.intent)),
    }))
    .filter((group) => group.items.length > 0);
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

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-2 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-1 font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function formatSigned(value: number) {
  if (!Number.isFinite(value)) return '0';
  return `${value > 0 ? '+' : ''}${value.toFixed(Number.isInteger(value) ? 0 : 1)}`;
}

function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) return '+0.00%';
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}

function PriorityPill({ priority }: { priority: CodexSeoAction['priority'] }) {
  const base = 'inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]';
  if (priority === 'critical') return <span className={`${base} border-warning-border bg-warning-bg text-warning`}>Critical</span>;
  if (priority === 'high') return <span className={`${base} border-info/25 bg-info/10 text-info`}>High</span>;
  if (priority === 'medium') return <span className={`${base} border-hairline bg-surface-2 text-text-secondary`}>Medium</span>;
  return <span className={`${base} border-hairline bg-surface text-text-muted`}>Low</span>;
}

function FamilyStatusPill({ status }: { status: SeoFamilyTrackerItem['familyStatus'] }) {
  const base = 'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]';
  if (status === 'strategic') return <span className={`${base} bg-success-bg text-success`}>Strategic</span>;
  if (status === 'supported') return <span className={`${base} bg-info/10 text-info`}>Supported</span>;
  if (status === 'emerging') return <span className={`${base} bg-surface-2 text-text-secondary`}>Emerging</span>;
  if (status === 'deprioritized') return <span className={`${base} bg-warning-bg text-warning`}>De-prioritized</span>;
  if (status === 'brand') return <span className={`${base} bg-surface-2 text-text-secondary`}>Brand</span>;
  return <span className={`${base} bg-surface-2 text-text-muted`}>Unknown</span>;
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <AdminEmptyState>
      <p className="font-semibold text-text-primary">No SEO actions</p>
      <p className="mt-1">{message}</p>
    </AdminEmptyState>
  );
}
