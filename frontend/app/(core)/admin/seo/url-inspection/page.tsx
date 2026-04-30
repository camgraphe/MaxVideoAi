import Link from 'next/link';
import type { ReactNode } from 'react';
import { ExternalLink, Filter, SearchCheck } from 'lucide-react';
import { UrlInspectionButton } from '@/components/admin/UrlInspectionButton';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { normalizeGscRange, type GscRangeKey } from '@/lib/seo/gsc-analysis';
import type { UrlInspectionGroup, UrlInspectionItem, UrlInspectionSeverity, UrlInspectionStatus } from '@/lib/seo/internal-seo-types';
import { labelizeUrlInspectionGroup, labelizeUrlInspectionStatus, shouldSkipRecentUrlInspection } from '@/lib/seo/url-inspection';
import { fetchUrlInspectionDashboardData } from '@/server/seo/url-inspection';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: {
    range?: string | string[];
    group?: string | string[];
    status?: string | string[];
    severity?: string | string[];
  };
};

const RANGE_OPTIONS: Array<{ value: GscRangeKey; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '28d', label: '28 days' },
  { value: '3m', label: '3 months' },
];
const statusOptions: Array<UrlInspectionStatus | 'all'> = [
  'all',
  'indexed_ok',
  'indexed_canonical_mismatch',
  'not_indexed',
  'discovered_not_indexed',
  'crawled_not_indexed',
  'blocked_by_robots',
  'noindex',
  'redirect',
  'not_found',
  'server_error',
  'unknown',
];
const severityOptions: Array<UrlInspectionSeverity | 'all'> = ['all', 'critical', 'warning', 'info', 'ok', 'unknown'];
const numberFormatter = new Intl.NumberFormat('en-US');
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default async function AdminSeoUrlInspectionPage({ searchParams }: PageProps) {
  const range = normalizeGscRange(firstParam(searchParams?.range));
  const selectedGroup = normalizeGroup(firstParam(searchParams?.group));
  const selectedStatus = normalizeStatus(firstParam(searchParams?.status));
  const selectedSeverity = normalizeSeverity(firstParam(searchParams?.severity));
  const data = await fetchUrlInspectionDashboardData({ range });
  const items = data.items.filter((item) => {
    if (selectedGroup !== 'all' && item.group !== selectedGroup) return false;
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
    if (selectedSeverity !== 'all' && item.severity !== selectedSeverity) return false;
    return true;
  });
  const uninspectedCount = data.items.filter((item) => !shouldSkipRecentUrlInspection(item.lastInspectedAt)).length;
  const groupItems = selectedGroup === 'all' ? data.items : data.items.filter((item) => item.group === selectedGroup);
  const groupCallCount = groupItems.filter((item) => !shouldSkipRecentUrlInspection(item.lastInspectedAt)).length;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="SEO"
        title="URL Inspection"
        description="Manual-only Google URL Inspection for a curated set of MaxVideoAI priority pages. No sitemap scan, no auto-refresh."
        actions={
          <>
            <RangeTabs current={range} />
            <AdminActionLink href={`/admin/seo/cockpit?range=${range}`} prefetch={false}>
              Cockpit
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/gsc?range=${range}`} prefetch={false}>
              Raw GSC
            </AdminActionLink>
          </>
        }
      />

      {data.error ? <AdminNotice tone="info">{data.error}</AdminNotice> : null}

      <AdminSection
        title="Manual Inspection Controls"
        description={`${numberFormatter.format(data.items.length)} curated URLs. ${data.updatedAt ? `Last inspection cache update ${dateTimeFormatter.format(new Date(data.updatedAt))}.` : 'No URL inspection cache yet.'}`}
        action={<span className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary"><SearchCheck className="h-3.5 w-3.5" /> Manual only</span>}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <ControlCard title="Inspect all curated URLs" body="Runs only the current curated list. Recently inspected URLs are skipped unless forced later.">
            <UrlInspectionButton range={range} group="all" label="Inspect all curated" estimatedCalls={uninspectedCount} />
          </ControlCard>
          <ControlCard title="Inspect selected group" body={selectedGroup === 'all' ? 'Choose a group filter first, or inspect all curated URLs.' : `Selected group: ${labelizeUrlInspectionGroup(selectedGroup)}`}>
            <UrlInspectionButton range={range} group={selectedGroup} label="Inspect group" estimatedCalls={selectedGroup === 'all' ? 0 : groupCallCount} />
          </ControlCard>
          <ControlCard title="Estimated calls" body="Each URL Inspection API request inspects one URL. This module never inspects sitemap-wide URLs.">
            <p className="text-2xl font-semibold text-text-primary">{numberFormatter.format(uninspectedCount)}</p>
            <p className="mt-1 text-xs text-text-secondary">eligible calls right now</p>
          </ControlCard>
        </div>
      </AdminSection>

      <AdminSection
        title="Filters"
        description={`${numberFormatter.format(items.length)} of ${numberFormatter.format(data.items.length)} curated URLs visible.`}
        action={<span className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary"><Filter className="h-3.5 w-3.5" /> Protected admin data</span>}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <FilterGroup title="Group" items={buildFilterItems(data.items.map((item) => item.group), labelizeUrlInspectionGroup)} active={selectedGroup} range={range} param="group" />
          <FilterGroup title="Status" items={statusOptions.map((value) => ({ value, label: value === 'all' ? 'All' : labelizeUrlInspectionStatus(value) }))} active={selectedStatus} range={range} param="status" compact />
          <FilterGroup title="Severity" items={severityOptions.map((value) => ({ value, label: labelize(value) }))} active={selectedSeverity} range={range} param="severity" />
        </div>
      </AdminSection>

      <AdminSection
        title="Curated URL Cards"
        description="Each card shows cached URL Inspection results when available, plus a manual inspect action for that specific URL."
      >
        {items.length ? (
          <div className="grid gap-4">
            {items.map((item) => (
              <InspectionCard key={item.path} item={item} range={range} />
            ))}
          </div>
        ) : (
          <AdminEmptyState>
            <p className="font-semibold text-text-primary">No curated URLs match the filters</p>
            <p className="mt-1">Clear filters or inspect the curated list manually.</p>
          </AdminEmptyState>
        )}
      </AdminSection>
    </div>
  );
}

function InspectionCard({ item, range }: { item: UrlInspectionItem; range: GscRangeKey }) {
  const needsInspection = !shouldSkipRecentUrlInspection(item.lastInspectedAt);
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={item.status} />
            <SeverityPill severity={item.severity} />
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
              {labelizeUrlInspectionGroup(item.group)}
            </span>
            {item.sources.map((source) => (
              <span key={source} className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
                {labelize(source)}
              </span>
            ))}
          </div>
          <h2 className="mt-3 text-base font-semibold leading-6 text-text-primary">{item.path}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{item.suggestedAction}</p>
        </div>
        <UrlInspectionButton
          range={range}
          urls={[item.path]}
          label={needsInspection ? 'Inspect URL' : 'Force inspect'}
          estimatedCalls={1}
          force={!needsInspection}
        />
      </div>

      <div className="mt-4 grid gap-4 border-t border-hairline pt-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoTile title="Last inspected" body={item.lastInspectedAt ? dateTimeFormatter.format(new Date(item.lastInspectedAt)) : 'Not inspected yet'} />
          <InfoTile title="Last crawl" body={item.lastCrawlTime ? dateTimeFormatter.format(new Date(item.lastCrawlTime)) : 'Unknown'} />
          <InfoTile title="Google canonical" body={item.googleCanonical ?? 'Unknown'} />
          <InfoTile title="User canonical" body={item.userCanonical ?? 'Unknown'} />
          <InfoTile title="Coverage" body={item.coverageState ?? 'Unknown'} />
          <InfoTile title="Fetch / robots" body={[item.pageFetchState, item.robotsTxtState].filter(Boolean).join(' · ') || 'Unknown'} />
        </div>
        <aside className="space-y-3">
          <InfoBlock title="Signals">
            <ul className="space-y-1 text-sm text-text-secondary">
              <li>Canonical: {item.canonicalMatches === null ? 'Unknown' : item.canonicalMatches ? 'Matches' : 'Mismatch'}</li>
              <li>Sitemap: {item.sitemapPresent === null ? 'Unknown' : item.sitemapPresent ? 'Present' : 'Not reported'}</li>
              <li>Mobile usability: {item.mobileUsabilityStatus ?? 'Not reported'}</li>
              <li>Rich results: {item.richResultsStatus ?? 'Not reported'}{item.richResultTypes.length ? ` (${item.richResultTypes.join(', ')})` : ''}</li>
            </ul>
          </InfoBlock>
          <InfoBlock title="URL">
            <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
              <span className="truncate">{item.url}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          </InfoBlock>
        </aside>
      </div>
    </article>
  );
}

function ControlCard({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function InfoTile({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-hairline bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
      <p className="mt-2 truncate text-sm text-text-secondary">{body}</p>
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

function StatusPill({ status }: { status: UrlInspectionStatus }) {
  const base = 'inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]';
  if (status === 'indexed_ok') return <span className={`${base} border-success/25 bg-success-bg text-success`}>Indexed</span>;
  if (status === 'unknown') return <span className={`${base} border-hairline bg-surface text-text-muted`}>Unknown</span>;
  if (status === 'indexed_canonical_mismatch' || status === 'discovered_not_indexed' || status === 'crawled_not_indexed' || status === 'redirect') {
    return <span className={`${base} border-warning-border bg-warning-bg text-warning`}>{labelizeUrlInspectionStatus(status)}</span>;
  }
  return <span className={`${base} border-warning-border bg-warning-bg text-warning`}>{labelizeUrlInspectionStatus(status)}</span>;
}

function SeverityPill({ severity }: { severity: UrlInspectionSeverity }) {
  const base = 'inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]';
  if (severity === 'ok') return <span className={`${base} border-success/25 bg-success-bg text-success`}>OK</span>;
  if (severity === 'warning') return <span className={`${base} border-warning-border bg-warning-bg text-warning`}>Warning</span>;
  if (severity === 'critical') return <span className={`${base} border-warning-border bg-warning-bg text-warning`}>Critical</span>;
  return <span className={`${base} border-hairline bg-surface text-text-muted`}>{labelize(severity)}</span>;
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
  param: 'group' | 'status' | 'severity';
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
          href={`/admin/seo/url-inspection?range=${option.value}`}
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

function buildFilterItems<T extends string>(values: T[], labeler: (value: T) => string = labelize) {
  return [
    { value: 'all', label: 'All' },
    ...Array.from(new Set(values)).sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: labeler(value) })),
  ];
}

function buildFilteredHref(range: GscRangeKey, param: 'group' | 'status' | 'severity', value: string) {
  const params = new URLSearchParams({ range });
  if (value !== 'all') params.set(param, value);
  return `/admin/seo/url-inspection?${params.toString()}`;
}

function normalizeGroup(value?: string | null): UrlInspectionGroup | 'all' {
  const groups: Array<UrlInspectionGroup | 'all'> = ['all', 'core', 'strategic-models', 'examples', 'comparisons', 'opportunities', 'manual'];
  return groups.includes(value as UrlInspectionGroup | 'all') ? (value as UrlInspectionGroup | 'all') : 'all';
}

function normalizeStatus(value?: string | null): UrlInspectionStatus | 'all' {
  return statusOptions.includes(value as UrlInspectionStatus | 'all') ? (value as UrlInspectionStatus | 'all') : 'all';
}

function normalizeSeverity(value?: string | null): UrlInspectionSeverity | 'all' {
  return severityOptions.includes(value as UrlInspectionSeverity | 'all') ? (value as UrlInspectionSeverity | 'all') : 'all';
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function labelize(value: string) {
  return value.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
