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
import type { CodexSeoAction, SeoActionPriority } from '@/lib/seo/internal-seo-types';
import { compactIntentLabel } from '@/lib/seo/seo-intents';
import { stripOrigin } from '@/lib/seo/seo-opportunity-engine';
import { fetchSeoCockpitData } from '@/server/seo/cockpit';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    range?: string | string[];
    priority?: string | string[];
    family?: string | string[];
    intent?: string | string[];
    issueType?: string | string[];
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

export default async function AdminSeoActionsPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const range = normalizeGscRange(firstParam(searchParams?.range));
  const selectedPriority = normalizePriority(firstParam(searchParams?.priority));
  const selectedFamily = firstParam(searchParams?.family) ?? 'all';
  const selectedIntent = firstParam(searchParams?.intent) ?? 'all';
  const selectedIssueType = firstParam(searchParams?.issueType) ?? 'all';
  const data = await fetchSeoCockpitData({ range });
  const filteredActions = data.actions.filter((action) => {
    if (selectedPriority !== 'all' && action.priority !== selectedPriority) return false;
    if (selectedFamily !== 'all' && action.family !== selectedFamily) return false;
    if (selectedIntent !== 'all' && action.intent !== selectedIntent) return false;
    if (selectedIssueType !== 'all' && action.issueType !== selectedIssueType) return false;
    return true;
  });
  const cacheSummary = data.gsc.fetchedAt
    ? `Last refreshed at ${dateTimeFormatter.format(new Date(data.gsc.fetchedAt))}.`
    : 'No refreshed GSC snapshot yet.';

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="SEO"
        title="Codex Action Queue"
        description="Copy-ready implementation briefs generated from MaxVideoAI Search Console opportunity clusters."
        actions={
          <>
            <RangeTabs current={range} />
            <AdminActionLink href={`/admin/seo/cockpit?range=${range}`} prefetch={false}>
              Cockpit
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/gsc?range=${range}`} prefetch={false}>
              Raw GSC
            </AdminActionLink>
            <AdminActionLink href={`/api/admin/seo/actions/export?range=${range}`} prefetch={false}>
              <Download className="h-4 w-4" />
              Markdown
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
        description={`${numberFormatter.format(filteredActions.length)} of ${numberFormatter.format(data.actions.length)} generated actions visible. ${cacheSummary}`}
        action={<span className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary"><Filter className="h-3.5 w-3.5" /> Phase 2A queue</span>}
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <FilterGroup title="Priority" items={priorityOptions.map((value) => ({ value, label: labelize(value) }))} active={selectedPriority} range={range} param="priority" />
          <FilterGroup title="Family" items={buildFilterItems(data.actions.map((action) => action.family))} active={selectedFamily} range={range} param="family" />
          <FilterGroup title="Intent" items={buildFilterItems(data.actions.map((action) => action.intent), compactIntentLabel)} active={selectedIntent} range={range} param="intent" />
          <FilterGroup title="Issue" items={buildFilterItems(data.actions.map((action) => action.issueType), labelize)} active={selectedIssueType} range={range} param="issueType" />
        </div>
      </AdminSection>

      <AdminSection
        title="Action Briefs"
        description="Each item is formatted so it can be pasted directly into Codex as a scoped implementation request."
      >
        {filteredActions.length ? (
          <div className="space-y-4">
            {filteredActions.map((action) => (
              <ActionDetails key={action.id} action={action} />
            ))}
          </div>
        ) : (
          <AdminEmptyState>
            <p className="font-semibold text-text-primary">No actions match the filters</p>
            <p className="mt-1">Clear one or more filters or expand the GSC date range.</p>
          </AdminEmptyState>
        )}
      </AdminSection>
    </div>
  );
}

function ActionDetails({ action }: { action: CodexSeoAction }) {
  return (
    <details className="group rounded-2xl border border-hairline bg-bg/60 p-4" open={action.priority === 'critical'}>
      <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={action.priority} />
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{action.family}</span>
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{compactIntentLabel(action.intent)}</span>
          </div>
          <h2 className="mt-3 text-sm font-semibold leading-6 text-text-primary">{action.title}</h2>
          <p className="mt-1 text-xs text-text-secondary">{action.metricsSummary}</p>
        </div>
        <div className="flex items-center gap-2">
          <SeoCopyButton value={action.markdown} />
          <span className="inline-flex min-h-[34px] items-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-secondary group-open:hidden">Expand</span>
          <span className="hidden min-h-[34px] items-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-secondary group-open:inline-flex">Collapse</span>
        </div>
      </summary>

      <div className="mt-4 grid gap-4 border-t border-hairline pt-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Copy-ready task</p>
          <pre className="mt-3 max-h-[560px] overflow-auto rounded-2xl border border-hairline bg-surface p-4 text-xs leading-6 text-text-secondary whitespace-pre-wrap">
            {action.markdown}
          </pre>
        </div>
        <aside className="space-y-4">
          <InfoBlock title="Target">
            {action.targetUrl ? (
              <a href={action.targetUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
                <span className="truncate">{stripOrigin(action.targetUrl)}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : (
              <span className="text-sm text-text-secondary">No target URL</span>
            )}
          </InfoBlock>
          <InfoBlock title="Query cluster">
            <p className="text-sm font-semibold text-text-primary">{action.queryCluster}</p>
            <ul className="mt-2 space-y-1 text-sm text-text-secondary">
              {action.representativeQueries.map((query) => (
                <li key={query}>{query}</li>
              ))}
            </ul>
          </InfoBlock>
          <InfoBlock title="Likely files">
            <ul className="space-y-1 text-sm text-text-secondary">
              {action.likelyFilesToInspect.map((file) => (
                <li key={file} className="break-all">{file}</li>
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
  param: 'priority' | 'family' | 'intent' | 'issueType';
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
          href={`/admin/seo/actions?range=${option.value}`}
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
  return `/admin/seo/actions?${params.toString()}`;
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
