'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { Job } from '@/types/jobs';
import type { GroupSummary } from '@/types/groups';
import type { VideoGroup, ResultProvider } from '@/types/video-groups';
import { hideJob, useEngines, useInfiniteJobs } from '@/lib/api';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import { normalizeGroupSummaries, normalizeGroupSummary } from '@/lib/normalize-group-summary';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { GroupViewerModal } from '@/components/groups/GroupViewerModal';
import { adaptGroupSummary } from '@/lib/video-group-adapter';

type GalleryVariant = 'desktop' | 'mobile';

interface Props {
  engine: EngineCaps;
  activeGroups?: GroupSummary[];
  onOpenGroup?: (group: GroupSummary) => void;
  onGroupAction?: (group: GroupSummary, action: GroupedJobAction) => void;
  jobFilter?: (job: Job) => boolean;
  variant?: GalleryVariant;
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

const DEFAULT_GALLERY_COPY = {
  title: 'Latest renders',
  viewAll: 'View all',
  curated: 'Starter samples curated by the MaxVideo team are shown until you generate your own videos.',
  error: 'Failed to load latest renders. Please retry.',
  retry: 'Retry',
  imageCta: 'Generate images',
  snackbar: {
    samples: 'Sample clips cannot be removed.',
    removed: 'Removed from gallery.',
    failed: 'Unable to remove from gallery.',
  },
} as const;

type GalleryCopy = typeof DEFAULT_GALLERY_COPY;
const DEFAULT_GROUP_PROVIDER: ResultProvider = 'fal';

export function GalleryRail({
  engine,
  activeGroups = [],
  onOpenGroup,
  onGroupAction,
  jobFilter,
  variant = 'desktop',
}: Props) {
  const { t } = useI18n();
  const copy = t('workspace.generate.galleryRail', DEFAULT_GALLERY_COPY) as GalleryCopy;
  const { data, error, isLoading, isValidating, setSize, mutate, stableJobs } = useInfiniteJobs(24, { type: 'video' });
  const { data: enginesData } = useEngines();
  const engineList = useMemo(() => enginesData?.engines ?? [], [enginesData?.engines]);
  const jobs = useMemo(() => {
    if (Array.isArray(stableJobs) && stableJobs.length) return stableJobs;
    return data?.flatMap((page) => page.jobs) ?? [];
  }, [data, stableJobs]);
  const filteredJobs = useMemo(() => {
    if (!jobFilter) return jobs;
    return jobs.filter(jobFilter);
  }, [jobFilter, jobs]);
  const hasCuratedJobs = useMemo(() => filteredJobs.some((job) => job.curated), [filteredJobs]);
  const { groups: groupedJobSummariesFromApi } = useMemo(
    () => groupJobsIntoSummaries(filteredJobs, { includeSinglesAsGroups: true }),
    [filteredJobs]
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

  const combinedGroups = useMemo(() => {
    const nonCurated = [...normalizedActiveGroups, ...normalizedHistoricalGroups].filter(
      (group) => !group.hero.job?.curated
    );
    if (nonCurated.length) return nonCurated;
    return [...normalizedActiveGroups, ...normalizedHistoricalGroups];
  }, [normalizedActiveGroups, normalizedHistoricalGroups]);
  const [viewerGroup, setViewerGroup] = useState<VideoGroup | null>(null);

  const lastPage = data?.[data.length - 1];
  const hasMore = Boolean(lastPage?.nextCursor);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const isDesktopVariant = variant === 'desktop';
  const handleRemoveJob = useCallback(
    async (job: Job) => {
      if (job.curated) {
        setSnackbar({ message: copy.snackbar.samples, duration: 2400 });
        return;
      }
      try {
        await hideJob(job.jobId);
        setSnackbar({ message: copy.snackbar.removed, duration: 2400 });
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
        setSnackbar({ message: copy.snackbar.failed, duration: 2400 });
      }
    },
    [copy.snackbar.failed, copy.snackbar.removed, copy.snackbar.samples, mutate]
  );

  const handleRemoveJobId = useCallback(
    async (jobId: string) => {
      try {
        await hideJob(jobId);
        setSnackbar({ message: copy.snackbar.removed, duration: 2400 });
        await mutate(
          (pages) => {
            if (!pages) return pages;
            return pages.map((page) => ({
              ...page,
              jobs: page.jobs.filter((entry) => entry.jobId !== jobId),
            }));
          },
          false
        );
      } catch (error) {
        console.error('Failed to hide job', error);
        setSnackbar({ message: copy.snackbar.failed, duration: 2400 });
      }
    },
    [copy.snackbar.failed, copy.snackbar.removed, mutate]
  );

  const handleRemoveGroup = useCallback(
    (group: GroupSummary) => {
      if (activeGroupIds.has(group.id) || group.count > 1) return;
      const jobId = group.hero.job?.jobId ?? group.hero.jobId;
      if (!jobId) return;
      if (group.hero.job?.curated) {
        setSnackbar({ message: copy.snackbar.samples, duration: 2400 });
        return;
      }
      if (group.hero.job) {
        void handleRemoveJob(group.hero.job);
        return;
      }
      void handleRemoveJobId(jobId);
    },
    [activeGroupIds, copy.snackbar.samples, handleRemoveJob, handleRemoveJobId]
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
  const closeViewer = useCallback(() => setViewerGroup(null), []);

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
      if (onOpenGroup) {
        onOpenGroup(original);
        return;
      }
      const normalized = normalizeGroupSummary(original);
      const adapted = adaptGroupSummary(normalized, DEFAULT_GROUP_PROVIDER);
      setViewerGroup(adapted);
    },
    [onOpenGroup, summaryIndex]
  );

  const allowCardRemoval = useCallback(
    (group: GroupSummary) => {
      const original = summaryIndex.get(group.id) ?? group;
      const job = original.hero.job;
      if (job?.curated) return false;
      return !activeGroupIds.has(group.id) && original.count <= 1;
    },
    [activeGroupIds, summaryIndex]
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
        root: isDesktopVariant ? scrollContainerRef.current ?? null : null,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, isDesktopVariant, loadMore]);

