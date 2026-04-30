import Link from 'next/link';
import type { ReactNode } from 'react';
import { Download, ExternalLink, Filter } from 'lucide-react';
import { SeoCopyButton } from '@/components/admin/SeoCopyButton';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { normalizeGscRange, type GscRangeKey } from '@/lib/seo/gsc-analysis';
import type { SeoActionPriority, UnifiedPageActionBrief } from '@/lib/seo/internal-seo-types';
import { compactIntentLabel } from '@/lib/seo/seo-intents';
import { buildUnifiedActionBriefs } from '@/lib/seo/unified-action-briefs';
import { labelizeUrlInspectionStatus } from '@/lib/seo/url-inspection';
import { fetchSeoCockpitData } from '@/server/seo/cockpit';
import { fetchUrlInspectionDashboardData } from '@/server/seo/url-inspection';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    range?: string | string[];
    priority?: string | string[];
    family?: string | string[];
    intent?: string | string[];
  }>;
};

const RANGE_OPTIONS: Array<{ value: GscRangeKey; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '28d', label: '28 days' },
  { value: '3m', label: '3 months' },
];

const priorityOptions: Array<SeoActionPriority | 'all'> = ['all', 'critical', 'high', 'medium', 'low'];
const numberFormatter = new Intl.NumberFormat('en-US');
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default async function AdminSeoPageActionsPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const range = normalizeGscRange(firstParam(searchParams?.range));
  const selectedPriority = normalizePriority(firstParam(searchParams?.priority));
  const selectedFamily = firstParam(searchParams?.family) ?? 'all';
  const selectedIntent = firstParam(searchParams?.intent) ?? 'all';
  const [data, urlInspection] = await Promise.all([
    fetchSeoCockpitData({ range }),
    fetchUrlInspectionDashboardData({ range }),
  ]);
  const briefs = buildUnifiedActionBriefs({
    opportunities: data.opportunities,
    ctrDoctorItems: data.ctrDoctorItems,
    missingContentItems: data.missingContentItems,
    internalLinkSuggestions: data.internalLinkSuggestions,
    momentumItems: data.momentumItems,
    urlInspectionItems: urlInspection.items,
  });
  const filteredBriefs = briefs.filter((brief) => {
    if (selectedPriority !== 'all' && brief.priority !== selectedPriority) return false;
    if (selectedFamily !== 'all' && brief.family !== selectedFamily) return false;
    if (selectedIntent !== 'all' && brief.intent !== selectedIntent) return false;
    return true;
  });
  const cacheSummary = data.gsc.fetchedAt
    ? `Last refreshed at ${dateTimeFormatter.format(new Date(data.gsc.fetchedAt))}.`
    : 'No refreshed GSC snapshot yet.';

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="SEO"
        title="Recommended Page Actions"
        description="Unified Codex-ready page briefs grouped by target page, query cluster, family, and intent."
        actions={
          <>
            <RangeTabs current={range} />
            <AdminActionLink href={`/admin/seo/cockpit?range=${range}`} prefetch={false}>
              Cockpit
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/actions?range=${range}`} prefetch={false}>
              Action queue
            </AdminActionLink>
            <AdminActionLink href={`/api/admin/seo/actions/export?range=${range}`} prefetch={false}>
              <Download className="h-4 w-4" />
              Export
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
        title="Filters"
        description={`${numberFormatter.format(filteredBriefs.length)} of ${numberFormatter.format(briefs.length)} unified page briefs visible. ${cacheSummary}`}
        action={<span className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary"><Filter className="h-3.5 w-3.5" /> Unified signals</span>}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <FilterGroup title="Priority" items={priorityOptions.map((value) => ({ value, label: labelize(value) }))} active={selectedPriority} range={range} param="priority" />
          <FilterGroup title="Family" items={buildFilterItems(briefs.map((brief) => brief.family))} active={selectedFamily} range={range} param="family" />
          <FilterGroup title="Intent" items={buildFilterItems(briefs.map((brief) => brief.intent), compactIntentLabel)} active={selectedIntent} range={range} param="intent" />
        </div>
      </AdminSection>

      <AdminSection
        title="Page Action Briefs"
        description="Each brief merges supporting module signals into one scoped implementation request."
      >
        {filteredBriefs.length ? (
          <div className="space-y-4">
            {filteredBriefs.map((brief) => (
              <BriefDetails key={brief.id} brief={brief} />
            ))}
          </div>
        ) : (
          <AdminEmptyState>
            <p className="font-semibold text-text-primary">No briefs match the filters</p>
            <p className="mt-1">Clear one or more filters or refresh GSC data manually when you need a newer snapshot.</p>
          </AdminEmptyState>
        )}
      </AdminSection>
    </div>
  );
}

function BriefDetails({ brief }: { brief: UnifiedPageActionBrief }) {
  return (
    <details className="group rounded-2xl border border-hairline bg-bg/60 p-4" open={brief.priority === 'critical' || brief.priority === 'high'}>
      <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={brief.priority} />
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{brief.family}</span>
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{compactIntentLabel(brief.intent)}</span>
            {brief.pageStatus ? (
              <span className="rounded-full border border-success/25 bg-success-bg px-2 py-1 text-[11px] font-semibold text-success">{labelizeUrlInspectionStatus(brief.pageStatus)}</span>
            ) : null}
          </div>
          <h2 className="mt-3 text-sm font-semibold leading-6 text-text-primary">{brief.queryCluster}</h2>
          <p className="mt-1 text-xs text-text-secondary">{brief.metricsSummary}</p>
        </div>
        <div className="flex items-center gap-2">
          <SeoCopyButton value={brief.copyReadyCodexTask} />
          <span className="inline-flex min-h-[34px] items-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-secondary group-open:hidden">Expand</span>
          <span className="hidden min-h-[34px] items-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-secondary group-open:inline-flex">Collapse</span>
        </div>
      </summary>
      <div className="mt-4 grid gap-4 border-t border-hairline pt-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Copy-ready task</p>
          <pre className="mt-3 max-h-[560px] overflow-auto rounded-2xl border border-hairline bg-surface p-4 text-xs leading-6 text-text-secondary whitespace-pre-wrap">
            {brief.copyReadyCodexTask}
          </pre>
        </div>
        <aside className="space-y-4">
          <InfoBlock title="Target">
            <a href={brief.targetUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
              <span className="truncate">{brief.targetUrl}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          </InfoBlock>
          <InfoBlock title="Signal badges">
            <div className="flex flex-wrap gap-2">
              {brief.sourceModules.map((module) => (
                <span key={module} className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
                  {module.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </InfoBlock>
          <InfoBlock title="Supporting actions">
            <ul className="space-y-2 text-sm text-text-secondary">
              {brief.supportingActions.slice(0, 5).map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </InfoBlock>
        </aside>
      </div>
    </details>
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
  param: 'priority' | 'family' | 'intent';
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
          href={`/admin/seo/page-actions?range=${option.value}`}
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

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
      <div className="mt-2">{children}</div>
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
      .sort()
      .map((value) => ({ value, label: labeler(value) })),
  ];
}

function buildFilteredHref(range: GscRangeKey, param: string, value: string) {
  const params = new URLSearchParams({ range });
  if (value !== 'all') params.set(param, value);
  return `/admin/seo/page-actions?${params.toString()}`;
}

function normalizePriority(value?: string | null): SeoActionPriority | 'all' {
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') return value;
  return 'all';
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function labelize(value: string) {
  if (value === 'all') return 'All';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
