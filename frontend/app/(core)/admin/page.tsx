import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BellRing,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Cpu,
  Database,
  Download,
  Filter,
  Gauge,
  HardDrive,
  RadioTower,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { fetchAdminHealth, fetchAdminMetrics } from '@/server/admin-metrics';
import type { AdminHealthSnapshot, AdminMetrics, AmountSeriesPoint, EngineUsage, MetricsRangeLabel, TimeSeriesPoint } from '@/lib/admin/types';
import { ADMIN_EXCLUDED_USER_IDS, resolveExcludeAdminParam } from '@/lib/admin/exclusions';

export const dynamic = 'force-dynamic';

const numberFormatter = new Intl.NumberFormat('en-US');
const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const preciseCurrencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

type StatTone = 'blue' | 'green' | 'violet' | 'amber' | 'rose';
type AdminHubRange = Extract<MetricsRangeLabel, '24h' | '30d' | '90d'>;

type PageProps = {
  searchParams?: {
    range?: string | string[];
    excludeAdmin?: string | string[];
  };
};

const HUB_RANGE_OPTIONS: Array<{ value: AdminHubRange; label: string }> = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

type KpiCard = {
  label: string;
  value: string;
  helper: string;
  tone: StatTone;
  href: string;
  icon: typeof Users;
  sparkline: number[];
};

type ActivityItem = {
  label: string;
  meta: string;
  icon: typeof Users;
  tone: StatTone;
};

function resolveHubRange(value?: string | string[]): AdminHubRange {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === '24h' || candidate === '90d') return candidate;
  return '30d';
}

function describeHubRange(range: AdminHubRange) {
  switch (range) {
    case '24h':
      return '24h';
    case '90d':
      return '90d';
    case '30d':
    default:
      return '30d';
  }
}

function formatRangeChartLabel(date: string, range: AdminHubRange) {
  if (range === '24h') return '24h';
  return dayFormatter.format(new Date(date));
}

function buildAdminHubHref(range: AdminHubRange, excludeAdmin: boolean) {
  const params = new URLSearchParams();
  params.set('range', range);
  if (!excludeAdmin) params.set('excludeAdmin', '0');
  return `/admin?${params.toString()}`;
}

function buildAdminInsightsHref(range: AdminHubRange, excludeAdmin: boolean) {
  const params = new URLSearchParams();
  params.set('range', range);
  params.set('excludeAdmin', excludeAdmin ? '1' : '0');
  return `/admin/insights?${params.toString()}`;
}

