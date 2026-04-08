'use client';

import Link from 'next/link';
import { type ReactNode, Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { AdminJobAuditRecord, AdminJobOutcome } from '@/server/admin-job-audit';
import { Button } from '@/components/ui/Button';

interface JobAuditTableProps {
  initialJobs: AdminJobAuditRecord[];
  initialCursor: string | null;
  filtersQuery: string;
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Paris',
});

function formatCurrency(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const parts = Object.fromEntries(
      dateTimeFormatter
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value])
    );
    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
  } catch {
    return value;
  }
}

function outcomeMeta(outcome: AdminJobOutcome) {
  const base = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-micro';
  if (outcome === 'failed_action_required') {
    return {
      label: 'Action required',
      className: clsx(base, 'border-error-border bg-error-bg text-error'),
    };
  }
  if (outcome === 'refunded_failure_resolved') {
    return {
      label: 'Refunded failure',
      className: clsx(base, 'border-info-border bg-info-bg text-info'),
    };
  }
  if (outcome === 'completed') {
    return {
      label: 'Completed',
      className: clsx(base, 'border-success-border bg-success-bg text-success'),
    };
  }
  if (outcome === 'in_progress') {
    return {
      label: 'In progress',
      className: clsx(base, 'border-warning-border bg-warning-bg text-warning'),
    };
  }
  return {
    label: 'Unknown',
    className: clsx(base, 'border-border bg-muted text-text-secondary'),
  };
}

function technicalStatusBadge(status?: string | null) {
  if (!status) return null;
  const normalized = status.toLowerCase();
  const base = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-micro';
  if (normalized === 'completed') {
    return <span className={clsx(base, 'border-success-border bg-success-bg text-success')}>completed</span>;
  }
  if (normalized === 'failed') {
    return <span className={clsx(base, 'border-error-border bg-error-bg text-error')}>failed</span>;
  }
  if (normalized === 'running' || normalized === 'queued' || normalized === 'pending') {
    return <span className={clsx(base, 'border-warning-border bg-warning-bg text-warning')}>{normalized}</span>;
  }
  return <span className={clsx(base, 'border-info-border bg-info-bg text-info')}>{normalized}</span>;
}

function displayMeta(job: AdminJobAuditRecord) {
  const surface = job.surface ?? 'video';
  if (surface === 'image') {
    return {
      readyLabel: 'Image ready',
      placeholderLabel: 'Placeholder image',
      missingLabel: 'Missing image',
      linkLabel: 'Open image',
    };
  }
  if (surface === 'character') {
    return {
      readyLabel: 'Character ready',
      placeholderLabel: 'Placeholder image',
      missingLabel: 'Missing image',
      linkLabel: 'Open character',
    };
  }
  if (surface === 'angle') {
    return {
      readyLabel: 'Angle ready',
      placeholderLabel: 'Placeholder image',
      missingLabel: 'Missing image',
      linkLabel: 'Open angle',
    };
  }
  return {
    readyLabel: 'Video ready',
    placeholderLabel: 'Placeholder asset',
    missingLabel: 'Missing video',
    linkLabel: 'Open video',
  };
}

