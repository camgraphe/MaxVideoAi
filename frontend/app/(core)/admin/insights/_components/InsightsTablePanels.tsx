import Link from 'next/link';
import type { AdminMetrics } from '@/lib/admin/types';
import { type AdminStatColumn, AdminStatTable } from '@/components/admin-system/surfaces/AdminStatTable';
import type { FunnelStep, LedgerRow, RevenueBoardRow, SmallStat } from '../_lib/insights-types';
import {
  formatCurrency,
  formatDay,
  formatFullDate,
  formatMonth,
  formatNumber,
  formatPercent,
  toneValueClass,
} from '../_lib/insights-formatters';
import { EmptyStateCard, ShareBar } from './InsightsChartSurfaces';

export function RevenueBoardTable({ rows }: { rows: RevenueBoardRow[] }) {
  const columns: AdminStatColumn<RevenueBoardRow>[] = [
    {
      key: 'metric',
      header: 'Metric',
      render: (row) => (
        <>
          <p className="font-medium text-text-primary">{row.label}</p>
          <p className="mt-1 text-xs text-text-secondary">{row.helper}</p>
        </>
      ),
    },
    {
      key: 'current',
      header: 'Current',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => row.current,
    },
    {
      key: 'previous',
      header: 'Previous',
      cellClassName: 'text-text-secondary',
      render: (row) => row.previous,
    },
    {
      key: 'delta',
      header: 'Delta',
      cellClassName: (row) => `font-medium ${toneValueClass(row.tone)}`,
      render: (row) => row.delta,
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Revenue board</p>
        <p className="mt-1 text-sm text-text-secondary">Current window vs previous window, organized like a decision table rather than four isolated cards.</p>
      </div>
      <AdminStatTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.label}
        empty={null}
        className="rounded-none border-0"
        tableClassName="min-w-[620px]"
        headerClassName="bg-surface"
        bodyClassName="divide-y divide-hairline"
      />
    </div>
  );
}

