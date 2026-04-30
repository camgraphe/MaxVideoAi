import Link from 'next/link';
import type { ReactNode } from 'react';
import { Activity, ExternalLink, Filter, TrendingDown, TrendingUp } from 'lucide-react';
import { SeoCopyButton } from '@/components/admin/SeoCopyButton';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { labelizeMomentumType } from '@/lib/seo/content-momentum';
import { normalizeGscRange, type GscRangeKey } from '@/lib/seo/gsc-analysis';
import type { ContentMomentumItem, ContentMomentumType, SeoActionPriority } from '@/lib/seo/internal-seo-types';
import { stripOrigin } from '@/lib/seo/seo-opportunity-engine';
import { fetchSeoCockpitData } from '@/server/seo/cockpit';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    range?: string | string[];
    priority?: string | string[];
    family?: string | string[];
    type?: string | string[];
    direction?: string | string[];
  }>;
};

const RANGE_OPTIONS: Array<{ value: GscRangeKey; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '28d', label: '28 days' },
  { value: '3m', label: '3 months' },
];

const priorityOptions: Array<SeoActionPriority | 'all'> = ['all', 'critical', 'high', 'medium', 'low'];
const typeOptions: Array<ContentMomentumType | 'all'> = [
  'all',
  'protect_winner',
  'refresh_candidate',
  'gaining_page',
  'declining_page',
  'gaining_cluster',
  'declining_cluster',
  'rising_family',
  'declining_family',
  'mixed_family_momentum',
  'outdated_model_attention',
  'watchlist',
];
const directionOptions = ['all', 'rising', 'declining', 'mixed', 'watchlist'] as const;
const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const positionFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default async function AdminSeoMomentumPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const range = normalizeGscRange(firstParam(searchParams?.range));
  const selectedPriority = normalizePriority(firstParam(searchParams?.priority));
  const selectedFamily = firstParam(searchParams?.family) ?? 'all';
  const selectedType = normalizeType(firstParam(searchParams?.type));
  const selectedDirection = normalizeDirection(firstParam(searchParams?.direction));
  const data = await fetchSeoCockpitData({ range });
  const items = data.momentumItems.filter((item) => {
    if (selectedPriority !== 'all' && item.priority !== selectedPriority) return false;
    if (selectedFamily !== 'all' && item.family !== selectedFamily) return false;
    if (selectedType !== 'all' && item.type !== selectedType) return false;
    if (selectedDirection !== 'all' && itemDirection(item) !== selectedDirection) return false;
    return true;
  });
  const cacheSummary = data.gsc.fetchedAt
    ? `Last refreshed at ${dateTimeFormatter.format(new Date(data.gsc.fetchedAt))}.`
    : 'No refreshed GSC snapshot yet.';
  const hasComparisonRows = (data.gsc.previousRows?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="SEO"
        title="Content Momentum"
        description="Cached-GSC period-over-period detector for pages, clusters, and model families gaining or losing traction."
        actions={
          <>
            <RangeTabs current={range} />
            <AdminActionLink href={`/admin/seo/cockpit?range=${range}`} prefetch={false}>
              Cockpit
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/actions?range=${range}`} prefetch={false}>
              Action queue
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/internal-links?range=${range}`} prefetch={false}>
              Internal links
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/gsc?range=${range}`} prefetch={false}>
              Raw GSC
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

      {!hasComparisonRows ? (
        <AdminNotice tone="info">
          Not enough comparison data is cached yet. Refresh GSC manually once comparison rows are available for this date range.
        </AdminNotice>
      ) : null}

      <AdminSection
        title="Momentum Filters"
        description={`${numberFormatter.format(items.length)} of ${numberFormatter.format(data.momentumItems.length)} momentum items visible. ${cacheSummary}`}
        action={<span className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary"><Filter className="h-3.5 w-3.5" /> Cached GSC only</span>}
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <FilterGroup title="Priority" items={priorityOptions.map((value) => ({ value, label: labelize(value) }))} active={selectedPriority} range={range} param="priority" />
          <FilterGroup title="Family" items={buildFilterItems(data.momentumItems.map((item) => item.family))} active={selectedFamily} range={range} param="family" />
          <FilterGroup title="Type" items={typeOptions.map((value) => ({ value, label: value === 'all' ? 'All' : labelizeMomentumType(value) }))} active={selectedType} range={range} param="type" compact />
          <FilterGroup title="Direction" items={directionOptions.map((value) => ({ value, label: labelize(value) }))} active={selectedDirection} range={range} param="direction" />
        </div>
      </AdminSection>

      <AdminSection
        title="Momentum Cards"
        description="Each item explains what changed, why it matters, and whether to protect, refresh, reposition, or watch."
      >
        {items.length ? (
          <div className="grid gap-4">
            {items.map((item) => (
              <MomentumDetails key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <AdminEmptyState>
            <p className="font-semibold text-text-primary">No Content Momentum items</p>
            <p className="mt-1">Refresh GSC manually, clear filters, or expand the date range.</p>
          </AdminEmptyState>
        )}
      </AdminSection>
    </div>
  );
}

function MomentumDetails({ item }: { item: ContentMomentumItem }) {
  const direction = itemDirection(item);
  const Icon = direction === 'declining' ? TrendingDown : direction === 'rising' ? TrendingUp : Activity;
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={item.priority} />
            <span className={direction === 'declining' ? 'rounded-full border border-warning-border bg-warning-bg px-2 py-1 text-[11px] font-semibold text-warning' : direction === 'rising' ? 'rounded-full border border-success/25 bg-success-bg px-2 py-1 text-[11px] font-semibold text-success' : 'rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary'}>
              {labelizeMomentumType(item.type)}
            </span>
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{item.family}</span>
          </div>
          <h2 className="mt-3 text-base font-semibold leading-6 text-text-primary">{item.queryCluster ?? (item.pageUrl ? stripOrigin(item.pageUrl) : item.family)}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{item.observedTrend}</p>
        </div>
        <SeoCopyButton value={item.codexTaskDraft} />
      </div>

      <div className="mt-4 grid gap-4 border-t border-hairline pt-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 md:grid-cols-2">
          <Prescription title="Recommended action" body={item.recommendedAction} />
          <Prescription title="Why it matters" body={item.whyItMatters} />
          <Prescription title="Target" body={item.pageUrl ? stripOrigin(item.pageUrl) : item.queryCluster ?? item.family} />
          <Prescription title="Review note" body="Use this as momentum context. Merge it into existing Opportunity, CTR Doctor, Missing Content, or Internal Link tasks when they target the same page or cluster." />
        </div>
        <aside className="space-y-3">
          <div className="rounded-2xl border border-hairline bg-surface p-4">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-text-muted" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Current vs previous</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Metric label="Clicks" value={`${formatSigned(item.clickDelta)} (${numberFormatter.format(item.current.clicks)})`} />
              <Metric label="Impr." value={`${formatSigned(item.impressionDelta)} (${numberFormatter.format(item.current.impressions)})`} />
              <Metric label="CTR" value={`${formatSignedPercent(item.ctrDelta)} (${percentFormatter.format(item.current.ctr)})`} />
              <Metric label="Position" value={`${formatSigned(item.positionDelta)} (${positionFormatter.format(item.current.averagePosition)})`} />
            </div>
          </div>
          {item.pageUrl ? (
            <InfoBlock title="Page">
              <a href={item.pageUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
                <span className="truncate">{stripOrigin(item.pageUrl)}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            </InfoBlock>
          ) : null}
          <InfoBlock title="Acceptance criteria">
            <ul className="space-y-1 text-sm text-text-secondary">
              {item.acceptanceCriteria.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ul>
          </InfoBlock>
        </aside>
      </div>
    </article>
  );
}

function Prescription({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-bg px-2 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-1 font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function FilterGroup({
  title,
  items,
  active,
  range,
  param,
  compact = false,
}: {
  title: string;
  items: Array<{ value: string; label: string }>;
  active: string;
  range: GscRangeKey;
  param: 'priority' | 'family' | 'type' | 'direction';
  compact?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
      <div className={compact ? 'mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1' : 'mt-2 flex flex-wrap gap-2'}>
        {items.map((item) => (
          <Link
            key={item.value}
            href={buildFilteredHref(range, param, item.value)}
            prefetch={false}
            className={
              item.value === active
                ? 'rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white'
                : 'rounded-lg border border-hairline bg-bg px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function RangeTabs({ current }: { current: GscRangeKey }) {
  return (
    <div className="inline-flex rounded-lg border border-hairline bg-bg p-1">
      {RANGE_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={`/admin/seo/momentum?range=${option.value}`}
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

function PriorityPill({ priority }: { priority: SeoActionPriority }) {
  const base = 'inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]';
  if (priority === 'critical') return <span className={`${base} border-warning-border bg-warning-bg text-warning`}>Critical</span>;
  if (priority === 'high') return <span className={`${base} border-info/25 bg-info/10 text-info`}>High</span>;
  if (priority === 'medium') return <span className={`${base} border-hairline bg-surface-2 text-text-secondary`}>Medium</span>;
  return <span className={`${base} border-hairline bg-surface text-text-muted`}>Low</span>;
}

function buildFilterItems<T extends string>(values: T[], labeler: (value: T) => string = labelize) {
  return [
    { value: 'all', label: 'All' },
    ...Array.from(new Set(values))
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: labeler(value) })),
  ];
}

function buildFilteredHref(range: GscRangeKey, param: 'priority' | 'family' | 'type' | 'direction', value: string) {
  const params = new URLSearchParams({ range });
  if (value !== 'all') params.set(param, value);
  return `/admin/seo/momentum?${params.toString()}`;
}

function itemDirection(item: ContentMomentumItem): 'rising' | 'declining' | 'mixed' | 'watchlist' {
  if (item.type === 'watchlist' || item.type === 'outdated_model_attention') return 'watchlist';
  if (item.type === 'mixed_family_momentum') return 'mixed';
  if (item.type === 'declining_page' || item.type === 'declining_cluster' || item.type === 'declining_family' || item.type === 'refresh_candidate') return 'declining';
  return 'rising';
}

function normalizePriority(value?: string | null): SeoActionPriority | 'all' {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low' ? value : 'all';
}

function normalizeType(value?: string | null): ContentMomentumType | 'all' {
  return typeOptions.includes(value as ContentMomentumType | 'all') ? (value as ContentMomentumType | 'all') : 'all';
}

function normalizeDirection(value?: string | null): (typeof directionOptions)[number] {
  return directionOptions.includes(value as (typeof directionOptions)[number]) ? (value as (typeof directionOptions)[number]) : 'all';
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function labelize(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatSigned(value: number) {
  if (!Number.isFinite(value)) return '0';
  return `${value > 0 ? '+' : ''}${value.toFixed(Number.isInteger(value) ? 0 : 1)}`;
}

function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) return '+0.00%';
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}