function IntegrityPill({
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

export function AdminJobAuditTable({ initialJobs, initialCursor, filtersQuery }: JobAuditTableProps) {
  const [jobs, setJobs] = useState<AdminJobAuditRecord[]>(initialJobs);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<'info' | 'success' | 'error'>('info');
  const [showArchived, setShowArchived] = useState(false);
  const [syncingJobId, setSyncingJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setJobs(initialJobs);
    setNextCursor(initialCursor);
    setIsRefreshing(false);
    setIsLoadingMore(false);
    setStatusMessage(null);
    setStatusVariant('info');
    setShowArchived(false);
    setSyncingJobId(null);
    setExpandedJobId(null);
  }, [filtersQuery, initialCursor, initialJobs]);

  const buildSearchParams = useCallback(
    (overrides: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(filtersQuery);
      Object.entries(overrides).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      return params.toString();
    },
    [filtersQuery]
  );

  const buildUrl = useCallback(
    (overrides: Record<string, string | null | undefined>) => {
      const search = buildSearchParams(overrides);
      return search.length ? `/api/admin/jobs/audit?${search}` : '/api/admin/jobs/audit';
    },
    [buildSearchParams]
  );

  const visibleJobs = useMemo(() => {
    const base = [...jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (showArchived) return base;
    return base.filter((job) => !job.archived);
  }, [jobs, showArchived]);

  const attentionCount = useMemo(
    () =>
      visibleJobs.filter(
        (job) => job.outcome === 'failed_action_required' || !job.paymentOk || !job.falOk || !job.hasOutput
      ).length,
    [visibleJobs]
  );

  const archivedCount = useMemo(() => jobs.filter((job) => job.archived).length, [jobs]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(buildUrl({ limit: '30', cursor: null }), { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Unable to refresh job audit data.');
      }
      setJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
      setNextCursor(payload?.nextCursor ?? null);
      setStatusVariant('success');
      setStatusMessage('Job audit data refreshed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh job audit data.';
      setStatusVariant('error');
      setStatusMessage(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [buildUrl]);

  const handleRefund = useCallback(
    async (jobId: string) => {
      const confirmRefund = window.confirm('Issue a manual wallet refund for this job?');
      if (!confirmRefund) return;
      const noteInput = window.prompt('Optional note (appears in job message):') ?? undefined;
      try {
        const response = await fetch('/api/admin/transactions/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, note: noteInput }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? 'Refund failed.');
        }
        setStatusVariant('success');
        setStatusMessage('Manual refund issued.');
        await refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Refund failed.';
        setStatusVariant('error');
        setStatusMessage(message);
      }
    },
    [refresh]
  );

  const handleRestore = useCallback(
    async (jobId: string) => {
      try {
        const response = await fetch('/api/admin/jobs/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? 'Unable to bring this job back online.');
        }
        setStatusVariant('success');
        setStatusMessage('Job moved back online for review.');
        await refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to bring this job back online.';
        setStatusVariant('error');
        setStatusMessage(message);
      }
    },
    [refresh]
  );

  const handleResync = useCallback(
    async (jobId: string) => {
      const confirmLink = window.confirm('Force Fal to refresh media and billing for this job?');
      if (!confirmLink) return;
      setSyncingJobId(jobId);
      try {
        const response = await fetch(`/api/admin/jobs/${jobId}/resync`, { method: 'POST' });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? 'Unable to resync job.');
        }
        setStatusVariant('success');
        setStatusMessage('Job resynced with Fal.');
        await refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to resync this job.';
        setStatusVariant('error');
        setStatusMessage(message);
      } finally {
        setSyncingJobId(null);
      }
    },
    [refresh]
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const response = await fetch(buildUrl({ limit: '30', cursor: nextCursor }), { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Unable to load more jobs.');
      }
      const incoming: AdminJobAuditRecord[] = Array.isArray(payload.jobs) ? payload.jobs : [];
      setJobs((prev) => {
        if (!incoming.length) return prev;
        const map = new Map<string, AdminJobAuditRecord>();
        [...prev, ...incoming].forEach((job) => {
          map.set(job.jobId, job);
        });
        return Array.from(map.values());
      });
      setNextCursor(payload?.nextCursor ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load more jobs.';
      setStatusVariant('error');
      setStatusMessage(message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [buildUrl, isLoadingMore, nextCursor]);

  useEffect(() => {
    if (!nextCursor) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [loadMore, nextCursor]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-text-primary">
            {visibleJobs.length} jobs loaded
            {showArchived ? ' including archived rows' : ''}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {attentionCount} need attention{archivedCount > 0 ? ` · ${archivedCount} archived candidates hidden by default` : ''}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {archivedCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowArchived((prev) => !prev)}
              className="border-border bg-surface"
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={refresh} disabled={isRefreshing} className="border-border bg-surface">
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {statusMessage ? (
        <div
          className={clsx(
            'rounded-2xl border px-4 py-3 text-sm',
            statusVariant === 'success' && 'border-success-border bg-success-bg text-success',
            statusVariant === 'error' && 'border-error-border bg-error-bg text-error',
            statusVariant === 'info' && 'border-info-border bg-info-bg text-info'
          )}
        >
          {statusMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px] text-left text-sm">
            <thead className="bg-surface">
              <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Job</th>
                <th className="px-4 py-3 font-semibold">Scope</th>
                <th className="px-4 py-3 font-semibold">State</th>
                <th className="px-4 py-3 font-semibold">Integrity</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-text-secondary">
                    No jobs found for the current filters.
                  </td>
                </tr>
              ) : (
                visibleJobs.map((job) => {
                  const meta = outcomeMeta(job.outcome);
                  const display = displayMeta(job);
                  const isExpanded = expandedJobId === job.jobId;
                  const refundEligible =
                    job.paymentStatus?.includes('paid_wallet') && job.totalChargeCents > 0 && job.totalRefundCents === 0;

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
                            {job.providerJobId ? (
                              <p className="font-mono text-[11px] text-text-muted break-all">{job.providerJobId}</p>
                            ) : null}
                            {job.failureReason ? (
                              <p className="line-clamp-2 text-xs text-text-secondary">{job.failureReason}</p>
                            ) : job.message ? (
                              <p className="line-clamp-2 text-xs text-text-secondary">{job.message}</p>
                            ) : null}
                            {job.outputUrl ? (
                              <a
                                href={job.outputUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex text-xs font-medium text-brand underline-offset-2 hover:underline"
                              >
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
                            {job.failureOrigin ? (
                              <p className="text-xs text-text-secondary">Origin {job.failureOrigin}</p>
                            ) : null}
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
                            <IntegrityPill
                              ok={job.falOk}
                              label="Fal OK"
                              warningLabel="Fal issue"
                              helper={`Latest ${job.falStatus ?? '—'} · logs ${job.falLogCount}`}
                            />
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
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setExpandedJobId((prev) => (prev === job.jobId ? null : job.jobId))}
                              className="border-border bg-surface"
                            >
                              {isExpanded ? 'Hide details' : 'Details'}
                            </Button>

                            {job.providerJobId && (!job.hasOutput || job.status !== 'completed') ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void handleResync(job.jobId)}
                                disabled={syncingJobId === job.jobId}
                                className="border-border bg-surface"
                              >
                                {syncingJobId === job.jobId ? 'Syncing…' : 'Resync Fal'}
                              </Button>
                            ) : null}

                            {refundEligible ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleRefund(job.jobId)}
                                className="border-error-border bg-error-bg text-error hover:text-error"
                              >
                                Refund tokens
                              </Button>
                            ) : null}

                            {job.archived ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleRestore(job.jobId)}
                                className="border-border bg-surface"
                              >
                                Bring online
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>

                      {isExpanded ? (
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
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={sentinelRef} className="h-10 w-full" aria-hidden="true" />
      {isLoadingMore ? <div className="text-center text-xs text-text-muted">Loading more jobs…</div> : null}
      {nextCursor ? (
        <div className="text-center">
          <Button type="button" size="sm" variant="outline" onClick={() => void loadMore()} disabled={isLoadingMore} className="border-border bg-surface">
            {isLoadingMore ? 'Loading…' : 'Load more jobs'}
          </Button>
        </div>
      ) : null}
      {!nextCursor && !isLoadingMore ? <div className="text-center text-xs text-text-muted">End of results</div> : null}
    </section>
  );
}
