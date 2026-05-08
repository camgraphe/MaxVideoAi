import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Download, Filter, ShieldCheck, Users } from 'lucide-react';
import {
  activityHref,
  activityToneClass,
  buildActivityItems,
  buildAdminHubHref,
  buildAdminInsightsHref,
  buildEngineRows,
  buildIncidentRows,
  buildQueueRows,
  buildRangeStats,
  buildSystemRows,
  describeHubRange,
  formatCompact,
  HUB_RANGE_OPTIONS,
  sparklineColor,
  type AdminHubRange,
  type KpiCard,
  type StatTone,
} from '../_lib/admin-dashboard-helpers';

type AdminDashboardViewProps = {
  selectedRange: AdminHubRange;
  excludeAdmin: boolean;
  monthlyStats: ReturnType<typeof buildRangeStats>;
  kpis: KpiCard[];
  systemRows: ReturnType<typeof buildSystemRows>;
  incidents: ReturnType<typeof buildIncidentRows>;
  queueRows: ReturnType<typeof buildQueueRows>;
  activity: ReturnType<typeof buildActivityItems>;
  engineRows: ReturnType<typeof buildEngineRows>;
  utilizationScore: number;
};

export function AdminDashboardView({
  selectedRange,
  excludeAdmin,
  monthlyStats,
  kpis,
  systemRows,
  incidents,
  queueRows,
  activity,
  engineRows,
  utilizationScore,
}: AdminDashboardViewProps) {
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

      <Panel title="Quick user handoff">
        <form action="/admin/users" method="get" className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto] md:items-end">
          <label className="grid gap-2 text-sm font-semibold text-text-secondary" htmlFor="admin-user-handoff">
            Find user
            <input
              id="admin-user-handoff"
              name="search"
              type="search"
              placeholder="Search by email or Supabase user ID"
              className="min-h-[42px] rounded-lg border border-border bg-bg px-3 text-sm font-medium text-text-primary shadow-[0_10px_24px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Users className="h-4 w-4" />
            Open user
          </button>
        </form>
      </Panel>

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
            <DonutGauge value={utilizationScore} />
            <div className="space-y-3">
              {engineRows.map((engine) => (
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
                  {formatCompact(maxBar * ratio)}
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
