import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  ClipboardList,
  ExternalLink,
  FileQuestion,
  Network,
  Search,
  SearchCheck,
  Stethoscope,
} from 'lucide-react';
import { GscRefreshButton } from '@/components/admin/GscRefreshButton';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import type { GscRangeKey } from '@/lib/seo/gsc-analysis';
import type { ContentMomentumItem, CtrDoctorItem, InternalLinkSuggestion, MissingContentItem, UnifiedPageActionBrief, UrlInspectionItem } from '@/lib/seo/internal-seo-types';
import { labelizeMomentumType } from '@/lib/seo/content-momentum';
import { labelizeInternalLinkType } from '@/lib/seo/internal-link-builder';
import { labelizeRecommendation } from '@/lib/seo/missing-content';
import { compactIntentLabel } from '@/lib/seo/seo-intents';
import { stripOrigin } from '@/lib/seo/seo-opportunity-engine';
import { labelizeUrlInspectionStatus } from '@/lib/seo/url-inspection';
import type { SeoCockpitData } from '@/server/seo/cockpit';
import {
  ActionCard,
  CodexPreviewCard,
  FamilyStrategyCard,
  MetricChip,
  OpportunityClusterGrid,
  PageActionBriefCard,
  PriorityPill,
} from './SeoCockpitActionCards';
import { SeoCommandDeck } from './SeoCockpitCommandDeck';

type SeoCockpitViewProps = {
  data: SeoCockpitData;
  range: GscRangeKey;
  unifiedBriefs: UnifiedPageActionBrief[];
  urlInspectionItems: UrlInspectionItem[];
};

const RANGE_OPTIONS: Array<{ value: GscRangeKey; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '28d', label: '28 days' },
  { value: '3m', label: '3 months' },
];

const numberFormatter = new Intl.NumberFormat('en-US');
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

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

function formatSigned(value: number) {
  if (!Number.isFinite(value)) return '0';
  return `${value > 0 ? '+' : ''}${value.toFixed(Number.isInteger(value) ? 0 : 1)}`;
}

function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) return '+0.00%';
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <AdminEmptyState>
      <p className="font-semibold text-text-primary">No SEO actions</p>
      <p className="mt-1">{message}</p>
    </AdminEmptyState>
  );
}
