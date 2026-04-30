import Link from 'next/link';
import type { ReactNode } from 'react';
import { ExternalLink, FileQuestion, Filter } from 'lucide-react';
import { SeoCopyButton } from '@/components/admin/SeoCopyButton';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { normalizeGscRange, type GscRangeKey } from '@/lib/seo/gsc-analysis';
import type { MissingContentItem, MissingContentRecommendationType, SeoActionPriority } from '@/lib/seo/internal-seo-types';
import { labelizeMissingContentIntent, labelizeRecommendation } from '@/lib/seo/missing-content';
import { stripOrigin } from '@/lib/seo/seo-opportunity-engine';
import { fetchSeoCockpitData } from '@/server/seo/cockpit';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    range?: string | string[];
    priority?: string | string[];
    recommendation?: string | string[];
  }>;
};

const RANGE_OPTIONS: Array<{ value: GscRangeKey; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '28d', label: '28 days' },
  { value: '3m', label: '3 months' },
];

const priorityOptions: Array<SeoActionPriority | 'all'> = ['all', 'critical', 'high', 'medium', 'low'];
const recommendationOptions: Array<MissingContentRecommendationType | 'all'> = [
  'all',
  'add_section',
  'add_faq',
  'add_comparison_block',
  'add_specs_block',
  'add_pricing_block',
  'add_examples_block',
  'strengthen_existing_page',
  'create_page',
  'watchlist',
];
const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const positionFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default async function AdminSeoMissingContentPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const range = normalizeGscRange(firstParam(searchParams?.range));
  const selectedPriority = normalizePriority(firstParam(searchParams?.priority));
  const selectedRecommendation = normalizeRecommendation(firstParam(searchParams?.recommendation));
  const data = await fetchSeoCockpitData({ range });
  const items = data.missingContentItems.filter((item) => {
    if (selectedPriority !== 'all' && item.priority !== selectedPriority) return false;
    if (selectedRecommendation !== 'all' && item.recommendationType !== selectedRecommendation) return false;
    return true;
  });
  const cacheSummary = data.gsc.fetchedAt
    ? `Last refreshed at ${dateTimeFormatter.format(new Date(data.gsc.fetchedAt))}.`
    : 'No refreshed GSC snapshot yet.';

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="SEO"
        title="Missing Content"
        description="Cached-GSC detector for section, FAQ, specs, examples, and dedicated-page decisions."
        actions={
          <>
            <RangeTabs current={range} />
            <AdminActionLink href={`/admin/seo/cockpit?range=${range}`} prefetch={false}>
              Cockpit
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/ctr-doctor?range=${range}`} prefetch={false}>
              CTR Doctor
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
        title="Recommendation Queue"
        description={`${numberFormatter.format(items.length)} of ${numberFormatter.format(data.missingContentItems.length)} Missing Content items visible. ${cacheSummary}`}
        action={<span className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary"><Filter className="h-3.5 w-3.5" /> Cached GSC only</span>}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <FilterGroup
            title="Priority"
            items={priorityOptions.map((priority) => ({ value: priority, label: labelize(priority) }))}
            active={selectedPriority}
            range={range}
            param="priority"
          />
          <FilterGroup
            title="Recommendation"
            items={recommendationOptions.map((recommendation) => ({
              value: recommendation,
              label: recommendation === 'all' ? 'All' : labelizeRecommendation(recommendation),
            }))}
            active={selectedRecommendation}
            range={range}
            param="recommendation"
          />
        </div>
      </AdminSection>

      <AdminSection
        title="Content Decision Cards"
        description="Each card explains why the detector picked section, FAQ, block, page, watchlist, or no-page work."
      >
        {items.length ? (
          <div className="grid gap-4">
            {items.map((item) => (
              <MissingContentDetails key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <AdminEmptyState>
            <p className="font-semibold text-text-primary">No Missing Content items</p>
            <p className="mt-1">Refresh GSC manually, clear filters, or expand the date range.</p>
          </AdminEmptyState>
        )}
      </AdminSection>
    </div>
  );
}

function MissingContentDetails({ item }: { item: MissingContentItem }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={item.priority} />
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
              {labelizeRecommendation(item.recommendationType)}
            </span>
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{item.family}</span>
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{labelizeMissingContentIntent(item.intent)}</span>
          </div>
          <h2 className="mt-3 text-base font-semibold leading-6 text-text-primary">{item.queryCluster}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{item.observedGap}</p>
        </div>
        <SeoCopyButton value={item.codexTaskDraft} />
      </div>

      <div className="mt-4 grid gap-4 border-t border-hairline pt-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 md:grid-cols-2">
          <Prescription title="Recommended action" body={item.recommendedAction} />
          <Prescription title="Why this action" body={item.whyThisAction} />
          <Prescription title="Why not create page" body={item.whyNotCreatePage ?? 'A dedicated page may be justified after reviewing existing page fit and future GSC signal.'} />
          <Prescription title="Review note" body="Review existing page content first. The detector uses cached GSC rows and route/config signals, not a full content crawler." />
        </div>
        <aside className="space-y-3">
          <div className="rounded-2xl border border-hairline bg-surface p-4">
            <div className="flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-text-muted" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Metrics</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Metric label="Clicks" value={numberFormatter.format(item.currentMetrics.clicks)} />
              <Metric label="Impr." value={numberFormatter.format(item.currentMetrics.impressions)} />
              <Metric label="CTR" value={percentFormatter.format(item.currentMetrics.ctr)} />
              <Metric label="Position" value={positionFormatter.format(item.currentMetrics.averagePosition)} />
            </div>
          </div>
          <InfoBlock title="Target">
            {item.targetUrl ? (
              <a href={item.targetUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
                <span className="truncate">{stripOrigin(item.targetUrl)}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : (
              <p className="text-sm text-text-secondary">Target uncertain</p>
            )}
          </InfoBlock>
          <InfoBlock title="Likely candidates">
            <ul className="space-y-1 text-sm text-text-secondary">
              {item.likelyPageCandidates.length ? item.likelyPageCandidates.map((candidate) => (
                <li key={candidate}>{candidate}</li>
              )) : <li>Review existing routes first</li>}
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
}: {
  title: string;
  items: Array<{ value: string; label: string }>;
  active: string;
  range: GscRangeKey;
  param: 'priority' | 'recommendation';
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
          href={`/admin/seo/missing-content?range=${option.value}`}
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
  return `/admin/seo/missing-content?${params.toString()}`;
}

function normalizePriority(value?: string | null): SeoActionPriority | 'all' {
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') return value;
  return 'all';
}

function normalizeRecommendation(value?: string | null): MissingContentRecommendationType | 'all' {
  return recommendationOptions.includes(value as MissingContentRecommendationType | 'all')
    ? (value as MissingContentRecommendationType | 'all')
    : 'all';
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function labelize(value: string) {
  if (value === 'all') return 'All';
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
