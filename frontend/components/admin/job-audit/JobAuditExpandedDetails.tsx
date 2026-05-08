import { type ReactNode } from 'react';
import clsx from 'clsx';
import type { AdminJobAuditRecord } from '@/server/admin-job-audit';
import { displayMeta, formatCurrency, formatDate } from '@/components/admin/job-audit/job-audit-formatters';

export function IntegrityPill({
  ok,
  label,
  helper,
  warningLabel,
}: {
  ok: boolean;
  label: string;
  helper: string;
  warningLabel: string;
}) {
  return (
    <div className="space-y-1">
      <span
        className={clsx(
          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-micro',
          ok ? 'border-success-border bg-success-bg text-success' : 'border-warning-border bg-warning-bg text-warning'
        )}
      >
        {ok ? label : warningLabel}
      </span>
      <p className="text-xs text-text-secondary">{helper}</p>
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-bg/70 p-4 text-xs text-text-secondary">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function JobAuditExpandedDetails({ job }: { job: AdminJobAuditRecord }) {
  const display = displayMeta(job);

  return (
    <tr className="border-t border-hairline bg-surface/50">
      <td colSpan={6} className="px-4 py-4">
        <div className="grid gap-4 xl:grid-cols-4">
          <DetailCard title="Output & Routing">
            <p>Surface: {job.surface ?? 'video'}</p>
            <p>Engine: {job.engineLabel ?? 'Unknown engine'}</p>
            <p>Provider ID: {job.providerJobId ?? '—'}</p>
            <p>Hero render: {job.heroRenderId ?? '—'}</p>
            <p>Thumb: {job.thumbUrl ?? '—'}</p>
            <p>Render count: {job.renderCount}</p>
            {job.outputUrl ? (
              <a href={job.outputUrl} target="_blank" rel="noreferrer" className="font-medium text-brand underline-offset-2 hover:underline">
                {display.linkLabel}
              </a>
            ) : null}
          </DetailCard>

          <DetailCard title="Billing">
            <p>Status: {job.paymentStatus ?? '—'}</p>
            <p>Expected: {formatCurrency(job.finalPriceCents, job.currency)}</p>
            <p>Charges: {formatCurrency(job.totalChargeCents, job.currency)}</p>
            <p>Refunds: {formatCurrency(job.totalRefundCents, job.currency)}</p>
            <p>Net: {formatCurrency(job.netChargeCents, job.currency)}</p>
            <p>Charge count: {job.chargeCount}</p>
            <p>Refund count: {job.refundCount}</p>
            {job.receipts.length ? (
              <div className="pt-1">
                <p className="font-semibold text-text-primary">Recent receipts</p>
                <ul className="mt-1 space-y-1">
                  {job.receipts.slice(0, 4).map((receipt) => (
                    <li key={receipt.id} className="font-mono text-[11px]">
                      {receipt.type} · {formatCurrency(receipt.amountCents, receipt.currency)} · {formatDate(receipt.createdAt)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </DetailCard>

          <DetailCard title="Fal Diagnostics">
            <p>Latest status: {job.falStatus ?? '—'}</p>
            <p>Updated: {formatDate(job.falUpdatedAt)}</p>
            <p>Failure at: {formatDate(job.failureAt)}</p>
            <p>Failure origin: {job.failureOrigin ?? '—'}</p>
            <p>Reason: {job.failureReason ?? '—'}</p>
            <p>Refunded: {job.isRefunded ? 'Yes' : 'No'}</p>
            <p>Refund note: {job.refundReason ?? '—'}</p>
            <p>Fal log entries: {job.falLogCount}</p>
          </DetailCard>

          <DetailCard title="Timeline">
            {job.timeline.length ? (
              <ul className="space-y-2">
                {job.timeline.map((event, index) => (
                  <li key={`${job.jobId}-${event.at}-${event.kind}-${index}`}>
                    <p className="font-mono text-[11px] text-text-primary">{formatDate(event.at)}</p>
                    <p>
                      {event.source} · {event.kind}
                    </p>
                    <p>{event.summary}</p>
                    {event.details ? <p>{event.details}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No timeline events.</p>
            )}
          </DetailCard>
        </div>
      </td>
    </tr>
  );
}
