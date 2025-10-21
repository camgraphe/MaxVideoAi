'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { Job } from '@/types/jobs';
import type { GroupSummary } from '@/types/groups';
import { hideJob, useEngines, useInfiniteJobs } from '@/lib/api';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import { normalizeGroupSummaries } from '@/lib/normalize-group-summary';

interface Props {
  engine: EngineCaps;
  activeGroups?: GroupSummary[];
  onOpenGroup?: (group: GroupSummary) => void;
  onGroupAction?: (group: GroupSummary, action: GroupedJobAction) => void;
}

interface SnackbarAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
}

interface SnackbarState {
  message: string;
  actions?: SnackbarAction[];
  duration?: number;
}

export function GalleryRail({
  engine,
  activeGroups = [],
  onOpenGroup,
  onGroupAction,
}: Props) {
  const { data, error, isLoading, isValidating, setSize, mutate } = useInfiniteJobs(24);
  const { data: enginesData } = useEngines();
  const engineList = useMemo(() => enginesData?.engines ?? [], [enginesData?.engines]);
  const jobs = useMemo(() => data?.flatMap((page) => page.jobs) ?? [], [data]);
  const hasCuratedJobs = useMemo(() => jobs.some((job) => job.curated), [jobs]);
  const { groups: groupedJobSummariesFromApi } = useMemo(
    () => groupJobsIntoSummaries(jobs, { includeSinglesAsGroups: true }),
    [jobs]
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleHidden = () => {
      void mutate();
    };
    window.addEventListener('jobs:hidden', handleHidden);
    return () => window.removeEventListener('jobs:hidden', handleHidden);
  }, [mutate]);

  const groupedJobSummaries = useMemo(
    () => [...groupedJobSummariesFromApi].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [groupedJobSummariesFromApi]
  );
  const activeGroupIds = useMemo(() => new Set(activeGroups.map((group) => group.id)), [activeGroups]);
  const historicalGroups = useMemo(() => {
    return groupedJobSummaries.filter((group) => !activeGroupIds.has(group.id));
  }, [groupedJobSummaries, activeGroupIds]);
  const summaryIndex = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    [...activeGroups, ...historicalGroups].forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }, [activeGroups, historicalGroups]);

  const normalizedActiveGroups = useMemo(() => normalizeGroupSummaries(activeGroups), [activeGroups]);
  const normalizedHistoricalGroups = useMemo(
    () => normalizeGroupSummaries(historicalGroups),
    [historicalGroups]
  );
  const combinedGroups = useMemo(
    () => [...normalizedActiveGroups, ...normalizedHistoricalGroups],
    [normalizedActiveGroups, normalizedHistoricalGroups]
  );

  const lastPage = data?.[data.length - 1];
  const hasMore = Boolean(lastPage?.nextCursor);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const handleRemoveJob = useCallback(
    async (job: Job) => {
      if (job.curated) {
        setSnackbar({ message: 'Sample clips cannot be removed.', duration: 2400 });
        return;
      }
      try {
        await hideJob(job.jobId);
        setSnackbar({ message: 'Removed from gallery.', duration: 2400 });
        await mutate(
          (pages) => {
            if (!pages) return pages;
            return pages.map((page) => ({
              ...page,
              jobs: page.jobs.filter((entry) => entry.jobId !== job.jobId),
            }));
          },
          false
        );
      } catch (error) {
        console.error('Failed to hide job', error);
        setSnackbar({ message: 'Unable to remove from gallery.', duration: 2400 });
      }
    },
    [mutate]
  );

  const handleRemoveGroup = useCallback(
    (group: GroupSummary) => {
      if (group.source === 'active' || group.count > 1) return;
      const job = group.hero.job;
      if (!job) return;
      if (job.curated) {
        setSnackbar({ message: 'Sample clips cannot be removed.', duration: 2400 });
        return;
      }
      void handleRemoveJob(job);
    },
    [handleRemoveJob]
  );

  const engineMap = useMemo(() => {
    const map = new Map<string, EngineCaps>();
    engineList.forEach((entry) => {
      map.set(entry.id, entry);
    });
    map.set(engine.id, engine);
    return map;
  }, [engine, engineList]);

  const closeSnackbar = useCallback(() => setSnackbar(null), []);

  const handleCardAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      const original = summaryIndex.get(group.id) ?? group;
      if (action === 'remove') {
        handleRemoveGroup(original);
        return;
      }
      onGroupAction?.(original, action);
    },
    [handleRemoveGroup, onGroupAction, summaryIndex]
  );

  const handleCardOpen = useCallback(
    (group: GroupSummary) => {
      const original = summaryIndex.get(group.id) ?? group;
      onOpenGroup?.(original);
    },
    [onOpenGroup, summaryIndex]
  );

  const allowCardRemoval = useCallback(
    (group: GroupSummary) => {
      const original = summaryIndex.get(group.id) ?? group;
      const job = original.hero.job;
      if (job?.curated) return false;
      return original.source !== 'active' && original.count <= 1;
    },
    [summaryIndex]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || isValidating) return;
    setSize((current) => current + 1);
  }, [hasMore, isLoading, isValidating, setSize]);

  const retry = useCallback(() => {
    void mutate();
  }, [mutate]);

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || !hasMore) return undefined;

    let previousY = 0;
    let previousRatio = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && (entry.boundingClientRect.y > previousY || entry.intersectionRatio > previousRatio)) {
            loadMore();
          }
          previousY = entry.boundingClientRect.y;
          previousRatio = entry.intersectionRatio;
        });
      },
      {
        threshold: 0.2,
        root: scrollContainerRef.current ?? null,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const isInitialLoading = isLoading && jobs.length === 0;
  const isFetchingMore = isValidating && jobs.length > 0;

  return (
    <aside className="hidden xl:flex h-[calc(125vh-var(--header-height))] w-[272px] shrink-0 flex-col border-l border-border bg-bg/80 px-4 pb-6 pt-4">
      <header className="flex items-center justify-between">
        <h2 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Latest renders</h2>
        <Link
          href="/jobs"
          className="rounded-[10px] border border-transparent px-3 py-1 text-[12px] font-medium text-text-muted transition hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all
        </Link>
      </header>

      {hasCuratedJobs ? (
        <div className="mt-3 rounded-[10px] border border-hairline bg-white/80 px-3 py-2 text-[12px] text-text-secondary">
          Starter samples curated by the MaxVideo team are shown until you generate your own videos.
        </div>
      ) : null}

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-[#FACC15]/60 bg-[#FEF3C7] px-3 py-2 text-[12px] text-[#92400E]">
          <span role="alert">Failed to load latest renders. Please retry.</span>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center rounded-[8px] border border-[#92400E]/20 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-[#92400E] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#92400E]/40"
          >
            Retry
          </button>
        </div>
      )}

      <div ref={scrollContainerRef} className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        {combinedGroups.map((group, index) => {
          const engineId = group.hero.engineId;
          const engineEntry = engineId ? engineMap.get(engineId) ?? null : null;
          return (
            <GroupedJobCard
              key={`${group.id}-${index}`}
              group={group}
              engine={engineEntry ?? undefined}
              onOpen={handleCardOpen}
              onAction={handleCardAction}
              allowRemove={allowCardRemoval(group)}
            />
          );
        })}
        {(isInitialLoading || isFetchingMore) &&
          Array.from({ length: isInitialLoading ? 4 : 2 }).map((_, index) => (
            <div key={`rail-skeleton-${index}`} className="rounded-card border border-border bg-white/60 p-0" aria-hidden>
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
        <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
      </div>

      <Snackbar state={snackbar} onClose={closeSnackbar} />
    </aside>
  );
}
function Snackbar({ state, onClose }: { state: SnackbarState | null; onClose: () => void }) {
  useEffect(() => {
    if (!state?.duration) return undefined;
    const timeout = window.setTimeout(onClose, state.duration);
    return () => window.clearTimeout(timeout);
  }, [state, onClose]);

  useEffect(() => {
    if (!state) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [state, onClose]);

  if (!state) return null;

  const actions = state.actions ?? [];

  return createPortal(
    <div className="fixed inset-x-0 bottom-6 z-[9998] flex justify-center px-4">
      <div className="inline-flex max-w-xl flex-wrap items-center gap-3 rounded-[14px] border border-white/15 bg-black/80 px-4 py-3 text-[13px] text-white shadow-lg backdrop-blur">
        <span>{state.message}</span>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  onClose();
                  action.onClick();
                }}
                className={clsx(
                  'inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9DA7B8CC]',
                  action.variant === 'primary'
                    ? 'border-transparent bg-accent text-white hover:brightness-110'
                    : 'border border-white/30 bg-transparent text-white hover:bg-white/10'
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
