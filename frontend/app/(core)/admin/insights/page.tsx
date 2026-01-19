import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { fetchAdminMetrics, METRIC_RANGE_OPTIONS } from '@/server/admin-metrics';
import type { AdminMetrics, MetricsRangeLabel } from '@/lib/admin/types';
import { requireAdmin } from '@/server/admin';

const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const preciseCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

type PageProps = {
  searchParams?: {
    range?: string;
    excludeAdmin?: string | string[];
  };
};

const ADMIN_EXCLUDED_USER_IDS = ['301cc489-d689-477f-94c4-0b051deda0bc'];

export default async function AdminInsightsPage({ searchParams }: PageProps) {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/insights] access denied', error);
    notFound();
  }

  const excludeAdmin = resolveExcludeAdminParam(searchParams?.excludeAdmin);
  const metrics = await fetchAdminMetrics(searchParams?.range, {
    excludeUserIds: excludeAdmin ? ADMIN_EXCLUDED_USER_IDS : [],
  });
  const quickInsights = buildQuickInsights(metrics);
  const growthRows = buildGrowthRows(metrics);
  const topupRows = buildAmountRows(metrics.timeseries.topupsDaily);
  const chargeRows = buildAmountRows(metrics.timeseries.chargesDaily);
  const monthlyRows = buildMonthlyRows(metrics);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">Analytics</p>
          <h1 className="mt-1 text-3xl font-semibold text-text-primary">Workspace insights</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Private overview of growth, money, engines, and operational health. All numbers are rendered server-side from
            Postgres in real time.
          </p>
        </div>
        <RangeSelector current={metrics.range.label} excludeAdmin={excludeAdmin} />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total accounts"
          value={formatNumber(metrics.totals.totalAccounts)}
          helper="All-time signups"
        />
        <StatCard
          label="Paying accounts"
          value={formatNumber(metrics.totals.payingAccounts)}
          helper="Ever loaded wallet"
        />
        <StatCard
          label="Active (30d)"
          value={formatNumber(metrics.totals.activeAccounts30d)}
          helper="Rendered in the last 30 days"
        />
        <StatCard
          label="All-time revenue"
          value={formatCurrency(metrics.totals.allTimeRenderChargesUsd || metrics.totals.allTimeTopUpsUsd)}
          helper="Charges collected"
        />
      </section>

      <SectionCard title="Quick insights" description={`Snapshot for the past ${describeRange(metrics.range.label)}.`}>
        <ul className="space-y-2 text-sm text-text-secondary">
          {quickInsights.map((line, index) => (
            <li key={`insight-${index}`} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <section className="rounded-[28px] border border-white/30 bg-white/85 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Growth</p>
            <p className="text-sm text-text-secondary">Daily signups & active accounts</p>
          </div>
          <span className="text-xs text-text-muted">{describeRange(metrics.range.label)}</span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <MiniChartPanel title="Signups per day">
            <MiniBarChart
              ariaLabel="Daily signup counts"
              points={metrics.timeseries.signupsDaily.map((point) => ({
                label: formatDay(point.date),
                value: point.value,
              }))}
            />
          </MiniChartPanel>
          <MiniChartPanel title="Active accounts per day">
            <MiniBarChart
              ariaLabel="Daily active accounts"
              color="#7c3aed"
              points={metrics.timeseries.activeAccountsDaily.map((point) => ({
                label: formatDay(point.date),
                value: point.value,
              }))}
            />
          </MiniChartPanel>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                <th className="py-2 font-semibold">Date</th>
                <th className="py-2 font-semibold">Signups</th>
                <th className="py-2 font-semibold">Active accounts</th>
              </tr>
            </thead>
            <tbody>
              {growthRows.map((row) => (
                <tr key={`${row.kind ?? 'day'}-${row.date}`} className="border-t border-white/40 text-text-secondary">
                  <td className="py-2">
                    {row.kind === 'month' ? `${formatMonth(row.date)} total` : formatDay(row.date)}
                  </td>
                  <td className="py-2 font-semibold text-text-primary">{formatNumber(row.signups)}</td>
                  <td className="py-2 font-semibold text-text-primary">{formatNumber(row.active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Wallet top-ups" description={`Amounts loaded during the past ${describeRange(metrics.range.label)}.`}>
          <MiniBarChart
            ariaLabel="Daily wallet top-ups"
            color="#0ea5e9"
            points={metrics.timeseries.topupsDaily.map((point) => ({
              label: formatDay(point.date),
              value: point.amountCents / 100,
            }))}
          />
          <DailyAmountTable rows={topupRows} countLabel="Loads" />
        </SectionCard>
        <SectionCard title="Render charges" description={`Charges recorded over the past ${describeRange(metrics.range.label)}.`}>
          <MiniBarChart
            ariaLabel="Daily render charges"
            color="#f97316"
            points={metrics.timeseries.chargesDaily.map((point) => ({
              label: formatDay(point.date),
              value: point.amountCents / 100,
            }))}
          />
          <DailyAmountTable rows={chargeRows} countLabel="Charges" />
        </SectionCard>
      </section>

      <SectionCard title="Monthly rollup" description="Compact view of the last six months.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                <th className="py-2 font-semibold">Month</th>
                <th className="py-2 font-semibold">Signups</th>
                <th className="py-2 font-semibold">Top-ups</th>
                <th className="py-2 font-semibold">Charges</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.length ? (
                monthlyRows.map((row) => (
                  <tr key={row.month} className="border-t border-white/40 text-text-secondary">
                    <td className="py-2">{formatMonth(row.month)}</td>
                    <td className="py-2 font-semibold text-text-primary">{formatNumber(row.signups)}</td>
                    <td className="py-2 font-semibold text-text-primary">{formatCurrency(row.topupsUsd)}</td>
                    <td className="py-2 font-semibold text-text-primary">{formatCurrency(row.chargesUsd)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-sm text-text-secondary">
                    No monthly aggregates yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Engine usage (30d)" description="Renders, users, and revenue share per engine.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                <th className="py-2 font-semibold">Engine</th>
                <th className="py-2 font-semibold">Renders</th>
                <th className="py-2 font-semibold">Distinct users</th>
                <th className="py-2 font-semibold">Revenue (30d)</th>
                <th className="py-2 font-semibold">Share of renders</th>
                <th className="py-2 font-semibold">Share of revenue</th>
                <th className="py-2 font-semibold">Avg spend / user</th>
              </tr>
            </thead>
            <tbody>
              {metrics.engines.length ? (
                metrics.engines.map((engine) => (
                  <tr key={engine.engineId} className="border-t border-white/40 text-text-secondary">
                    <td className="py-2 font-semibold text-text-primary">{engine.engineLabel}</td>
                    <td className="py-2">{formatNumber(engine.rendersCount30d)}</td>
                    <td className="py-2">{formatNumber(engine.distinctUsers30d)}</td>
                    <td className="py-2">{formatCurrency(engine.rendersAmount30dUsd)}</td>
                    <td className="py-2">
                      <ShareBar value={engine.shareOfTotalRenders30d} label={formatPercent(engine.shareOfTotalRenders30d)} />
                    </td>
                    <td className="py-2">
                      <ShareBar value={engine.shareOfTotalRevenue30d} label={formatPercent(engine.shareOfTotalRevenue30d)} />
                    </td>
                    <td className="py-2">{formatCurrency(engine.avgSpendPerUser30d, { precise: true })}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-3 text-center text-sm text-text-secondary">
                    No engine activity recorded in the last 30 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="User behavior & funnel" description="Conversion funnels and heavy-spender overview.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <MetricList
              items={[
                {
                  label: 'Signup → Top-up conversion',
                  value: formatPercent(metrics.funnels.signupToTopUpConversion),
                },
                {
                  label: 'Top-up → Render within 30d',
                  value: formatPercent(metrics.funnels.topUpToRenderConversion30d),
                },
                {
                  label: 'Avg days: signup → first top-up',
                  value: formatDays(metrics.funnels.avgTimeSignupToFirstTopUpDays),
                },
                {
                  label: 'Avg days: top-up → first render',
                  value: formatDays(metrics.funnels.avgTimeTopUpToFirstRenderDays),
                },
              ]}
            />
            <MetricList
              items={[
                {
                  label: 'Avg renders per paying user (30d)',
                  value: formatAverage(metrics.behavior.avgRendersPerPayingUser30d),
                },
                {
                  label: 'Median renders per paying user',
                  value: formatAverage(metrics.behavior.medianRendersPerPayingUser30d),
                },
                {
                  label: 'Returning users (7d overlap)',
                  value: formatNumber(metrics.behavior.returningUsers7d),
                },
              ]}
            />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/40 bg-white/70 p-3">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  <th className="py-2 font-semibold">User</th>
                  <th className="py-2 font-semibold">Lifetime spend</th>
                  <th className="py-2 font-semibold">Renders</th>
                  <th className="py-2 font-semibold">First seen</th>
                  <th className="py-2 font-semibold">Last active</th>
                </tr>
              </thead>
              <tbody>
                {metrics.behavior.whalesTop10.length ? (
                  metrics.behavior.whalesTop10.map((whale) => (
                    <tr key={whale.userId} className="border-t border-white/40 text-text-secondary">
                      <td className="py-2 font-semibold text-text-primary">{whale.identifier}</td>
                      <td className="py-2">{formatCurrency(whale.lifetimeTopupUsd)}</td>
                      <td className="py-2">{formatNumber(whale.renderCount)}</td>
                      <td className="py-2">{formatFullDate(whale.firstSeenAt)}</td>
                      <td className="py-2">{formatFullDate(whale.lastActiveAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-sm text-text-secondary">
                      No paying users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Operational health (30d)" description="Failures and anomalies to keep an eye on.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Failed renders (30d)" value={formatNumber(metrics.health.failedRenders30d)} />
          <StatCard label="Failure rate" value={formatPercent(metrics.health.failedRendersRate30d)} helper="Failed / completed" />
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                <th className="py-2 font-semibold">Engine</th>
                <th className="py-2 font-semibold">Failed renders</th>
                <th className="py-2 font-semibold">Failure rate</th>
              </tr>
            </thead>
            <tbody>
              {metrics.health.failedByEngine30d.length ? (
                metrics.health.failedByEngine30d.map((row) => (
                  <tr key={row.engineId} className="border-t border-white/40 text-text-secondary">
                    <td className="py-2 font-semibold text-text-primary">{row.engineLabel}</td>
                    <td className="py-2">{formatNumber(row.failedCount30d)}</td>
                    <td className="py-2">{formatPercent(row.failureRate30d)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-sm text-text-secondary">
                    No failures recorded over the last 30 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function resolveExcludeAdminParam(value: string | string[] | undefined): boolean {
  const resolved = Array.isArray(value) ? value[value.length - 1] : value;
  if (resolved == null) return true;
  const normalized = resolved.trim().toLowerCase();
  if (!normalized) return true;
  return !['0', 'false', 'no', 'off'].includes(normalized);
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/30 bg-white/85 p-5 shadow-card">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">{title}</p>
        {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-[20px] border border-white/30 bg-white/90 px-4 py-3 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
      {helper ? <p className="text-xs text-text-secondary">{helper}</p> : null}
    </div>
  );
}

function RangeSelector({ current, excludeAdmin }: { current: MetricsRangeLabel; excludeAdmin: boolean }) {
  return (
    <form
      className="flex flex-wrap items-center gap-3 rounded-full border border-white/40 bg-white/80 px-3 py-2 text-sm text-text-secondary shadow-card"
      method="get"
    >
      <label htmlFor="range" className="text-xs font-semibold uppercase tracking-[0.2em]">
        Range
      </label>
      <select
        id="range"
        name="range"
        defaultValue={current}
        className="rounded-full border border-white/60 bg-white px-3 py-1 text-xs font-semibold text-text-primary"
      >
        {METRIC_RANGE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <input type="hidden" name="excludeAdmin" value="0" />
      <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
        <input
          type="checkbox"
          name="excludeAdmin"
          value="1"
          defaultChecked={excludeAdmin}
          className="h-4 w-4 rounded border border-white/60 text-text-primary accent-text-primary"
        />
        Exclude admin user
      </label>
      <button
        type="submit"
        className="rounded-full bg-text-primary px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white"
      >
        Apply
      </button>
    </form>
  );
}

function MiniChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/40 bg-white/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

type MiniBarChartPoint = {
  label: string;
  value: number;
};

function MiniBarChart({
  points,
  color = '#2563eb',
  ariaLabel = 'mini bar chart',
}: {
  points: MiniBarChartPoint[];
  color?: string;
  ariaLabel?: string;
}) {
  if (!points.length || points.every((point) => point.value <= 0)) {
    return <p className="text-sm text-text-secondary">No data for this range.</p>;
  }

  const max = Math.max(...points.map((point) => point.value));
  const barWidth = 100 / points.length;

  return (
    <svg viewBox="0 0 100 60" role="img" aria-label={ariaLabel} className="h-16 w-full" preserveAspectRatio="none">
      {points.map((point, index) => {
        const height = max ? (point.value / max) * 55 + 1 : 1;
        const x = index * barWidth;
        const y = 60 - height;
        return <rect key={`${point.label}-${index}`} x={x} y={y} width={barWidth - 0.5} height={height} rx={1} fill={color} />;
      })}
    </svg>
  );
}

type DailyAmountRow = {
  date: string;
  amountUsd: number;
  count: number;
  kind?: 'day' | 'month';
};

function DailyAmountTable({ rows, countLabel }: { rows: DailyAmountRow[]; countLabel: string }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
            <th className="py-2 font-semibold">Date</th>
            <th className="py-2 font-semibold">Amount</th>
            <th className="py-2 font-semibold">{countLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.kind ?? 'day'}-${row.date}`} className="border-t border-white/40 text-text-secondary">
              <td className="py-2">
                {row.kind === 'month' ? `${formatMonth(row.date)} total` : formatDay(row.date)}
              </td>
              <td className="py-2 font-semibold text-text-primary">{formatCurrency(row.amountUsd)}</td>
              <td className="py-2 font-semibold text-text-primary">{formatNumber(row.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShareBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full rounded-full bg-white/60">
        <div className="h-2 rounded-full bg-text-primary" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
      </div>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  );
}

function MetricList({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="rounded-2xl border border-white/40 bg-white/70 p-4">
      {items.map((item) => (
        <div key={item.label} className="py-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-text-muted">{item.label}</dt>
          <dd className="text-lg font-semibold text-text-primary">{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function buildQuickInsights(metrics: AdminMetrics): string[] {
  const insights: string[] = [];
  const humanRange = describeRange(metrics.range.label);
  const topTopupDay = [...metrics.timeseries.topupsDaily].sort((a, b) => b.amountCents - a.amountCents)[0];
  const topChargeDay = [...metrics.timeseries.chargesDaily].sort((a, b) => b.count - a.count)[0];
  const totalTopupAmount = metrics.timeseries.topupsDaily.reduce((sum, point) => sum + point.amountCents, 0);
  const totalTopupCount = metrics.timeseries.topupsDaily.reduce((sum, point) => sum + point.count, 0);
  const totalChargeAmount = metrics.timeseries.chargesDaily.reduce((sum, point) => sum + point.amountCents, 0);
  const totalChargeCount = metrics.timeseries.chargesDaily.reduce((sum, point) => sum + point.count, 0);

  if (topTopupDay && topTopupDay.amountCents > 0) {
    insights.push(
      `Top top-up day (${formatDay(topTopupDay.date)}): ${formatCurrency(topTopupDay.amountCents / 100)} across ${formatNumber(topTopupDay.count)} loads.`
    );
  } else {
    insights.push(`No wallet top-ups recorded in the past ${humanRange}.`);
  }

  if (topChargeDay && topChargeDay.count > 0) {
    insights.push(
      `Most active render day (${formatDay(topChargeDay.date)}): ${formatNumber(topChargeDay.count)} charges totaling ${formatCurrency(
        topChargeDay.amountCents / 100
      )}.`
    );
  } else {
    insights.push(`No render charges recorded in the past ${humanRange}.`);
  }

  if (totalTopupCount > 0) {
    const average = totalTopupAmount / totalTopupCount / 100;
    insights.push(`Average top-up amount (${humanRange}): ${formatCurrency(average, { precise: true })}.`);
  }

  if (totalChargeCount > 0) {
    const average = totalChargeAmount / totalChargeCount / 100;
    insights.push(`Average render charge (${humanRange}): ${formatCurrency(average, { precise: true })}.`);
  }

  insights.push(`Signup → Top-up conversion (lifetime): ${formatPercent(metrics.funnels.signupToTopUpConversion)}.`);

  return insights;
}

type GrowthRow = {
  date: string;
  signups: number;
  active: number;
  kind?: 'day' | 'month';
};

function buildGrowthRows(metrics: AdminMetrics): GrowthRow[] {
  const activeMap = new Map(
    metrics.timeseries.activeAccountsDaily.map((point) => [point.date.slice(0, 10), point.value])
  );
  const dailyRows = metrics.timeseries.signupsDaily
    .slice(-10)
    .map((point) => ({
      date: point.date,
      signups: point.value,
      active: activeMap.get(point.date.slice(0, 10)) ?? 0,
      kind: 'day' as const,
    }))
    .reverse();

  const monthlyTotals = new Map<string, { signups: number; active: number }>();
  metrics.timeseries.signupsDaily.forEach((point) => {
    const key = point.date.slice(0, 7);
    const bucket = monthlyTotals.get(key) ?? { signups: 0, active: 0 };
    bucket.signups += point.value;
    monthlyTotals.set(key, bucket);
  });
  metrics.timeseries.activeAccountsDaily.forEach((point) => {
    const key = point.date.slice(0, 7);
    const bucket = monthlyTotals.get(key) ?? { signups: 0, active: 0 };
    bucket.active += point.value;
    monthlyTotals.set(key, bucket);
  });

  const monthlyRows = Array.from(monthlyTotals.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 2)
    .map(([month, totals]) => ({
      date: `${month}-01`,
      signups: totals.signups,
      active: totals.active,
      kind: 'month' as const,
    }));

  return [...dailyRows, ...monthlyRows];
}

function buildAmountRows(points: AdminMetrics['timeseries']['topupsDaily']): DailyAmountRow[] {
  const dailyRows = points
    .slice(-10)
    .map((point) => ({
      date: point.date,
      amountUsd: point.amountCents / 100,
      count: point.count,
      kind: 'day' as const,
    }))
    .reverse();

  const monthlyTotals = new Map<string, { amountUsd: number; count: number }>();
  points.forEach((point) => {
    const key = point.date.slice(0, 7);
    const bucket = monthlyTotals.get(key) ?? { amountUsd: 0, count: 0 };
    bucket.amountUsd += point.amountCents / 100;
    bucket.count += point.count;
    monthlyTotals.set(key, bucket);
  });

  const monthlyRows = Array.from(monthlyTotals.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 2)
    .map(([month, totals]) => ({
      date: `${month}-01`,
      amountUsd: totals.amountUsd,
      count: totals.count,
      kind: 'month' as const,
    }));

  return [...dailyRows, ...monthlyRows];
}

function buildMonthlyRows(metrics: AdminMetrics) {
  const map = new Map<
    string,
    {
      month: string;
      signups: number;
      topupsUsd: number;
      chargesUsd: number;
    }
  >();

  metrics.monthly.signupsMonthly.forEach((point) => {
    const key = point.date.slice(0, 7);
    const existing = map.get(key) ?? { month: point.date, signups: 0, topupsUsd: 0, chargesUsd: 0 };
    existing.signups = point.value;
    map.set(key, existing);
  });

  metrics.monthly.topupsMonthly.forEach((point) => {
    const key = point.date.slice(0, 7);
    const existing = map.get(key) ?? { month: point.date, signups: 0, topupsUsd: 0, chargesUsd: 0 };
    existing.topupsUsd = point.amountCents / 100;
    map.set(key, existing);
  });

  metrics.monthly.chargesMonthly.forEach((point) => {
    const key = point.date.slice(0, 7);
    const existing = map.get(key) ?? { month: point.date, signups: 0, topupsUsd: 0, chargesUsd: 0 };
    existing.chargesUsd = point.amountCents / 100;
    map.set(key, existing);
  });

  return Array.from(map.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6)
    .reverse();
}

function describeRange(label: MetricsRangeLabel) {
  switch (label) {
    case '7d':
      return '7 days';
    case '90d':
      return '90 days';
    default:
      return '30 days';
  }
}

function formatCurrency(amount: number, options?: { precise?: boolean }) {
  if (options?.precise) {
    return preciseCurrencyFormatter.format(amount);
  }
  return currencyFormatter.format(amount);
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return percentFormatter.format(value);
}

function formatDay(value: string) {
  return dayFormatter.format(new Date(value));
}

function formatMonth(value: string) {
  return monthFormatter.format(new Date(value));
}

function formatFullDate(value: string | null) {
  if (!value) return '—';
  return fullDateFormatter.format(new Date(value));
}

function formatDays(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)} days`;
}

function formatAverage(value: number) {
  if (!Number.isFinite(value)) {
    return '0.0';
  }
  return value.toFixed(1);
}
