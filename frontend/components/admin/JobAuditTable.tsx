'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { AdminJobAuditRecord } from '@/server/admin-job-audit';
import { Button } from '@/components/ui/Button';

interface JobAuditTableProps {
  initialJobs: AdminJobAuditRecord[];
  initialCursor: string | null;
  filtersQuery: string;
}

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
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusBadge(status?: string | null) {
  if (!status) return null;
  const normalized = status.toLowerCase();
  const base = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-micro';
  if (normalized === 'completed') return <span className={clsx(base, 'border-success-border bg-success-bg text-success')}>Completed</span>;
  if (normalized === 'failed') return <span className={clsx(base, 'border-error-border bg-error-bg text-error')}>Failed</span>;
  if (normalized === 'running' || normalized === 'queued') return <span className={clsx(base, 'border-warning-border bg-warning-bg text-warning')}>{status}</span>;
  return <span className={clsx(base, 'border-info-border bg-info-bg text-info')}>{status}</span>;
}

export function AdminJobAuditTable({ initialJobs, initialCursor, filtersQuery }: JobAuditTableProps) {
  const [jobs, setJobs] = useState<AdminJobAuditRecord[]>(initialJobs);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<'info' | 'success' | 'error'>('info');
  const [showArchived, setShowArchived] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [syncingJobId, setSyncingJobId] = useState<string | null>(null);

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

  const sortedJobs = useMemo(() => {
    const base = [...jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (showArchived) return base;
    return base.filter((job) => !job.archived);
  }, [jobs, showArchived]);

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
        <div className="text-sm text-text-secondary">
          Showing {sortedJobs.length} job{sortedJobs.length === 1 ? '' : 's'} (latest first)
          {showArchived ? ' (including archived failures).' : '.'}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowArchived((prev) => !prev)}
            className="gap-2 rounded-md border-border px-3 py-1.5 text-sm font-medium hover:border-text-muted hover:bg-surface-2"
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={refresh}
            disabled={isRefreshing}
            className={clsx(
              'gap-2 rounded-md border-border px-3 py-1.5 text-sm font-medium',
              isRefreshing ? 'cursor-not-allowed opacity-60' : 'hover:border-text-muted hover:bg-surface-2'
            )}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {statusMessage ? (
        <div
          className={clsx(
            'rounded-md border px-3 py-2 text-sm',
            statusVariant === 'success' && 'border-success-border bg-success-bg text-success',
            statusVariant === 'error' && 'border-error-border bg-error-bg text-error',
            statusVariant === 'info' && 'border-info-border bg-info-bg text-info'
          )}
        >
          {statusMessage}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/60 text-xs font-semibold uppercase tracking-micro text-text-muted">
            <tr>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Job</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Engine</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Display</th>
              <th className="px-4 py-3 text-left">Payment</th>
              <th className="px-4 py-3 text-left">Fal</th>
              <th className="px-4 py-3 text-left">Receipts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background">
            {sortedJobs.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-text-secondary">
                  No jobs found.
                </td>
              </tr>
            ) : (
              sortedJobs.map((job) => {
                const paymentClass = job.paymentOk
                  ? 'border-success-border bg-success-bg text-success'
                  : 'border-error-border bg-error-bg text-error';
                const falClass = job.falOk
                  ? 'border-success-border bg-success-bg text-success'
                  : 'border-error-border bg-error-bg text-error';

                return (
                  <tr key={job.jobId} className="align-top">
                    <td className="px-4 py-3 align-top text-xs text-text-secondary">
                      <div className="flex flex-col gap-2">
                        <div>
                          <div className="font-mono text-xs text-text-secondary">{formatDate(job.createdAt)}</div>
                          <div className="font-mono text-[11px] text-text-muted">Updated: {formatDate(job.updatedAt)}</div>
                        </div>
                        {job.videoUrl ? (
                          <video
                            className="h-24 w-40 rounded border border-border bg-black"
                            src={job.videoUrl}
                            controls
                            preload="metadata"
                          />
                        ) : null}
                        {job.archived ? (
                          <div className="flex flex-col gap-2">
                            <span className="inline-flex items-center rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 font-semibold uppercase tracking-micro text-warning">
                              Auto-archived
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestore(job.jobId)}
                              className="rounded-md border-border bg-background px-2 py-1 text-xs font-medium text-text-primary hover:border-text-muted hover:bg-surface-2"
                            >
                              Bring back online
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <span className="font-mono text-xs text-text-primary break-all">{job.jobId}</span>
                        {job.providerJobId ? (
                          <span className="font-mono text-[11px] text-text-muted break-all">
                            {job.providerJobId}
                          </span>
                        ) : null}
                        {job.message ? (
                          <span className="text-xs text-text-secondary">{job.message}</span>
                        ) : null}
                        {job.providerJobId && (!job.videoUrl || job.status !== 'completed') ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleResync(job.jobId)}
                            disabled={syncingJobId === job.jobId}
                            className={clsx(
                              'rounded-md border-border bg-background px-2 py-1 text-xs font-medium text-text-primary',
                              syncingJobId === job.jobId
                                ? 'cursor-not-allowed opacity-60'
                                : 'hover:border-text-muted hover:bg-surface-2'
                            )}
                          >
                            {syncingJobId === job.jobId ? 'Sync en cours…' : 'Reprendre sur Fal'}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col text-xs text-text-muted">
                        <span>{job.userId ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">{job.engineLabel ?? 'Unknown engine'}</span>
                        {job.durationSec != null ? <span>{job.durationSec}s</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-xs">
                        {statusBadge(job.status)}
                        <span className="text-text-muted">Progress: {job.progress ?? 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-xs">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full border px-2 py-0.5 font-semibold uppercase tracking-micro',
                            job.hasVideo
                              ? 'border-success-border bg-success-bg text-success'
                              : job.isPlaceholderVideo
                                ? 'border-warning-border bg-warning-bg text-warning'
                                : 'border-error-border bg-error-bg text-error'
                          )}
                        >
                          {job.hasVideo ? 'Video ready' : job.isPlaceholderVideo ? 'Placeholder asset' : 'Missing video'}
                        </span>
                        {job.videoUrl ? (
                          <a
                            href={job.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary underline-offset-2 hover:underline"
                          >
                            Open video
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="text-text-muted">Status: {job.paymentStatus ?? '—'}</span>
                        <span className="text-text-muted">
                          Expected: {formatCurrency(job.finalPriceCents, job.currency)}
                        </span>
                        <span className="text-text-muted">
                          Charges: {formatCurrency(job.totalChargeCents, job.currency)}
                        </span>
                        <span className="text-text-muted">
                          Refunds: {formatCurrency(job.totalRefundCents, job.currency)}
                        </span>
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full border px-2 py-0.5 font-semibold uppercase tracking-micro',
                            paymentClass
                          )}
                        >
                          {job.paymentOk ? 'Debit OK' : 'Check debit'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-xs text-text-muted">
                        <span>Latest: {job.falStatus ?? '—'}</span>
                        <span>Updated: {formatDate(job.falUpdatedAt)}</span>
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full border px-2 py-0.5 font-semibold uppercase tracking-micro',
                            falClass
                          )}
                        >
                          {job.falOk ? 'Fal OK' : 'Fal error'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2 text-xs text-text-muted">
                        <div className="flex flex-col gap-1">
                          {job.receipts.length === 0 ? (
                            <span>No receipts</span>
                          ) : (
                            job.receipts.map((receipt) => (
                              <span key={receipt.id} className="font-mono">
                                {receipt.type} · {formatCurrency(receipt.amountCents, receipt.currency)} ·{' '}
                                {formatDate(receipt.createdAt)}
                              </span>
                            ))
                          )}
                        </div>
                        {job.paymentStatus?.includes('paid_wallet') && job.totalChargeCents > 0 && job.totalRefundCents === 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleRefund(job.jobId)}
                            className="rounded-md border-destructive px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            Refund tokens
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div ref={sentinelRef} className="h-10 w-full" aria-hidden="true" />
      {isLoadingMore ? (
        <div className="text-center text-xs text-text-muted">Loading more jobs…</div>
      ) : null}
      {nextCursor ? (
        <div className="text-center">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadMore()}
            disabled={isLoadingMore}
            className={clsx(
              'gap-2 rounded-md border-border px-3 py-1.5 text-sm font-medium',
              isLoadingMore ? 'cursor-not-allowed opacity-60' : 'hover:border-text-muted hover:bg-surface-2'
            )}
          >
            {isLoadingMore ? 'Loading…' : 'Load more jobs'}
          </Button>
        </div>
      ) : null}
      {!nextCursor && !isLoadingMore ? (
        <div className="text-center text-xs text-text-muted">End of results</div>
      ) : null}
    </section>
  );
}
