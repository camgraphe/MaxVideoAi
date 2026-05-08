import Link from 'next/link';
import { Fragment } from 'react';
import type { AdminJobAuditRecord } from '@/server/admin-job-audit';
import { Button } from '@/components/ui/Button';
import { IntegrityPill, JobAuditExpandedDetails } from '@/components/admin/job-audit/JobAuditExpandedDetails';
import {
  displayMeta,
  formatCurrency,
  formatDate,
  outcomeMeta,
  technicalStatusBadge,
} from '@/components/admin/job-audit/job-audit-formatters';

type JobAuditRowsProps = {
  expandedJobId: string | null;
  jobs: AdminJobAuditRecord[];
  onRefund: (jobId: string) => void;
  onRestore: (jobId: string) => void;
  onResync: (jobId: string) => void;
  onToggleExpanded: (jobId: string) => void;
  syncingJobId: string | null;
};

export function JobAuditRows({
  expandedJobId,
  jobs,
  onRefund,
  onRestore,
  onResync,
  onToggleExpanded,
  syncingJobId,
}: JobAuditRowsProps) {
  if (jobs.length === 0) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-10 text-center text-text-secondary">
          No jobs found for the current filters.
        </td>
      </tr>
    );
  }

  return jobs.map((job) => {
    const meta = outcomeMeta(job.outcome);
    const display = displayMeta(job);
    const isExpanded = expandedJobId === job.jobId;
    const refundEligible = job.paymentStatus?.includes('paid_wallet') && job.totalChargeCents > 0 && job.totalRefundCents === 0;

    return (
      <Fragment key={job.jobId}>
        <tr className="border-t border-hairline align-top transition hover:bg-bg">
          <td className="px-4 py-3">
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-text-primary">{formatDate(job.createdAt)}</p>
                <p className="text-xs text-text-secondary">Updated {formatDate(job.updatedAt)}</p>
              </div>
              {job.archived ? (
                <span className="inline-flex items-center rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-xs font-semibold uppercase tracking-micro text-warning">
                  Archived candidate
                </span>
              ) : null}
            </div>
          </td>

          <td className="px-4 py-3">
            <div className="min-w-0 space-y-2">
              <p className="font-mono text-xs text-text-primary break-all">{job.jobId}</p>
              {job.providerJobId ? <p className="font-mono text-[11px] text-text-muted break-all">{job.providerJobId}</p> : null}
              {job.failureReason ? (
                <p className="line-clamp-2 text-xs text-text-secondary">{job.failureReason}</p>
              ) : job.message ? (
                <p className="line-clamp-2 text-xs text-text-secondary">{job.message}</p>
              ) : null}
              {job.outputUrl ? (
                <a href={job.outputUrl} target="_blank" rel="noreferrer" className="inline-flex text-xs font-medium text-brand underline-offset-2 hover:underline">
                  {display.linkLabel}
                </a>
              ) : null}
            </div>
          </td>

          <td className="px-4 py-3">
            <div className="space-y-2 text-xs">
              {job.userId ? (
                <Link href={`/admin/users/${job.userId}`} className="font-mono text-text-primary underline-offset-2 hover:underline">
                  {job.userId}
                </Link>
              ) : (
                <p className="text-text-secondary">No user attached</p>
              )}
              <div>
                <p className="font-medium text-text-primary">{job.engineLabel ?? 'Unknown engine'}</p>
                <p className="text-text-secondary">
                  Surface {job.surface ?? 'video'}
                  {job.durationSec != null ? ` · ${job.durationSec}s` : ''}
                </p>
              </div>
            </div>
          </td>

          <td className="px-4 py-3">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <span className={meta.className}>{meta.label}</span>
                {technicalStatusBadge(job.status)}
              </div>
              <p className="text-xs text-text-secondary">Progress {job.progress ?? 0}%</p>
              {job.failureOrigin ? <p className="text-xs text-text-secondary">Origin {job.failureOrigin}</p> : null}
            </div>
          </td>

          <td className="px-4 py-3">
            <div className="space-y-3">
              <IntegrityPill
                ok={job.paymentOk}
                label="Payment OK"
                warningLabel="Payment drift"
                helper={`Net ${formatCurrency(job.netChargeCents, job.currency)} · expected ${formatCurrency(job.finalPriceCents, job.currency)}`}
              />
              <IntegrityPill ok={job.falOk} label="Fal OK" warningLabel="Fal issue" helper={`Latest ${job.falStatus ?? '—'} · logs ${job.falLogCount}`} />
              <IntegrityPill
                ok={job.hasOutput}
                label={display.readyLabel}
                warningLabel={job.isPlaceholderOutput ? display.placeholderLabel : display.missingLabel}
                helper={job.outputUrl ? 'Output linked' : 'No output URL recorded'}
              />
            </div>
          </td>

          <td className="px-4 py-3">
            <div className="flex flex-col items-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => onToggleExpanded(job.jobId)} className="border-border bg-surface">
                {isExpanded ? 'Hide details' : 'Details'}
              </Button>

              {job.providerJobId && (!job.hasOutput || job.status !== 'completed') ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onResync(job.jobId)}
                  disabled={syncingJobId === job.jobId}
                  className="border-border bg-surface"
                >
                  {syncingJobId === job.jobId ? 'Syncing…' : 'Resync Fal'}
                </Button>
              ) : null}

              {refundEligible ? (
                <Button type="button" size="sm" variant="outline" onClick={() => onRefund(job.jobId)} className="border-error-border bg-error-bg text-error hover:text-error">
                  Refund tokens
                </Button>
              ) : null}

              {job.archived ? (
                <Button type="button" size="sm" variant="outline" onClick={() => onRestore(job.jobId)} className="border-border bg-surface">
                  Bring online
                </Button>
              ) : null}
            </div>
          </td>
        </tr>

        {isExpanded ? <JobAuditExpandedDetails job={job} /> : null}
      </Fragment>
    );
  });
}
