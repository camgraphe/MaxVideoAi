import Link from 'next/link';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import type { AdminUserUsage } from '../_lib/admin-user-detail-types';
import { formatCurrency, formatDateTime, formatNumber } from '../_lib/admin-user-detail-format';

export function AdminUserUsageSection({ usage }: { usage: AdminUserUsage | null }) {
  return (
    <AdminSection
      title="Usage & Spend"
      description="Derniers rendus et répartition par engine pour comprendre rapidement où part la dépense."
      action={
        usage ? (
          <AdminSectionMeta
            title={`${formatNumber(usage.totalRenders)} completed renders`}
            lines={[`30d ${formatNumber(usage.renders30d)}`, `${usage.engineBreakdown.length} engines touched`]}
          />
        ) : undefined
      }
    >
      {usage ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_340px]">
          <RecentJobsTable usage={usage} />
          <EngineMixPanel usage={usage} />
        </div>
      ) : (
        <AdminEmptyState>Render and spend aggregates are unavailable.</AdminEmptyState>
      )}
    </AdminSection>
  );
}

function RecentJobsTable({ usage }: { usage: AdminUserUsage }) {
  return (
    <AdminDataTable>
      <thead className="bg-surface">
        <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
          <th className="px-4 py-3 font-semibold">Job</th>
          <th className="px-4 py-3 font-semibold">Created</th>
          <th className="px-4 py-3 font-semibold">Engine</th>
          <th className="px-4 py-3 font-semibold">Status</th>
          <th className="px-4 py-3 font-semibold">Amount</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline bg-bg/30">
        {usage.recentJobs.length ? (
          usage.recentJobs.map((job) => (
            <tr key={job.jobId} className="text-text-secondary">
              <td className="px-4 py-3">
                <Link className="font-mono text-xs text-text-primary underline-offset-2 hover:underline" href={`/admin/jobs?jobId=${job.jobId}`}>
                  {job.jobId}
                </Link>
              </td>
              <td className="px-4 py-3 text-xs">{formatDateTime(job.createdAt)}</td>
              <td className="px-4 py-3">{job.engineLabel}</td>
              <td className="px-4 py-3">
                <JobStatusBadge status={job.status} />
              </td>
              <td className="px-4 py-3 font-medium text-text-primary">{formatCurrency(job.amountUsd)}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={5} className="px-4 py-6">
              <AdminEmptyState>No jobs recorded yet.</AdminEmptyState>
            </td>
          </tr>
        )}
      </tbody>
    </AdminDataTable>
  );
}

function EngineMixPanel({ usage }: { usage: AdminUserUsage }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Engine mix</p>
        <p className="mt-1 text-sm text-text-secondary">Lifetime completed renders and spend by provider.</p>
      </div>
      {usage.engineBreakdown.length ? (
        <div className="divide-y divide-hairline">
          {usage.engineBreakdown.map((engine) => (
            <div key={engine.engineLabel} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{engine.engineLabel}</p>
                <p className="mt-1 text-xs text-text-secondary">{formatNumber(engine.renderCount)} renders</p>
              </div>
              <p className="shrink-0 text-sm font-medium text-text-primary">{formatCurrency(engine.spendUsd)}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-6">
          <AdminEmptyState>No engine usage recorded yet.</AdminEmptyState>
        </div>
      )}
    </div>
  );
}

function JobStatusBadge({ status }: { status: string | null }) {
  const normalized = (status ?? 'unknown').toLowerCase();
  const toneClass =
    normalized === 'completed'
      ? 'border-success-border bg-success-bg text-success'
      : normalized === 'failed'
        ? 'border-error-border bg-error-bg text-error'
        : normalized === 'running' || normalized === 'pending'
          ? 'border-warning-border bg-warning-bg text-warning'
          : 'border-border bg-surface text-text-secondary';

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>
      {normalized}
    </span>
  );
}
