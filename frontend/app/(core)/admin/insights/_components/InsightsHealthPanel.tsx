import Link from 'next/link';
import type { AdminMetrics } from '@/lib/admin/types';
import type { PrioritySignal } from '../_lib/insights-types';
import { formatNumber, formatPercent, toneValueClass } from '../_lib/insights-formatters';
import { EmptyStateCard } from './InsightsChartSurfaces';
import { SummaryCell } from './InsightsSummaryPanels';

export function HealthPanel({
  failedRenders,
  failureRate,
  flaggedRows,
  metrics,
}: {
  failedRenders: number;
  failureRate: number;
  flaggedRows: AdminMetrics['health']['failedByEngine30d'];
  metrics: AdminMetrics;
}) {
  const topEngine = metrics.engines[0];
  const activationGap = Math.max(0, metrics.funnels.totalTopupUsers - metrics.funnels.convertedWithin30dUsers);
  const riskSignals: PrioritySignal[] = [
    {
      label: 'Open failure backlog',
      value: failedRenders ? formatNumber(failedRenders) : 'Clear',
      helper: failedRenders
        ? `${formatNumber(flaggedRows.length)} engine${flaggedRows.length > 1 ? 's' : ''} still show unresolved failures.`
        : 'No unresolved failure recorded in the last 30 days.',
      href: '/admin/jobs',
      tone: failedRenders ? 'warning' : 'success',
    },
    {
      label: 'Activation leak',
      value: formatNumber(activationGap),
      helper: activationGap
        ? 'Wallet users who still have not reached a first completed render within 30 days.'
        : 'All wallet users in this window reached a first render within 30 days.',
      href: '/admin/users',
      tone: activationGap ? 'warning' : 'success',
    },
    {
      label: 'Engine concentration',
      value: topEngine ? formatPercent(topEngine.shareOfTotalRevenue30d) : '—',
      helper: topEngine
        ? `${topEngine.engineLabel} currently carries the largest share of 30-day charge volume.`
        : 'No engine demand recorded in this range.',
      href: '/admin/engines',
      tone: topEngine && topEngine.shareOfTotalRevenue30d > 0.55 ? 'warning' : 'default',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-3">
        <SummaryCell label="Failed renders" value={formatNumber(failedRenders)} helper="Unresolved failures" tone={failedRenders ? 'warning' : 'success'} />
        <SummaryCell label="Failure rate" value={formatPercent(failureRate)} helper="Failed / completed" tone={failureRate ? 'warning' : 'success'} />
        <SummaryCell
          label="Engines impacted"
          value={formatNumber(flaggedRows.length)}
          helper="At least one unresolved failure"
          tone={flaggedRows.length ? 'warning' : 'success'}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
        <div className="border-b border-hairline px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Risk desk</p>
          <p className="mt-1 text-sm text-text-secondary">Fast operator read of what could distort conversion, revenue quality or reliability next.</p>
        </div>
        <div className="divide-y divide-hairline">
          {riskSignals.map((signal) => (
            <Link key={signal.label} href={signal.href} className="flex items-start justify-between gap-4 px-4 py-4 transition hover:bg-bg">
              <div>
                <p className="text-sm font-medium text-text-primary">{signal.label}</p>
                <p className="mt-1 text-xs leading-5 text-text-secondary">{signal.helper}</p>
              </div>
              <p className={`shrink-0 text-sm font-semibold ${toneValueClass(signal.tone)}`}>{signal.value}</p>
            </Link>
          ))}
        </div>
      </div>

      {flaggedRows.length ? (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
          <div className="border-b border-hairline px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Open incidents</p>
            <p className="mt-1 text-sm text-text-secondary">Seuls les moteurs avec un vrai signal restent visibles.</p>
          </div>
          <div className="divide-y divide-hairline">
            {flaggedRows.map((row) => (
              <div key={row.engineId} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{row.engineLabel}</p>
                    <p className="mt-1 text-xs text-text-secondary">Unresolved failures still need follow-up on jobs or billing.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-error">{formatPercent(row.failureRate30d)}</p>
                    <p className="mt-1 text-[11px] text-text-muted">{formatNumber(row.failedCount30d)} failed renders</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyStateCard>No unresolved failures recorded in the past 30 days.</EmptyStateCard>
      )}
    </div>
  );
}