export function FunnelRows({ steps }: { steps: FunnelStep[] }) {
  if (!steps.length) {
    return <EmptyStateCard>No funnel data available yet.</EmptyStateCard>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Funnel</p>
        <p className="mt-1 text-sm text-text-secondary">Lecture en lignes compactes, plus proche d’un admin que d’un composant marketing.</p>
      </div>
      <div className="divide-y divide-hairline">
        {steps.map((step, index) => (
          <div key={step.label} className="grid gap-4 px-4 py-4 lg:grid-cols-[200px_minmax(0,1fr)_132px] lg:items-center">
            <div>
              <p className="text-sm font-medium text-text-primary">{step.label}</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">{step.helper}</p>
            </div>
            <div>
              <ShareBar value={step.shareOfStart} label={formatPercent(step.shareOfStart)} accent={step.accent} />
              <p className="mt-2 text-xs text-text-secondary">
                {step.conversionFromPrevious == null ? 'Baseline stage' : `${formatPercent(step.conversionFromPrevious)} from previous stage`}
              </p>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-lg font-semibold text-text-primary">{formatNumber(step.value)}</p>
              <p className="mt-1 text-xs text-text-secondary">Stage {index + 1}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BehaviorGrid({ stats }: { stats: SmallStat[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-surface px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{stat.label}</p>
          <p className={`mt-2 text-base font-semibold ${toneValueClass(stat.tone)}`}>{stat.value}</p>
          {stat.helper ? <p className="mt-1 text-xs leading-5 text-text-secondary">{stat.helper}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function TopSpendersTable({ whales }: { whales: AdminMetrics['behavior']['whalesTop10'] }) {
  if (!whales.length) {
    return <EmptyStateCard>No paying users yet.</EmptyStateCard>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Top spenders</p>
        <p className="mt-1 text-sm text-text-secondary">Entrées directement actionnables vers les fiches user admin.</p>
      </div>
      <div className="divide-y divide-hairline">
        {whales.map((whale) => (
          <Link
            key={whale.userId}
            href={`/admin/users/${whale.userId}`}
            className="grid gap-3 px-4 py-4 transition hover:bg-bg lg:grid-cols-[minmax(0,1fr)_110px_80px]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{whale.identifier}</p>
              <p className="mt-1 text-xs text-text-secondary">
                Last active {formatFullDate(whale.lastActiveAt)} · First seen {formatFullDate(whale.firstSeenAt)}
              </p>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-sm font-semibold text-text-primary">{formatCurrency(whale.lifetimeTopupUsd)}</p>
              <p className="mt-1 text-[11px] text-text-muted">top-ups</p>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-sm font-semibold text-text-primary">{formatNumber(whale.renderCount)}</p>
              <p className="mt-1 text-[11px] text-text-muted">renders</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function EngineMixTable({ engines }: { engines: AdminMetrics['engines'] }) {
  if (!engines.length) {
    return <EmptyStateCard>No engine activity recorded in the last 30 days.</EmptyStateCard>;
  }

  const columns: AdminStatColumn<AdminMetrics['engines'][number]>[] = [
    {
      key: 'engine',
      header: 'Engine',
      render: (engine) => (
        <>
          <p className="font-medium text-text-primary">{engine.engineLabel}</p>
          <p className="mt-1 text-xs text-text-secondary">
            {formatCurrency(engine.avgSpendPerUser30d, { precise: true })} avg / user
          </p>
        </>
      ),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      cellClassName: 'font-medium text-text-primary',
      render: (engine) => formatCurrency(engine.rendersAmount30dUsd),
    },
    {
      key: 'renders',
      header: 'Renders',
      cellClassName: 'text-text-secondary',
      render: (engine) => formatNumber(engine.rendersCount30d),
    },
    {
      key: 'users',
      header: 'Users',
      cellClassName: 'text-text-secondary',
      render: (engine) => formatNumber(engine.distinctUsers30d),
    },
    {
      key: 'renderShare',
      header: 'Render share',
      render: (engine) => (
        <ShareBar value={engine.shareOfTotalRenders30d} label={formatPercent(engine.shareOfTotalRenders30d)} accent="#0F766E" />
      ),
    },
    {
      key: 'revenueShare',
      header: 'Revenue share',
      render: (engine) => (
        <ShareBar value={engine.shareOfTotalRevenue30d} label={formatPercent(engine.shareOfTotalRevenue30d)} accent="#2563EB" />
      ),
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Engine mix</p>
        <p className="mt-1 text-sm text-text-secondary">Table-first reading of revenue, render share and distinct usage.</p>
      </div>
      <AdminStatTable columns={columns} rows={engines} getRowKey={(engine) => engine.engineId} empty={null} className="rounded-none border-0" tableClassName="min-w-[760px]" headerClassName="bg-surface" bodyClassName="divide-y divide-hairline" />
    </div>
  );
}

export function DailyLedgerTable({ rows }: { rows: LedgerRow[] }) {
  if (!rows.length) {
    return <EmptyStateCard>No recent daily entries.</EmptyStateCard>;
  }

  const columns: AdminStatColumn<LedgerRow>[] = [
    {
      key: 'date',
      header: 'Date',
      cellClassName: 'text-text-secondary',
      render: (row) => formatDay(row.date),
    },
    {
      key: 'signups',
      header: 'Signups',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatNumber(row.signups),
    },
    {
      key: 'active',
      header: 'Active',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatNumber(row.active),
    },
    {
      key: 'topups',
      header: 'Top-ups',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatCurrency(row.topupsUsd),
    },
    {
      key: 'charges',
      header: 'Charges',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatCurrency(row.chargesUsd),
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Latest 7 days</p>
        <p className="mt-1 text-sm text-text-secondary">Lecture condensée des dernières journées utiles, sans séparer croissance et revenu dans deux cartes différentes.</p>
      </div>
      <AdminStatTable columns={columns} rows={rows} getRowKey={(row) => row.date} empty={null} className="rounded-none border-0" tableClassName="min-w-[640px]" headerClassName="bg-surface" bodyClassName="divide-y divide-hairline" />
    </div>
  );
}

export function MonthlyRollupTable({
  rows,
}: {
  rows: Array<{ month: string; signups: number; topupsUsd: number; chargesUsd: number }>;
}) {
  if (!rows.length) {
    return <EmptyStateCard>No monthly aggregates yet.</EmptyStateCard>;
  }

  const columns: AdminStatColumn<(typeof rows)[number]>[] = [
    {
      key: 'month',
      header: 'Month',
      cellClassName: 'text-text-secondary',
      render: (row) => formatMonth(row.month),
    },
    {
      key: 'signups',
      header: 'Signups',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatNumber(row.signups),
    },
    {
      key: 'topups',
      header: 'Top-ups',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatCurrency(row.topupsUsd),
    },
    {
      key: 'charges',
      header: 'Charges',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatCurrency(row.chargesUsd),
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Monthly rollup</p>
        <p className="mt-1 text-sm text-text-secondary">Six derniers mois, gardés séparés des lignes journalières.</p>
      </div>
      <AdminStatTable columns={columns} rows={rows} getRowKey={(row) => row.month} empty={null} className="rounded-none border-0" headerClassName="bg-surface" bodyClassName="divide-y divide-hairline" />
    </div>
  );
}
