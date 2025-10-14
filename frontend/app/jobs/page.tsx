'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { getJobStatus, hideJob, useEngines, useInfiniteJobs } from '@/lib/api';
import {
  groupJobsIntoSummaries,
  loadPersistedGroupSummaries,
  GROUP_SUMMARIES_UPDATED_EVENT,
  GROUP_SUMMARY_STORAGE_KEY,
} from '@/lib/job-groups';
import type { GroupSummary } from '@/types/groups';
import type { EngineCaps } from '@/types/engines';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { adaptGroupSummary } from '@/lib/video-group-adapter';
import { useResultProvider } from '@/hooks/useResultProvider';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import { GroupViewerModal } from '@/components/groups/GroupViewerModal';
import { normalizeGroupSummaries, normalizeGroupSummary } from '@/lib/normalize-group-summary';

export default function JobsPage() {
  const { data: enginesData } = useEngines();
  const { data, error, isLoading, size, setSize, isValidating, mutate } = useInfiniteJobs(24);
  const { userId, loading: authLoading } = useRequireAuth();

  const pages = data ?? [];
  const jobs = pages.flatMap((p) => p.jobs);
  const hasMore = pages.length === 0 ? false : pages[pages.length - 1].nextCursor !== null;

  const { groups: apiGroups } = useMemo(
    () => groupJobsIntoSummaries(jobs, { includeSinglesAsGroups: true }),
    [jobs]
  );
  const [storedGroups, setStoredGroups] = useState<GroupSummary[]>([]);

  const storageKey = useCallback(
    (base: string) => (userId ? `${base}:${userId}` : base),
    [userId]
  );

  useEffect(() => {
    if (authLoading || typeof window === 'undefined') return;
    const key = storageKey(GROUP_SUMMARY_STORAGE_KEY);
    const sync = () => setStoredGroups(loadPersistedGroupSummaries(key));
    sync();
    window.addEventListener(GROUP_SUMMARIES_UPDATED_EVENT, sync);
    return () => window.removeEventListener(GROUP_SUMMARIES_UPDATED_EVENT, sync);
  }, [authLoading, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleHidden = () => {
      void mutate();
    };
    window.addEventListener('jobs:hidden', handleHidden);
    return () => window.removeEventListener('jobs:hidden', handleHidden);
  }, [mutate]);

  const groupedJobs = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    [...apiGroups, ...storedGroups].forEach((group) => {
      if (!group) return;
      const current = map.get(group.id);
      if (!current || Date.parse(group.createdAt) > Date.parse(current.createdAt)) {
        map.set(group.id, group);
      }
    });
    return Array.from(map.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [apiGroups, storedGroups]);

  const engineLookup = useMemo(() => {
    const byId = new Map<string, EngineCaps>();
    (enginesData?.engines ?? []).forEach((engine) => {
      byId.set(engine.id, engine);
    });
    return { byId };
  }, [enginesData?.engines]);

  const provider = useResultProvider();

  const handleRefreshJob = useCallback(async (jobId: string) => {
    try {
      const status = await getJobStatus(jobId);
      if (status.status === 'failed') {
        throw new Error(status.message ?? 'Provider reported this render as failed.');
      }
      if (status.status !== 'completed' && !status.videoUrl) {
        throw new Error('The provider is still processing this render.');
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unable to refresh render status.');
    }
  }, []);

  const summaryMap = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    groupedJobs.forEach((group) => map.set(group.id, group));
    return map;
  }, [groupedJobs]);

  const normalizedGroups = useMemo(() => normalizeGroupSummaries(groupedJobs), [groupedJobs]);
  const normalizedGroupMap = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    normalizedGroups.forEach((group) => map.set(group.id, group));
    return map;
  }, [normalizedGroups]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const handleRemoveVideoGroup = useCallback(
    async (group: GroupSummary) => {
      const original = summaryMap.get(group.id);
      if (!original) return;
      const heroJob = original.hero.job;
      if (!heroJob) return;
      try {
        await hideJob(heroJob.jobId);
        setActiveGroupId((current) => (current === group.id ? null : current));
        await mutate(
          (pages) => {
            if (!pages) return pages;
            return pages.map((page) => ({
              ...page,
              jobs: page.jobs.filter((entry) => entry.jobId !== heroJob.jobId),
            }));
          },
          false
        );
      } catch (error) {
        console.error('Failed to hide job', error);
      }
    },
    [mutate, summaryMap]
  );

  const allowRemove = useCallback(
    (group: GroupSummary) => {
      const summary = summaryMap.get(group.id);
      if (!summary) return false;
      return summary.source !== 'active' && summary.count <= 1;
    },
    [summaryMap]
  );

  const handleGroupAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      if (action === 'remove') {
        void handleRemoveVideoGroup(group);
        return;
      }
      if (action === 'open' || action === 'continue' || action === 'refine' || action === 'branch' || action === 'compare') {
        setActiveGroupId(group.id);
      }
    },
    [handleRemoveVideoGroup]
  );

  const handleGroupOpen = useCallback((group: GroupSummary) => {
    setActiveGroupId(group.id);
  }, []);

  const isInitialLoading = isLoading && jobs.length === 0 && normalizedGroups.length === 0;
  const viewerGroup = useMemo(() => {
    if (!activeGroupId) return null;
    const normalized = normalizedGroupMap.get(activeGroupId);
    const fallback = summaryMap.get(activeGroupId);
    const target = normalized ?? (fallback ? normalizeGroupSummary(fallback) : null);
    if (!target) return null;
    return adaptGroupSummary(target, provider);
  }, [activeGroupId, normalizedGroupMap, summaryMap, provider]);

  if (authLoading) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-text-primary">Jobs</h1>
          </div>

          {error ? (
            <div className="rounded-card border border-border bg-white p-4 text-state-warning">
              Failed to load jobs.
              <button
                type="button"
                onClick={() => mutate()}
                className="ml-3 rounded-input border border-border px-2 py-1 text-sm hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {!isInitialLoading && normalizedGroups.length === 0 ? (
                <div className="rounded-card border border-border bg-white p-6 text-center text-sm text-text-secondary">
                  No renders yet. Start a generation to populate your history.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {normalizedGroups.map((group) => {
                    const engineId = group.hero.engineId;
                    const engine = engineId ? engineLookup.byId.get(engineId) ?? null : null;
                    return (
                      <GroupedJobCard
                        key={group.id}
                        group={group}
                        engine={engine ?? undefined}
                        onOpen={handleGroupOpen}
                        onAction={handleGroupAction}
                        allowRemove={allowRemove(group)}
                      />
                    );
                  })}
                  {(isInitialLoading || (isValidating && hasMore)) &&
                    Array.from({ length: isInitialLoading ? 8 : hasMore ? 3 : 0 }).map((_, index) => (
                      <div key={`jobs-skeleton-${index}`} className="rounded-card border border-border bg-white/60 p-0" aria-hidden>
                        <div className="relative overflow-hidden rounded-card">
                          <div className="relative" style={{ aspectRatio: '16 / 9' }}>
                            <div className="skeleton absolute inset-0" />
                          </div>
                        </div>
                        <div className="border-t border-border bg-white/70 px-3 py-2">
                          <div className="h-3 w-24 rounded-full bg-neutral-200" />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}

          <div className="mt-5 flex items-center justify-center">
            {hasMore && !error && (
              <button
                type="button"
                onClick={() => setSize(size + 1)}
                disabled={isValidating}
                className="rounded-input border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary shadow-card hover:bg-white/80 disabled:opacity-60"
              >
                {isValidating ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        </main>
      </div>
      {viewerGroup ? (
        <GroupViewerModal
          group={viewerGroup}
          onClose={() => setActiveGroupId(null)}
          onRefreshJob={handleRefreshJob}
        />
      ) : null}
    </div>
  );
}
