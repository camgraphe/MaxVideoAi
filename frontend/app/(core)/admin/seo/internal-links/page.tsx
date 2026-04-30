import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, ExternalLink, Filter, Network } from 'lucide-react';
import { SeoCopyButton } from '@/components/admin/SeoCopyButton';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { normalizeGscRange, type GscRangeKey } from '@/lib/seo/gsc-analysis';
import type {
  InternalLinkSuggestion,
  SeoActionPriority,
  SeoPageType,
} from '@/lib/seo/internal-seo-types';
import { labelizeInternalLinkType, labelizePageType } from '@/lib/seo/internal-link-builder';
import { compactIntentLabel } from '@/lib/seo/seo-intents';
import { fetchSeoCockpitData } from '@/server/seo/cockpit';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: {
    range?: string | string[];
    priority?: string | string[];
    family?: string | string[];
    sourceType?: string | string[];
    targetType?: string | string[];
  };
};

const RANGE_OPTIONS: Array<{ value: GscRangeKey; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '28d', label: '28 days' },
  { value: '3m', label: '3 months' },
];

const priorityOptions: Array<SeoActionPriority | 'all'> = ['all', 'critical', 'high', 'medium', 'low'];
const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const positionFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default async function AdminSeoInternalLinksPage({ searchParams }: PageProps) {
  const range = normalizeGscRange(firstParam(searchParams?.range));
  const selectedPriority = normalizePriority(firstParam(searchParams?.priority));
  const selectedFamily = firstParam(searchParams?.family) ?? 'all';
  const selectedSourceType = normalizePageType(firstParam(searchParams?.sourceType));
  const selectedTargetType = normalizePageType(firstParam(searchParams?.targetType));
  const data = await fetchSeoCockpitData({ range });
  const suggestions = data.internalLinkSuggestions.filter((item) => {
    if (selectedPriority !== 'all' && item.priority !== selectedPriority) return false;
    if (selectedFamily !== 'all' && item.family !== selectedFamily) return false;
    if (selectedSourceType !== 'all' && item.sourceType !== selectedSourceType) return false;
    if (selectedTargetType !== 'all' && item.targetType !== selectedTargetType) return false;
    return true;
  });
  const cacheSummary = data.gsc.fetchedAt
    ? `Last refreshed at ${dateTimeFormatter.format(new Date(data.gsc.fetchedAt))}.`
    : 'No refreshed GSC snapshot yet.';

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="SEO"
        title="Internal Links"
        description="Cached-GSC link builder for source-to-target suggestions across model, examples, pricing, and comparison pages."
        actions={
          <>
            <RangeTabs current={range} />
            <AdminActionLink href={`/admin/seo/cockpit?range=${range}`} prefetch={false}>
              Cockpit
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/missing-content?range=${range}`} prefetch={false}>
              Missing content
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/actions?range=${range}`} prefetch={false}>
              Action queue
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

      <AdminSection
        title="Link Recommendation Queue"
        description={`${numberFormatter.format(suggestions.length)} of ${numberFormatter.format(data.internalLinkSuggestions.length)} internal link suggestions visible. ${cacheSummary}`}
        action={<span className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary"><Filter className="h-3.5 w-3.5" /> Cached GSC only</span>}
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <FilterGroup title="Priority" items={priorityOptions.map((value) => ({ value, label: labelize(value) }))} active={selectedPriority} range={range} param="priority" />
          <FilterGroup title="Family" items={buildFilterItems(data.internalLinkSuggestions.map((item) => item.family))} active={selectedFamily} range={range} param="family" />
          <FilterGroup title="Source" items={buildFilterItems(data.internalLinkSuggestions.map((item) => item.sourceType), (value) => labelizePageType(value as SeoPageType))} active={selectedSourceType} range={range} param="sourceType" />
          <FilterGroup title="Target" items={buildFilterItems(data.internalLinkSuggestions.map((item) => item.targetType), (value) => labelizePageType(value as SeoPageType))} active={selectedTargetType} range={range} param="targetType" />
        </div>
      </AdminSection>

      <AdminSection
        title="Source To Target Cards"
        description="Each card is a scoped internal linking task. Verify existing links first before adding anything new."
      >
        {suggestions.length ? (
          <div className="grid gap-4">
            {suggestions.map((item) => (
              <InternalLinkDetails key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <AdminEmptyState>
            <p className="font-semibold text-text-primary">No internal link suggestions</p>
            <p className="mt-1">Refresh GSC manually, clear filters, or expand the date range.</p>
          </AdminEmptyState>
        )}
      </AdminSection>
    </div>
  );
}

function InternalLinkDetails({ item }: { item: InternalLinkSuggestion }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={item.priority} />
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
              {labelizeInternalLinkType(item.recommendationType)}
            </span>
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{item.family}</span>
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{compactIntentLabel(item.intent)}</span>
          </div>
          <h2 className="mt-3 text-base font-semibold leading-6 text-text-primary">{item.sourceUrl} → {item.targetUrl}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{item.reason}</p>
        </div>
        <SeoCopyButton value={item.codexTaskDraft} />
      </div>

      <div className="mt-4 grid gap-4 border-t border-hairline pt-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 md:grid-cols-2">
          <LinkRoute title="Source page" href={item.sourceUrl} type={labelizePageType(item.sourceType)} />
          <LinkRoute title="Target page" href={item.targetUrl} type={labelizePageType(item.targetType)} />
          <Prescription title="Suggested anchor" body={item.suggestedAnchor} />
          <Prescription title="Review note" body={item.verifyExistingLinkFirst ? 'Verify whether this internal link already exists first. Add or clarify only if the current link path is missing or weak.' : 'Add the link where it naturally helps users move between related pages.'} />
        </div>
        <aside className="space-y-3">
          <div className="rounded-2xl border border-hairline bg-surface p-4">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-text-muted" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Metrics</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Metric label="Clicks" value={numberFormatter.format(item.currentMetrics.clicks)} />
              <Metric label="Impr." value={numberFormatter.format(item.currentMetrics.impressions)} />
              <Metric label="CTR" value={percentFormatter.format(item.currentMetrics.ctr)} />
              <Metric label="Position" value={positionFormatter.format(item.currentMetrics.averagePosition)} />
            </div>
          </div>
          <InfoBlock title="Query cluster">
            <p className="text-sm font-semibold text-text-primary">{item.relatedQueryCluster}</p>
            <ul className="mt-2 space-y-1 text-sm text-text-secondary">
              {item.representativeQueries.map((query) => (
                <li key={query}>{query}</li>
              ))}
            </ul>
          </InfoBlock>
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

function LinkRoute({ title, href, type }: { title: string; href: string; type: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
      <a href={href} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-2 text-sm font-semibold text-text-primary hover:text-text-secondary">
        <span className="truncate">{href}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      </a>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-hairline bg-bg px-2 py-1 text-[11px] font-semibold text-text-secondary">
        <ArrowRight className="h-3 w-3" />
        {type}
      </div>
    </div>
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
}: {
  title: string;
  items: Array<{ value: string; label: string }>;
  active: string;
  range: GscRangeKey;
  param: 'priority' | 'family' | 'sourceType' | 'targetType';
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
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
          href={`/admin/seo/internal-links?range=${option.value}`}
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

function buildFilteredHref(range: GscRangeKey, param: string, value: string) {
  const params = new URLSearchParams({ range });
  if (value !== 'all') params.set(param, value);
  return `/admin/seo/internal-links?${params.toString()}`;
}

function buildFilterItems(values: string[], labeler: (value: string) => string = (value) => value) {
  return [
    { value: 'all', label: 'All' },
    ...Array.from(new Set(values)).filter(Boolean).sort().map((value) => ({ value, label: labeler(value) })),
  ];
}

function normalizePriority(value?: string | null): SeoActionPriority | 'all' {
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') return value;
  return 'all';
}

function normalizePageType(value?: string | null): SeoPageType | 'all' {
  const valid: SeoPageType[] = ['homepage', 'models_hub', 'examples_hub', 'family_examples', 'model_page', 'compare_hub', 'compare_page', 'pricing', 'other'];
  return valid.includes(value as SeoPageType) ? (value as SeoPageType) : 'all';
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function labelize(value: string) {
  if (value === 'all') return 'All';
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
