import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { fetchAdminMetrics, type TimeSeriesPoint } from '@/server/admin-metrics';
import { requireAdmin } from '@/server/admin';

export const dynamic = 'force-dynamic';

const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });

function formatCurrency(amountCents: number, currency = 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  return formatter.format(amountCents / 100);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function hashSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

type ChartCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

function ChartCard({ title, description, children, footer }: ChartCardProps) {
  return (
    <section className="rounded-[32px] border border-white/30 bg-white/80 p-6 shadow-card">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">{title}</p>
        <p className="text-sm text-text-secondary">{description}</p>
      </header>
      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-6 border-t border-white/40 pt-4">{footer}</div> : null}
    </section>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
};

function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <div className="rounded-[24px] border border-white/30 bg-white/90 px-6 py-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-text-primary">{value}</p>
      {helper ? <p className="mt-2 text-xs text-text-secondary">{helper}</p> : null}
    </div>
  );
}

type MiniChartProps = {
  points: TimeSeriesPoint[];
  color?: string;
  height?: number;
};

function MiniAreaChart({ points, color = '#2563eb', height = 160 }: MiniChartProps) {
  if (!points.length) {
    return <p className="text-sm text-text-secondary">No data for this range.</p>;
  }

  const values = points.map((point) => point.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const topPadding = 8;
  const bottomPadding = 8;
  const heightRange = 100 - topPadding - bottomPadding;

  const coords = points.map((point, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const normalized = range === 0 ? 0.5 : (point.value - min) / range;
    const y = bottomPadding + (1 - normalized) * heightRange;
    return { x, y };
  });

  const line = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x.toFixed(2)} ${coord.y.toFixed(2)}`)
    .join(' ');
  const area = `${line} L 100 ${100 - bottomPadding} L 0 ${100 - bottomPadding} Z`;
  const gradientId = `chart-fill-${hashSeed(`${color}-${points.length}-${points[0]?.date ?? ''}-${
    points[points.length - 1]?.date ?? ''
  }`)}`;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="trend chart" height={height} className="w-full">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatDay(date: string): string {
  return dayFormatter.format(new Date(date));
}

function formatMonth(date: string): string {
  return monthFormatter.format(new Date(date));
}

function buildMonthlyList(points: TimeSeriesPoint[], formatter: (value: number) => string) {
  if (!points.length) {
    return <p className="text-sm text-text-secondary">No monthly data yet.</p>;
  }
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {points.slice(-6).map((point) => (
        <div key={point.date} className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3">
          <dt className="text-xs uppercase tracking-[0.25em] text-text-muted">{formatMonth(point.date)}</dt>
          <dd className="mt-1 text-lg font-semibold text-text-primary">{formatter(point.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AdminInsightsPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/insights] access denied', error);
    notFound();
  }

  const metrics = await fetchAdminMetrics();

  const signupMonthlyList = buildMonthlyList(metrics.signupMonthly, (value) => `${formatNumber(value)} users`);
  const topupMonthlySeries = metrics.topupMonthly.map((point) => ({ date: point.date, value: point.amountCents }));
  const topupMonthlyList = buildMonthlyList(topupMonthlySeries, (value) => formatCurrency(value));

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">Analytics</p>
        <h1 className="text-3xl font-semibold text-text-primary">Workspace insights</h1>
        <p className="text-sm text-text-secondary">
          Private overview of signup velocity and wallet activity. Aggregations are recalculated live from Postgres.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total accounts" value={formatNumber(metrics.summary.totalUsers)} />
        <StatCard
          label="All-time top-ups"
          value={formatCurrency(metrics.summary.totalTopupVolumeCents)}
          helper={`${formatNumber(metrics.summary.totalTopupCount)} credit loads`}
        />
        <StatCard
          label="All-time charges"
          value={formatCurrency(metrics.summary.totalChargeVolumeCents)}
          helper={`${formatNumber(metrics.summary.totalChargeCount)} render charges`}
        />
      </section>

      <ChartCard
        title="Signups"
        description="Rolling 30-day unique accounts"
        footer={
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">Monthly cadence</p>
            {signupMonthlyList}
          </div>
        }
      >
        <MiniAreaChart points={metrics.signupDaily} color="#0ea5e9" />
        <div className="mt-4 grid gap-2 text-sm text-text-secondary sm:grid-cols-2 lg:grid-cols-4">
          {metrics.signupDaily.slice(-8).map((point) => (
            <div key={point.date} className="rounded-xl border border-white/50 bg-white/60 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{formatDay(point.date)}</p>
              <p className="text-lg font-semibold text-text-primary">{formatNumber(point.value)}</p>
              <p className="text-[11px] text-text-secondary">new accounts</p>
            </div>
          ))}
        </div>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Wallet top-ups"
          description="Amount and count over the past 30 days"
          footer={
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">Monthly totals</p>
              {topupMonthlyList}
            </div>
          }
        >
          <MiniAreaChart
            points={metrics.topupDaily.map((point) => ({
              date: point.date,
              value: point.amountCents,
            }))}
            color="#42b67a"
          />
          <div className="mt-4 space-y-2 text-sm text-text-secondary">
            {metrics.topupDaily.slice(-8).map((point) => (
              <div key={point.date} className="flex items-center justify-between rounded-xl border border-white/40 bg-white/70 px-3 py-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{formatDay(point.date)}</p>
                  <p className="text-lg font-semibold text-text-primary">{formatCurrency(point.amountCents)}</p>
                </div>
                <p className="text-xs text-text-secondary">{formatNumber(point.count)} loads</p>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Render charges" description="Charges recorded over the last 30 days">
          <MiniAreaChart
            points={metrics.chargeDaily.map((point) => ({
              date: point.date,
              value: point.amountCents,
            }))}
            color="#f97316"
          />
          <div className="mt-4 space-y-2 text-sm text-text-secondary">
            {metrics.chargeDaily.slice(-8).map((point) => (
              <div key={point.date} className="flex items-center justify-between rounded-xl border border-white/40 bg-white/70 px-3 py-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{formatDay(point.date)}</p>
                  <p className="text-lg font-semibold text-text-primary">{formatCurrency(point.amountCents)}</p>
                </div>
                <p className="text-xs text-text-secondary">{formatNumber(point.count)} charges</p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