  const isInitialLoading = isLoading && filteredJobs.length === 0;
  const isFetchingMore = isValidating && filteredJobs.length > 0;

  const cards = (
    <>
      {combinedGroups.map((group) => {
        const engineId = group.hero.engineId;
        const engineEntry = engineId ? engineMap.get(engineId) ?? null : null;
        const curated = Boolean(group.hero.job?.curated);
        return (
          <GroupedJobCard
            key={group.id}
            group={group}
            engine={engineEntry ?? undefined}
            onOpen={handleCardOpen}
            onAction={handleCardAction}
            allowRemove={allowCardRemoval(group)}
            showImageCta={curated}
            imageCtaLabel={copy.imageCta}
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
    </>
  );

  const header = (
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">{copy.title}</h2>
      <Link
        href="/jobs"
        prefetch={false}
        className="rounded-[10px] border border-transparent px-3 py-1 text-[12px] font-medium text-text-muted transition hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {copy.viewAll}
      </Link>
    </header>
  );

  const curatedBanner = hasCuratedJobs ? (
    <div className="rounded-[10px] border border-hairline bg-white/80 px-3 py-2 text-[12px] text-text-secondary">{copy.curated}</div>
  ) : null;

  const errorBanner = error ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#FACC15]/60 bg-[#FEF3C7] px-3 py-2 text-[12px] text-[#92400E]">
      <span role="alert">{copy.error}</span>
      <button
        type="button"
        onClick={retry}
        className="inline-flex items-center rounded-[8px] border border-[#92400E]/20 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-[#92400E] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#92400E]/40"
      >
        {copy.retry}
      </button>
    </div>
  ) : null;

  const body = (
    <div
      ref={scrollContainerRef}
      className={clsx(
        'mt-1 space-y-4',
        isDesktopVariant ? 'flex-1 overflow-y-auto pr-1 pt-3' : ''
      )}
    >
      {cards}
    </div>
  );

  const content = (
    <>
      {header}
      {curatedBanner}
      {errorBanner}
      {body}
      <Snackbar state={snackbar} onClose={closeSnackbar} />
    </>
  );

  return (
    <>
      {isDesktopVariant ? (
        <aside className="flex h-[calc(125vh-var(--header-height))] w-[272px] shrink-0 flex-col border-l border-border bg-bg/80 px-4 pb-6 pt-4">
          {content}
        </aside>
      ) : (
        <section className="flex w-full flex-col gap-3">
          {content}
        </section>
      )}
      {viewerGroup ? <GroupViewerModal group={viewerGroup} onClose={closeViewer} /> : null}
    </>
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
