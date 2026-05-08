'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { AdminJobAuditRecord } from '@/server/admin-job-audit';
import { JobAuditRows } from '@/components/admin/job-audit/JobAuditRows';
import { Button } from '@/components/ui/Button';

interface JobAuditTableProps {
  initialJobs: AdminJobAuditRecord[];
  initialCursor: string | null;
  filtersQuery: string;
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
              <JobAuditRows
                expandedJobId={expandedJobId}
                jobs={visibleJobs}
                onRefund={handleRefund}
                onRestore={handleRestore}
                onResync={(jobId) => void handleResync(jobId)}
                onToggleExpanded={(jobId) => setExpandedJobId((prev) => (prev === jobId ? null : jobId))}
                syncingJobId={syncingJobId}
              />
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