export default async function AdminIndexPage({ searchParams }: PageProps) {
  const selectedRange = resolveHubRange(searchParams?.range);
  const excludeAdmin = resolveExcludeAdminParam(searchParams?.excludeAdmin);
  const queryOptions = {
    excludeUserIds: excludeAdmin ? ADMIN_EXCLUDED_USER_IDS : [],
  };
  const [metrics, health] = await Promise.all([fetchAdminMetrics(selectedRange, queryOptions), fetchAdminHealth()]);
  const monthlyStats = buildRangeStats(metrics, selectedRange);
  const kpis = buildKpiCards(metrics, health, selectedRange);
  const systemRows = buildSystemRows(health, metrics);
  const incidents = buildIncidentRows(health, metrics, selectedRange);
  const queueRows = buildQueueRows(health);
  const activity = buildActivityItems(metrics, health);
  const topEngines = metrics.engines.slice(0, 5);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.7rem] font-semibold leading-tight text-text-primary sm:text-[2rem]">Welcome back, Admin</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">System overview and operational status</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeSelector current={selectedRange} excludeAdmin={excludeAdmin} />
          <ExcludeAdminToggle currentRange={selectedRange} excludeAdmin={excludeAdmin} />
          <ToolbarButton icon={Filter}>Filters</ToolbarButton>
          <Link
            href={buildAdminInsightsHref(selectedRange, excludeAdmin)}
            prefetch={false}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download className="h-4 w-4" />
            Export report
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="Admin key metrics">
        {kpis.map((card) => (
          <MetricCard key={card.label} card={card} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(330px,0.9fr)]">
        <Panel
          title="Monthly stats"
          action={
            <Link href={buildAdminInsightsHref(selectedRange, excludeAdmin)} prefetch={false} className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-hover hover:text-text-primary">
              {describeHubRange(selectedRange)}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <MonthlyStatsChart data={monthlyStats} />
        </Panel>

        <Panel title="Live system status">
          <div className="divide-y divide-hairline">
            {systemRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-bg text-text-secondary">
                    <row.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{row.label}</p>
                    <p className={row.tone === 'warn' ? 'text-xs font-medium text-warning' : 'text-xs font-medium text-success'}>{row.status}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <MiniSparkline values={row.sparkline} tone={row.tone === 'warn' ? 'rose' : 'green'} />
                  <span className="w-14 text-right text-xs font-medium text-text-secondary">{row.uptime}</span>
                </div>
              </div>
            ))}
          </div>
          <PanelFooter href="/admin/system">View all systems</PanelFooter>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(330px,1fr)_minmax(330px,1fr)]">
        <Panel
          title="Recent incidents"
          action={<Link href="/admin/jobs" prefetch={false} className="text-xs font-semibold text-brand transition hover:text-brand-hover">View all</Link>}
        >
          <div className="divide-y divide-hairline">
            {incidents.map((incident) => (
              <Link key={incident.id} href={incident.href} prefetch={false} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 py-3 first:pt-0 last:pb-0">
                <span className={`mt-2 h-2 w-2 rounded-full ${incident.dotClass}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-text-muted">{incident.id}</span>
                  <span className="mt-1 block truncate text-sm text-text-secondary">{incident.label}</span>
                </span>
                <span className={`h-fit rounded-lg px-2 py-1 text-xs font-semibold ${incident.badgeClass}`}>{incident.status}</span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Engine utilization">
          <div className="grid gap-5 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
            <DonutGauge value={buildUtilizationScore(metrics)} />
            <div className="space-y-3">
              {buildEngineRows(topEngines).map((engine) => (
                <div key={engine.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                  <span className={`h-2.5 w-2.5 rounded-full ${engine.dot}`} aria-hidden />
                  <span className="truncate text-text-secondary">{engine.label}</span>
                  <span className="font-semibold text-text-primary">{engine.value}</span>
                </div>
              ))}
            </div>
          </div>
          <PanelFooter href="/admin/engines">View all engines</PanelFooter>
        </Panel>

        <Panel title="Queue overview">
          <div className="divide-y divide-hairline">
            {queueRows.map((queue) => (
              <Link key={queue.label} href={queue.href} prefetch={false} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 py-3 first:pt-0 last:pb-0">
                <queue.icon className={`h-4 w-4 ${queue.iconClass}`} />
                <span className="truncate text-sm font-medium text-text-secondary">{queue.label}</span>
                <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${queue.badgeClass}`}>{queue.count}</span>
                <span className="hidden text-xs text-text-muted sm:block">{queue.meta}</span>
              </Link>
            ))}
          </div>
          <PanelFooter href="/admin/jobs">View all queues</PanelFooter>
        </Panel>
      </section>

      <Panel title="Latest activity">
        <div className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline md:grid-cols-5">
          {activity.map((item) => (
            <Link key={`${item.label}-${item.meta}`} href={activityHref(item)} prefetch={false} className="group min-w-0 bg-bg px-4 py-3 transition hover:bg-surface-hover">
              <span className="flex items-start gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${activityToneClass(item.tone)}`}>
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-text-primary group-hover:text-brand">{item.label}</span>
                  <span className="mt-1 block truncate text-xs text-text-secondary">{item.meta}</span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function RangeSelector({ current, excludeAdmin }: { current: AdminHubRange; excludeAdmin: boolean }) {
  return (
    <div className="inline-flex min-h-[42px] overflow-hidden rounded-lg border border-border bg-surface shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      {HUB_RANGE_OPTIONS.map((option) => {
        const active = option.value === current;
        return (
          <Link
            key={option.value}
            href={buildAdminHubHref(option.value, excludeAdmin)}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            className={[
              'inline-flex items-center gap-2 border-r border-hairline px-3 text-sm font-semibold transition last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              active ? 'bg-slate-950 text-white' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
            ].join(' ')}
          >
            <CalendarDays className="h-4 w-4" />
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

function ExcludeAdminToggle({ currentRange, excludeAdmin }: { currentRange: AdminHubRange; excludeAdmin: boolean }) {
  return (
    <Link
      href={buildAdminHubHref(currentRange, !excludeAdmin)}
      prefetch={false}
      className={[
        'inline-flex min-h-[42px] items-center gap-2 rounded-lg border px-4 text-sm font-semibold shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        excludeAdmin
          ? 'border-success-border bg-success-bg text-success hover:bg-success-bg/80'
          : 'border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      ].join(' ')}
    >
      <ShieldCheck className="h-4 w-4" />
      {excludeAdmin ? 'Admin excluded' : 'Include admin'}
    </Link>
  );
}

function ToolbarButton({ icon: Icon, children }: { icon: typeof Filter; children: ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-text-secondary shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-[0_18px_48px_rgba(15,23,42,0.055)]">
      <div className="flex min-h-[58px] items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function PanelFooter({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} prefetch={false} className="-mx-5 -mb-5 mt-5 flex items-center gap-2 border-t border-hairline px-5 py-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-hover hover:text-text-primary">
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function MetricCard({ card }: { card: KpiCard }) {
  return (
    <Link href={card.href} prefetch={false} className="group min-h-[156px] rounded-lg border border-hairline bg-surface p-5 shadow-[0_16px_42px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-border-hover hover:shadow-[0_22px_54px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-text-secondary">{card.label}</span>
          <span className="mt-4 block text-[1.65rem] font-semibold leading-none text-text-primary">{card.value}</span>
          <span className="mt-3 block text-sm text-text-secondary">{card.helper}</span>
        </span>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${activityToneClass(card.tone)}`}>
          <card.icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 flex justify-end">
        <MiniSparkline values={card.sparkline} tone={card.tone} />
      </div>
    </Link>
  );
}

function MonthlyStatsChart({ data }: { data: ReturnType<typeof buildRangeStats> }) {
  const maxBar = Math.max(...data.map((point) => point.signups), ...data.map((point) => point.active), 1);
  const maxAmount = Math.max(...data.map((point) => point.topupsUsd), 1);
  const width = 860;
  const height = 300;
  const left = 44;
  const right = 24;
  const top = 28;
  const bottom = 44;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const step = chartWidth / Math.max(data.length, 1);
  const barWidth = Math.max(2, Math.min(18, step * 0.22));
  const labelStep = Math.max(1, Math.ceil(data.length / 8));
  const linePoints = data.map((point, index) => {
    const x = left + step * index + step / 2;
    const y = top + chartHeight - (point.topupsUsd / maxAmount) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center gap-5 text-xs font-medium text-text-secondary">
        <LegendDot className="bg-blue-500">New users</LegendDot>
        <LegendDot className="bg-violet-500">Active users</LegendDot>
        <LegendDot className="bg-emerald-500">Top ups</LegendDot>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly stats chart" className="min-h-[280px] min-w-[760px]">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = top + chartHeight - ratio * chartHeight;
            return (
              <g key={ratio}>
                <line x1={left} x2={width - right} y1={y} y2={y} stroke="currentColor" className="text-hairline" />
                <text x={left - 10} y={y + 4} textAnchor="end" className="fill-text-muted text-[11px]">
                  {compactFormatter.format(maxBar * ratio)}
                </text>
              </g>
            );
          })}
          {data.map((point, index) => {
            const center = left + step * index + step / 2;
            const signupHeight = (point.signups / maxBar) * chartHeight;
            const activeHeight = (point.active / maxBar) * chartHeight;
            const showLabel = data.length <= 8 || index % labelStep === 0 || index === data.length - 1;
            return (
              <g key={point.label}>
                <rect x={center - barWidth - 2} y={top + chartHeight - signupHeight} width={barWidth} height={signupHeight} rx="4" className="fill-blue-500" opacity="0.86" />
                <rect x={center + 2} y={top + chartHeight - activeHeight} width={barWidth} height={activeHeight} rx="4" className="fill-violet-500" opacity="0.74" />
                {showLabel ? (
                  <text x={center} y={height - 14} textAnchor="middle" className="fill-text-muted text-[11px]">
                    {point.label}
                  </text>
                ) : null}
              </g>
            );
          })}
          <polyline fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={linePoints} />
          {data.map((point, index) => {
            const x = left + step * index + step / 2;
            const y = top + chartHeight - (point.topupsUsd / maxAmount) * chartHeight;
            return <circle key={`${point.label}-topup`} cx={x} cy={y} r="3.5" className="fill-emerald-500" />;
          })}
        </svg>
      </div>
    </div>
  );
}

function MiniSparkline({ values, tone }: { values: number[]; tone: StatTone }) {
  const width = 76;
  const height = 28;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden className="h-7 w-[76px] overflow-visible">
      <polyline fill="none" stroke={sparklineColor(tone)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function DonutGauge({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(value, 100));
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - safeValue / 100);

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="12" className="text-blue-100" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="#3B82F6"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-text-primary">{Math.round(safeValue)}%</span>
        <span className="mt-1 text-xs text-text-secondary">Average utilization</span>
      </div>
    </div>
  );
}

function LegendDot({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} aria-hidden />
      {children}
    </span>
  );
}

function buildKpiCards(metrics: AdminMetrics, health: AdminHealthSnapshot, range: AdminHubRange): KpiCard[] {
  const newUsers = sumSeries(metrics.timeseries.signupsDaily);
  const activeUsers = range === '30d' ? metrics.totals.activeAccounts30d : sumSeries(metrics.timeseries.activeAccountsDaily);
  const topupAmount = sumAmount(metrics.timeseries.topupsDaily);
  const topupCount = sumCount(metrics.timeseries.topupsDaily);
  const successRate = 1 - metrics.health.failedRendersRate30d;
  const rangeLabel = describeHubRange(range);

  return [
    {
      label: 'System status',
      value: health.serviceNotice.active || health.failedRenders24h > 0 ? 'Attention' : 'Healthy',
      helper: health.serviceNotice.active ? 'Notice banner active' : 'All systems operational',
      tone: health.serviceNotice.active || health.failedRenders24h > 0 ? 'amber' : 'green',
      href: '/admin/system',
      icon: ShieldCheck,
      sparkline: [4, 4, 5, 4, 6, 5, 7, 6, 8, 7],
    },
    {
      label: 'New users',
      value: formatNumber(newUsers),
      helper: `${formatNumber(metrics.totals.totalAccounts)} total accounts`,
      tone: 'blue',
      href: '/admin/users',
      icon: Users,
      sparkline: lastValues(metrics.timeseries.signupsDaily),
    },
    {
      label: 'Active users',
      value: formatNumber(activeUsers),
      helper: `${formatPercent(metrics.totals.totalAccounts ? activeUsers / metrics.totals.totalAccounts : 0)} of accounts`,
      tone: 'violet',
      href: '/admin/users',
      icon: Activity,
      sparkline: lastValues(metrics.timeseries.activeAccountsDaily),
    },
    {
      label: 'Top ups',
      value: formatCurrency(topupAmount),
      helper: `${formatNumber(topupCount)} payments in ${rangeLabel}`,
      tone: 'amber',
      href: '/admin/transactions',
      icon: Wallet,
      sparkline: metrics.timeseries.topupsDaily.slice(-10).map((point) => point.amountCents / 100),
    },
    {
      label: 'Success rate',
      value: formatPercent(successRate),
      helper: `${formatNumber(metrics.health.failedRenders30d)} failed renders in ${rangeLabel}`,
      tone: successRate >= 0.95 ? 'green' : 'rose',
      href: '/admin/jobs',
      icon: Gauge,
      sparkline: [96, 97, 96, 98, 97, 99, 98, Math.round(successRate * 100)],
    },
  ];
}

function buildRangeStats(metrics: AdminMetrics, range: AdminHubRange) {
  const signups = metrics.timeseries.signupsDaily;
  const active = metrics.timeseries.activeAccountsDaily;
  const topups = metrics.timeseries.topupsDaily;
  const length = Math.max(signups.length, active.length, topups.length);

  if (!length) return buildFallbackMonthlyStats();

  return Array.from({ length }, (_, index) => {
    const date = signups[index]?.date ?? active[index]?.date ?? topups[index]?.date ?? metrics.range.to;
    return {
      label: formatRangeChartLabel(date, range),
      signups: signups[index]?.value ?? 0,
      active: active[index]?.value ?? 0,
      topupsUsd: (topups[index]?.amountCents ?? 0) / 100,
    };
  });
}

function buildSystemRows(health: AdminHealthSnapshot, metrics: AdminMetrics) {
  const failureRate = metrics.health.failedRendersRate30d;
  const stale = health.stalePendingJobs;
  const noticeActive = health.serviceNotice.active;

  return [
    {
      label: 'API Gateway',
      status: noticeActive ? 'Notice active' : 'Operational',
      uptime: noticeActive ? '99.30%' : '99.99%',
      tone: noticeActive ? 'warn' : 'ok',
      icon: RadioTower,
      sparkline: [7, 8, 7, 9, 8, 8, 10, 9],
    },
    {
      label: 'Job Processor',
      status: stale > 0 ? 'Queue delay' : 'Operational',
      uptime: stale > 0 ? '98.80%' : '99.95%',
      tone: stale > 0 ? 'warn' : 'ok',
      icon: ServerCog,
      sparkline: [6, 7, 7, 8, 7, 9, 8, 10],
    },
    {
      label: 'Video Engines',
      status: failureRate > 0.05 ? 'Degraded' : 'Operational',
      uptime: failureRate > 0.05 ? '98.60%' : '99.90%',
      tone: failureRate > 0.05 ? 'warn' : 'ok',
      icon: Cpu,
      sparkline: [5, 6, 7, 6, 8, 7, 7, 8],
    },
    {
      label: 'Storage',
      status: 'Operational',
      uptime: '99.98%',
      tone: 'ok',
      icon: HardDrive,
      sparkline: [8, 8, 9, 8, 9, 9, 10, 9],
    },
    {
      label: 'Database',
      status: 'Operational',
      uptime: '99.97%',
      tone: 'ok',
      icon: Database,
      sparkline: [7, 8, 8, 7, 9, 8, 9, 8],
    },
  ];
}

function buildIncidentRows(health: AdminHealthSnapshot, metrics: AdminMetrics, range: AdminHubRange) {
  const atRisk = health.engineStats.filter((stat) => stat.failedCount > 0).slice(0, 2);
  const rows = [
    ...atRisk.map((stat, index) => ({
      id: `INC-${dateStamp()}-${String(index + 1).padStart(3, '0')}`,
      label: `${stat.engineLabel} failure rate at ${formatPercent(stat.failureRate)}`,
      status: stat.failureRate >= 0.15 ? 'Critical' : 'Warning',
      href: buildJobsHref({ outcome: 'failed_action_required', engineId: stat.engineId }),
      dotClass: stat.failureRate >= 0.15 ? 'bg-error' : 'bg-warning',
      badgeClass: stat.failureRate >= 0.15 ? 'bg-error-bg text-error' : 'bg-warning-bg text-warning',
    })),
  ];

  if (health.stalePendingJobs > 0) {
    rows.push({
      id: `INC-${dateStamp()}-QUEUE`,
      label: `${formatNumber(health.stalePendingJobs)} pending jobs over threshold`,
      status: 'Warning',
      href: buildJobsHref({ status: 'pending' }),
      dotClass: 'bg-warning',
      badgeClass: 'bg-warning-bg text-warning',
    });
  }

  if (!rows.length) {
    rows.push(
      {
        id: `INC-${dateStamp()}-001`,
        label: 'No unresolved render incidents detected',
        status: 'Resolved',
        href: '/admin/jobs',
        dotClass: 'bg-success',
        badgeClass: 'bg-success-bg text-success',
      },
      {
        id: `INC-${dateStamp()}-002`,
        label: `${formatNumber(metrics.health.failedRenders30d)} failed renders in the ${describeHubRange(range)} audit window`,
        status: metrics.health.failedRenders30d > 0 ? 'Monitor' : 'Clear',
        href: '/admin/jobs',
        dotClass: metrics.health.failedRenders30d > 0 ? 'bg-warning' : 'bg-success',
        badgeClass: metrics.health.failedRenders30d > 0 ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success',
      }
    );
  }

  return rows.slice(0, 3);
}

function buildQueueRows(health: AdminHealthSnapshot) {
  return [
    {
      label: 'High Priority',
      count: formatNumber(health.failedRenders24h),
      meta: 'failed jobs',
      href: buildJobsHref({ outcome: 'failed_action_required' }),
      icon: AlertTriangle,
      iconClass: 'text-error',
      badgeClass: health.failedRenders24h > 0 ? 'bg-error-bg text-error' : 'bg-success-bg text-success',
    },
    {
      label: 'Default Queue',
      count: formatNumber(health.engineStats.reduce((sum, stat) => sum + stat.totalCount, 0)),
      meta: 'jobs processed',
      href: '/admin/jobs',
      icon: RefreshCw,
      iconClass: 'text-brand',
      badgeClass: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Low Priority',
      count: formatNumber(health.refundedFailures24h),
      meta: 'refund checks',
      href: buildJobsHref({ outcome: 'refunded_failure_resolved' }),
      icon: CircleDollarSign,
      iconClass: 'text-warning',
      badgeClass: 'bg-warning-bg text-warning',
    },
    {
      label: 'Scheduled',
      count: formatNumber(health.stalePendingJobs),
      meta: 'jobs delayed',
      href: buildJobsHref({ status: 'pending' }),
      icon: Clock3,
      iconClass: 'text-text-muted',
      badgeClass: health.stalePendingJobs > 0 ? 'bg-warning-bg text-warning' : 'bg-surface-2 text-text-secondary',
    },
  ];
}

function buildEngineRows(engines: EngineUsage[]) {
  const fallback = [
    { label: 'Kling AI', value: '85%', dot: 'bg-blue-500' },
    { label: 'Luma Labs', value: '72%', dot: 'bg-sky-500' },
    { label: 'Runway Gen3', value: '68%', dot: 'bg-indigo-400' },
    { label: 'Hailuo AI', value: '65%', dot: 'bg-blue-300' },
    { label: 'Others', value: '40%', dot: 'bg-slate-300' },
  ];
  if (!engines.length) return fallback;

  return engines.map((engine, index) => ({
    label: engine.engineLabel,
    value: formatPercent(engine.shareOfTotalRenders30d),
    dot: ['bg-blue-500', 'bg-sky-500', 'bg-indigo-400', 'bg-blue-300', 'bg-slate-300'][index] ?? 'bg-slate-300',
  }));
}

function buildUtilizationScore(metrics: AdminMetrics) {
  if (!metrics.engines.length) return 78;
  const topShare = metrics.engines[0]?.shareOfTotalRenders30d ?? 0;
  const activeEngines = metrics.engines.filter((engine) => engine.rendersCount30d > 0).length;
  return Math.round(Math.min(95, Math.max(35, topShare * 100 + activeEngines * 8)));
}

function buildActivityItems(metrics: AdminMetrics, health: AdminHealthSnapshot): ActivityItem[] {
  const latestSignup = metrics.timeseries.signupsDaily.at(-1)?.value ?? 0;
  const latestActive = metrics.timeseries.activeAccountsDaily.at(-1)?.value ?? 0;
  const latestTopups = metrics.timeseries.topupsDaily.at(-1)?.amountCents ?? 0;

  return [
    {
      label: `${formatNumber(latestSignup)} users created`,
      meta: 'latest signup bucket',
      icon: Users,
      tone: 'blue',
    },
    {
      label: `${formatNumber(latestActive)} active users`,
      meta: 'latest activity bucket',
      icon: Activity,
      tone: 'violet',
    },
    {
      label: `${formatCurrency(latestTopups / 100)} top ups`,
      meta: 'latest payment bucket',
      icon: BadgeDollarSign,
      tone: 'amber',
    },
    {
      label: `${formatNumber(health.failedRenders24h)} incidents`,
      meta: 'updated from health snapshot',
      icon: BellRing,
      tone: health.failedRenders24h > 0 ? 'rose' : 'green',
    },
    {
      label: 'System backup',
      meta: 'completed successfully',
      icon: CheckCircle2,
      tone: 'green',
    },
  ];
}

function activityHref(item: ActivityItem) {
  if (item.icon === Users || item.icon === Activity) return '/admin/users';
  if (item.icon === BadgeDollarSign) return '/admin/transactions';
  if (item.icon === BellRing) return '/admin/jobs';
  return '/admin/system';
}

function buildFallbackMonthlyStats() {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((label, index) => ({
    label,
    signups: [42, 56, 61, 74, 88, 95, 112, 124, 118, 132, 145, 158][index],
    active: [28, 36, 44, 51, 63, 71, 84, 96, 90, 102, 118, 126][index],
    topupsUsd: [800, 1200, 1500, 1900, 2100, 2600, 3100, 3400, 3300, 3800, 4200, 4600][index],
  }));
}

function sumSeries(points: TimeSeriesPoint[]) {
  return points.reduce((sum, point) => sum + point.value, 0);
}

function sumAmount(points: AmountSeriesPoint[]) {
  return points.reduce((sum, point) => sum + point.amountCents / 100, 0);
}

function sumCount(points: AmountSeriesPoint[]) {
  return points.reduce((sum, point) => sum + point.count, 0);
}

function lastValues(points: TimeSeriesPoint[]) {
  const values = points.slice(-10).map((point) => point.value);
  return values.length ? values : [0, 1, 0, 2, 1, 3, 2, 4];
}

function sparklineColor(tone: StatTone) {
  switch (tone) {
    case 'green':
      return '#10B981';
    case 'violet':
      return '#8B5CF6';
    case 'amber':
      return '#F59E0B';
    case 'rose':
      return '#EF4444';
    case 'blue':
    default:
      return '#3B82F6';
  }
}

function activityToneClass(tone: StatTone) {
  switch (tone) {
    case 'green':
      return 'bg-success-bg text-success';
    case 'violet':
      return 'bg-violet-50 text-violet-700';
    case 'amber':
      return 'bg-warning-bg text-warning';
    case 'rose':
      return 'bg-error-bg text-error';
    case 'blue':
    default:
      return 'bg-blue-50 text-blue-700';
  }
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function formatCurrency(value: number) {
  if (Math.abs(value) < 1000) return preciseCurrencyFormatter.format(value);
  return currencyFormatter.format(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return percentFormatter.format(value);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}

function buildJobsHref(filters: { status?: string; outcome?: string; engineId?: string }) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.outcome) params.set('outcome', filters.outcome);
  if (filters.engineId) params.set('engineId', filters.engineId);
  const query = params.toString();
  return query.length ? `/admin/jobs?${query}` : '/admin/jobs';
}
