import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  CircleGauge,
  ExternalLink,
  MousePointerClick,
  Search,
  TrendingUp,
} from 'lucide-react';
import { GscRefreshButton } from '@/components/admin/GscRefreshButton';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { normalizeGscRange, type GscOpportunity, type GscPerformanceRow, type GscRangeKey } from '@/lib/seo/gsc-analysis';
import { fetchGscDashboardData, type GscDashboardData, type GscFamilySummary, type GscTrendPoint } from '@/server/seo/gsc';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    range?: string | string[];
  }>;
};

const RANGE_OPTIONS: Array<{ value: GscRangeKey; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '28d', label: '28 days' },
  { value: '3m', label: '3 months' },
];

const numberFormatter = new Intl.NumberFormat('en-US');
const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
const precisePercentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const positionFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default async function AdminGscSeoPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const range = normalizeGscRange(Array.isArray(searchParams?.range) ? searchParams?.range[0] : searchParams?.range);
  const data = await fetchGscDashboardData({ range });
  const metrics = buildMetricItems(data);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="SEO"
        title="Raw GSC dashboard"
        description="Search Console diagnostics, raw query/page rows, and refresh status for the strategic SEO cockpit."
        actions={
          <>
            <RangeTabs current={range} />
            <GscRefreshButton range={range} />
            <AdminActionLink href={`/admin/seo/cockpit?range=${range}`} prefetch={false}>
              Cockpit
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/actions?range=${range}`} prefetch={false}>
              Actions
            </AdminActionLink>
            <AdminActionLink href="/sitemap.xml" prefetch={false}>
              Sitemap index
            </AdminActionLink>
          </>
        }
      />

      {data.error ? (
        <AdminNotice tone={data.configured ? 'warning' : 'info'}>
          {data.error}
          {data.fetchedAt ? ' Showing the latest cached snapshot.' : ''}
        </AdminNotice>
      ) : null}

      <AdminSection
        title="Overview"
        description={`${data.windows.current.startDate} to ${data.windows.current.endDate}, compared with ${data.windows.previous.startDate} to ${data.windows.previous.endDate}.`}
        action={<SnapshotMeta data={data} />}
      >
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-6" density="compact" />
      </AdminSection>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)]">
        <AdminSection
          title="Trend"
          description="Daily click and impression movement for the selected window."
        >
          {data.trend.length ? <TrendPanel trend={data.trend} /> : <EmptyPanel message="No trend rows returned by Search Console yet." />}
        </AdminSection>

        <AdminSection
          title="Family clusters"
          description="Query and URL clusters aligned to MaxVideoAI engine families and search intents."
        >
          {data.familySummaries.length ? (
            <FamilyClusterList families={data.familySummaries} />
          ) : (
            <EmptyPanel message="No family cluster data available." />
          )}
        </AdminSection>
      </section>

      <AdminSection
        title="Opportunities"
        description="Raw Phase 1 opportunity rows kept for diagnostics. Use the SEO cockpit and action queue for strategic Codex-ready tasks."
      >
        {data.opportunities.length ? (
          <OpportunitiesTable opportunities={data.opportunities.slice(0, 20)} />
        ) : (
          <EmptyPanel message="No opportunities detected yet. Refresh after GSC credentials are configured or expand the date range." />
        )}
      </AdminSection>

      <section className="grid gap-5 xl:grid-cols-2">
        <AdminSection title="Top queries" description="Query-first view, aggregated across pages, countries, and devices.">
          <PerformanceTable rows={data.topQueries.slice(0, 12)} primary="query" />
        </AdminSection>
        <AdminSection title="Top landing pages" description="Page-first view, aggregated across queries, countries, and devices.">
          <PerformanceTable rows={data.topPages.slice(0, 12)} primary="page" />
        </AdminSection>
      </section>
    </div>
  );
}

function RangeTabs({ current }: { current: GscRangeKey }) {
  return (
    <div className="inline-flex rounded-lg border border-hairline bg-bg p-1">
      {RANGE_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={`/admin/seo/gsc?range=${option.value}`}
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

function SnapshotMeta({ data }: { data: GscDashboardData }) {
  const details = [
    data.siteUrl ? `Property: ${data.siteUrl}` : 'Property not configured',
    data.fetchedAt ? `Last refreshed: ${dateTimeFormatter.format(new Date(data.fetchedAt))}` : 'No refreshed snapshot',
    data.cacheAgeSeconds !== null ? `Cache age: ${formatDuration(data.cacheAgeSeconds)}` : null,
    data.metadata.firstIncompleteDate ? `First incomplete date: ${data.metadata.firstIncompleteDate}` : null,
  ].filter(Boolean);

  return (
    <div className="text-right text-xs text-text-secondary">
      {details.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

function buildMetricItems(data: GscDashboardData): AdminMetricItem[] {
  return [
    {
      label: 'Clicks',
      value: numberFormatter.format(data.summary.clicks),
      helper: formatDelta(data.summary.clicksDelta, 'number'),
      tone: data.summary.clicksDelta >= 0 ? 'success' : 'warning',
      icon: MousePointerClick,
    },
    {
      label: 'Impressions',
      value: compactFormatter.format(data.summary.impressions),
      helper: formatDelta(data.summary.impressionsDelta, 'number'),
      tone: data.summary.impressionsDelta >= 0 ? 'success' : 'warning',
      icon: BarChart3,
    },
    {
      label: 'CTR',
      value: precisePercentFormatter.format(data.summary.ctr),
      helper: formatDelta(data.summary.ctrDelta, 'percent'),
      tone: data.summary.ctrDelta >= 0 ? 'success' : 'warning',
      icon: CircleGauge,
    },
    {
      label: 'Avg position',
      value: positionFormatter.format(data.summary.position),
      helper: `${data.summary.positionDelta <= 0 ? 'Better' : 'Worse'} ${positionFormatter.format(Math.abs(data.summary.positionDelta))}`,
      tone: data.summary.positionDelta <= 0 ? 'success' : 'warning',
      icon: TrendingUp,
    },
    {
      label: 'Opportunities',
      value: numberFormatter.format(data.opportunities.length),
      helper: `${data.opportunities.filter((item) => item.priority === 'P1').length} urgent`,
      tone: data.opportunities.some((item) => item.priority === 'P1') ? 'warning' : 'default',
      icon: AlertTriangle,
    },
    {
      label: 'Visible detail clicks',
      value: numberFormatter.format(data.detailSummary.clicks),
      helper: `${formatShare(data.detailSummary.clicks, data.summary.clicks)} of total`,
      tone: 'info',
      icon: MousePointerClick,
    },
    {
      label: 'Detail rows',
      value: numberFormatter.format(data.rows.length),
      helper: 'Visible query/page rows, not total',
      tone: 'info',
      icon: Search,
    },
  ];
}

function TrendPanel({ trend }: { trend: GscTrendPoint[] }) {
  const maxImpressions = Math.max(...trend.map((point) => point.impressions), 1);
  const maxClicks = Math.max(...trend.map((point) => point.clicks), 1);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-hairline bg-bg/50 px-4 py-4">
        <div className="mb-4 flex items-center justify-between text-xs text-text-secondary">
          <span>Peak {compactFormatter.format(maxImpressions)} impressions</span>
          <span>Peak {numberFormatter.format(maxClicks)} clicks</span>
        </div>
        <div className="max-h-56 space-y-2 overflow-auto pr-1">
          {trend.map((point) => {
            const impressionWidth = `${Math.max(2, (point.impressions / maxImpressions) * 100)}%`;
            const clickWidth = `${Math.max(2, (point.clicks / maxClicks) * 100)}%`;
            return (
              <div key={point.date} className="grid gap-2 sm:grid-cols-[72px_minmax(0,1fr)_96px]" title={`${point.date}: ${point.clicks} clicks, ${point.impressions} impressions`}>
                <p className="text-xs font-semibold text-text-secondary">{dateFormatter.format(new Date(point.date))}</p>
                <div className="min-w-0 space-y-1.5">
                  <div className="h-2 rounded-full bg-surface-2">
                    <div className="h-2 rounded-full bg-slate-950" style={{ width: impressionWidth }} />
                  </div>
                  <div className="h-2 rounded-full bg-surface-2">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: clickWidth }} />
                  </div>
                </div>
                <p className="text-right text-xs text-text-secondary">
                  {compactFormatter.format(point.impressions)} · {numberFormatter.format(point.clicks)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded bg-slate-950" /> Impressions</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded bg-emerald-500" /> Clicks</span>
        <span>{dateFormatter.format(new Date(trend[0]?.date ?? Date.now()))} - {dateFormatter.format(new Date(trend.at(-1)?.date ?? Date.now()))}</span>
      </div>
    </div>
  );
}

function FamilyClusterList({ families }: { families: GscFamilySummary[] }) {
  const maxImpressions = Math.max(...families.map((family) => family.impressions), 1);
  return (
    <div className="space-y-3">
      {families.slice(0, 10).map((family) => (
        <div key={family.family} className="rounded-2xl border border-hairline bg-bg/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{family.family}</p>
              <p className="mt-1 text-xs text-text-secondary">
                {compactFormatter.format(family.impressions)} impressions · {numberFormatter.format(family.clicks)} clicks · {precisePercentFormatter.format(family.ctr)}
              </p>
            </div>
            <span className="text-xs font-semibold text-text-muted">#{family.rows}</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-surface-2">
            <div
              className="h-1.5 rounded-full bg-brand"
              style={{ width: `${Math.max(4, (family.impressions / maxImpressions) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function OpportunitiesTable({ opportunities }: { opportunities: GscOpportunity[] }) {
  return (
    <AdminDataTable viewportClassName="max-h-[68vh] overflow-auto">
      <thead className="sticky top-0 z-10 bg-surface">
        <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
          <th className="px-4 py-3 font-semibold">Priority</th>
          <th className="px-4 py-3 font-semibold">Issue</th>
          <th className="px-4 py-3 font-semibold">Query / page</th>
          <th className="px-4 py-3 font-semibold">Metrics</th>
          <th className="px-4 py-3 font-semibold">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline bg-bg/30">
        {opportunities.map((opportunity) => (
          <tr key={opportunity.id} className="align-top">
            <td className="px-4 py-4">
              <span className={priorityClass(opportunity.priority)}>{opportunity.priority}</span>
            </td>
            <td className="px-4 py-4">
              <p className="text-sm font-semibold text-text-primary">{humanizeIssue(opportunity.issueType)}</p>
              <p className="mt-1 text-xs text-text-secondary">{opportunity.family} · {opportunity.intent}</p>
            </td>
            <td className="max-w-[32rem] px-4 py-4">
              <p className="font-medium text-text-primary">{opportunity.query ?? 'No query dimension'}</p>
              {opportunity.page ? (
                <a href={opportunity.page} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-text-secondary hover:text-text-primary">
                  <span className="truncate">{stripOrigin(opportunity.page)}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : null}
            </td>
            <td className="px-4 py-4 text-sm text-text-secondary">
              <p>{numberFormatter.format(opportunity.clicks)} clicks</p>
              <p>{compactFormatter.format(opportunity.impressions)} impressions</p>
              <p>{precisePercentFormatter.format(opportunity.ctr)} CTR · pos {positionFormatter.format(opportunity.position)}</p>
            </td>
            <td className="max-w-[24rem] px-4 py-4 text-sm text-text-secondary">{opportunity.suggestedAction}</td>
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}

function PerformanceTable({ rows, primary }: { rows: GscPerformanceRow[]; primary: 'query' | 'page' }) {
  if (!rows.length) {
    return <EmptyPanel message="No rows returned for this view." />;
  }

  return (
    <AdminDataTable>
      <thead>
        <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
          <th className="px-4 py-3 font-semibold">{primary === 'query' ? 'Query' : 'Page'}</th>
          <th className="px-4 py-3 font-semibold">Clicks</th>
          <th className="px-4 py-3 font-semibold">Impr.</th>
          <th className="px-4 py-3 font-semibold">CTR</th>
          <th className="px-4 py-3 font-semibold">Pos.</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline bg-bg/30">
        {rows.map((row) => {
          const label = primary === 'query' ? row.query : row.page;
          return (
            <tr key={label ?? `${row.clicks}-${row.impressions}`}>
              <td className="max-w-[30rem] truncate px-4 py-3 text-sm font-medium text-text-primary">
                {primary === 'page' && label ? stripOrigin(label) : label}
              </td>
              <td className="px-4 py-3 text-sm text-text-secondary">{numberFormatter.format(row.clicks)}</td>
              <td className="px-4 py-3 text-sm text-text-secondary">{compactFormatter.format(row.impressions)}</td>
              <td className="px-4 py-3 text-sm text-text-secondary">{precisePercentFormatter.format(row.ctr)}</td>
              <td className="px-4 py-3 text-sm text-text-secondary">{positionFormatter.format(row.position)}</td>
            </tr>
          );
        })}
      </tbody>
    </AdminDataTable>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <AdminEmptyState>
      <p className="font-semibold text-text-primary">No GSC data</p>
      <p className="mt-1">{message}</p>
    </AdminEmptyState>
  );
}

function formatDelta(value: number, kind: 'number' | 'percent') {
  const sign = value > 0 ? '+' : '';
  if (kind === 'percent') {
    return `${sign}${percentFormatter.format(value)} vs previous`;
  }
  return `${sign}${compactFormatter.format(value)} vs previous`;
}

function formatShare(part: number, total: number) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return '0%';
  return percentFormatter.format(Math.max(0, Math.min(1, part / total)));
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function priorityClass(priority: GscOpportunity['priority']) {
  const base = 'inline-flex rounded-full border px-2 py-1 text-xs font-semibold';
  if (priority === 'P1') return `${base} border-warning-border bg-warning-bg text-warning`;
  if (priority === 'P2') return `${base} border-info/25 bg-info/10 text-info`;
  return `${base} border-hairline bg-surface-2 text-text-secondary`;
}

function humanizeIssue(issueType: GscOpportunity['issueType']) {
  return issueType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stripOrigin(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}
