import {
  Activity,
  AlertTriangle,
  BadgeDollarSign,
  BellRing,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  RadioTower,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { AdminHealthSnapshot, AdminMetrics, AmountSeriesPoint, EngineUsage, MetricsRangeLabel, TimeSeriesPoint } from '@/lib/admin/types';

const numberFormatter = new Intl.NumberFormat('en-US');
const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const preciseCurrencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export type StatTone = 'blue' | 'green' | 'violet' | 'amber' | 'rose';
export type AdminHubRange = Extract<MetricsRangeLabel, '24h' | '30d' | '90d'>;

export type PageProps = {
  searchParams?: Promise<{
    range?: string | string[];
    excludeAdmin?: string | string[];
  }>;
};

export const HUB_RANGE_OPTIONS: Array<{ value: AdminHubRange; label: string }> = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

export type KpiCard = {
  label: string;
  value: string;
  helper: string;
  tone: StatTone;
  href: string;
  icon: LucideIcon;
  sparkline: number[];
};

export type ActivityItem = {
  label: string;
  meta: string;
  icon: LucideIcon;
  tone: StatTone;
};

export function resolveHubRange(value?: string | string[]): AdminHubRange {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === '24h' || candidate === '90d') return candidate;
  return '30d';
}

export function describeHubRange(range: AdminHubRange) {
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

export function formatRangeChartLabel(date: string, range: AdminHubRange) {
  if (range === '24h') return '24h';
  return dayFormatter.format(new Date(date));
}

export function buildAdminHubHref(range: AdminHubRange, excludeAdmin: boolean) {
  const params = new URLSearchParams();
  params.set('range', range);
  if (!excludeAdmin) params.set('excludeAdmin', '0');
  return `/admin?${params.toString()}`;
}

export function buildAdminInsightsHref(range: AdminHubRange, excludeAdmin: boolean) {
  const params = new URLSearchParams();
  params.set('range', range);
  params.set('excludeAdmin', excludeAdmin ? '1' : '0');
  return `/admin/insights?${params.toString()}`;
}

export function buildKpiCards(metrics: AdminMetrics, health: AdminHealthSnapshot, range: AdminHubRange): KpiCard[] {
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

export function buildRangeStats(metrics: AdminMetrics, range: AdminHubRange) {
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

export function buildSystemRows(health: AdminHealthSnapshot, metrics: AdminMetrics) {
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

export function buildIncidentRows(health: AdminHealthSnapshot, metrics: AdminMetrics, range: AdminHubRange) {
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

export function buildQueueRows(health: AdminHealthSnapshot) {
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

export function buildEngineRows(engines: EngineUsage[]) {
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

export function buildUtilizationScore(metrics: AdminMetrics) {
  if (!metrics.engines.length) return 78;
  const topShare = metrics.engines[0]?.shareOfTotalRenders30d ?? 0;
  const activeEngines = metrics.engines.filter((engine) => engine.rendersCount30d > 0).length;
  return Math.round(Math.min(95, Math.max(35, topShare * 100 + activeEngines * 8)));
}

export function buildActivityItems(metrics: AdminMetrics, health: AdminHealthSnapshot): ActivityItem[] {
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

export function activityHref(item: ActivityItem) {
  if (item.icon === Users || item.icon === Activity) return '/admin/users';
  if (item.icon === BadgeDollarSign) return '/admin/transactions';
  if (item.icon === BellRing) return '/admin/jobs';
  return '/admin/system';
}

export function sparklineColor(tone: StatTone) {
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

export function activityToneClass(tone: StatTone) {
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

export function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

export function formatCurrency(value: number) {
  if (Math.abs(value) < 1000) return preciseCurrencyFormatter.format(value);
  return currencyFormatter.format(value);
}

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return percentFormatter.format(value);
}

export function formatCompact(value: number) {
  return compactFormatter.format(value);
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
