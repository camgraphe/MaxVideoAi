'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { Job } from '@/types/jobs';
import type { GroupSummary } from '@/types/groups';
import type { VideoGroup, ResultProvider } from '@/types/video-groups';
import { hideJob, saveImageToLibrary, useEngines, useInfiniteJobs } from '@/lib/api';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import { normalizeGroupSummaries, normalizeGroupSummary } from '@/lib/normalize-group-summary';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { GroupViewerModal } from '@/components/groups/GroupViewerModal';
import { adaptGroupSummary } from '@/lib/video-group-adapter';
import { Button, ButtonLink } from '@/components/ui/Button';

type GalleryVariant = 'desktop' | 'mobile';

interface Props {
  engine: EngineCaps;
  feedType?: 'video' | 'image';
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
    saved: 'Saved to library.',
    saveFailed: 'Unable to save to library.',
    copied: 'Link copied.',
    copyFailed: 'Unable to copy link.',
    noMedia: 'No media available.',
  },
} as const;

type GalleryCopy = typeof DEFAULT_GALLERY_COPY;
const DEFAULT_GROUP_PROVIDER: ResultProvider = 'fal';

export function GalleryRail({
  engine,
  feedType = 'video',
  activeGroups = [],
  onOpenGroup,
  onGroupAction,
  jobFilter,
  variant = 'desktop',
}: Props) {
  const { t } = useI18n();
  const copy = t('workspace.generate.galleryRail', DEFAULT_GALLERY_COPY) as GalleryCopy;
  const { data, error, isLoading, isValidating, setSize, mutate, stableJobs } = useInfiniteJobs(24, { type: feedType });
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

  const resolveAspectRatioLabel = useCallback((group: GroupSummary) => {
    const ratio = group.hero.aspectRatio ?? group.previews.find((preview) => preview.aspectRatio)?.aspectRatio ?? null;
    if (!ratio) return null;
    if (ratio.toLowerCase() === 'auto') return 'Auto';
    return ratio;
  }, []);

  const resolveMediaUrl = useCallback(
    (group: GroupSummary, preferImage: boolean) => {
      if (preferImage) {
        return (
          group.hero.thumbUrl ??
          group.previews.find((preview) => preview.thumbUrl)?.thumbUrl ??
          group.hero.videoUrl ??
          group.previews.find((preview) => preview.videoUrl)?.videoUrl ??
          null
        );
      }
      return (
        group.hero.videoUrl ??
        group.previews.find((preview) => preview.videoUrl)?.videoUrl ??
        group.hero.thumbUrl ??
        group.previews.find((preview) => preview.thumbUrl)?.thumbUrl ??
        null
      );
    },
    []
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

  const handleCardView = useCallback(
    (group: GroupSummary) => {
      const original = summaryIndex.get(group.id) ?? group;
      const normalized = normalizeGroupSummary(original);
      const adapted = adaptGroupSummary(normalized, DEFAULT_GROUP_PROVIDER);
      setViewerGroup(adapted);
    },
    [summaryIndex]
  );

  const handleCardDownload = useCallback(
    (group: GroupSummary) => {
      const original = summaryIndex.get(group.id) ?? group;
      const candidateUrl = resolveMediaUrl(original, feedType === 'image');
      if (!candidateUrl) {
        setSnackbar({ message: copy.snackbar.noMedia, duration: 2400 });
        return;
      }
      const anchor = document.createElement('a');
      anchor.href = candidateUrl;
      anchor.download = '';
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    },
    [copy.snackbar.noMedia, feedType, resolveMediaUrl, summaryIndex]
  );

  const handleCardCopy = useCallback(
    (group: GroupSummary) => {
      const original = summaryIndex.get(group.id) ?? group;
      const candidateUrl = resolveMediaUrl(original, feedType === 'image');
      if (!candidateUrl) {
        setSnackbar({ message: copy.snackbar.noMedia, duration: 2400 });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard
          .writeText(candidateUrl)
          .then(() => setSnackbar({ message: copy.snackbar.copied, duration: 2000 }))
          .catch(() => setSnackbar({ message: copy.snackbar.copyFailed, duration: 2400 }));
      } else {
        setSnackbar({ message: copy.snackbar.copyFailed, duration: 2400 });
      }
    },
    [copy.snackbar.copied, copy.snackbar.copyFailed, copy.snackbar.noMedia, feedType, resolveMediaUrl, summaryIndex]
  );

  const handleCardSaveImage = useCallback(
    (group: GroupSummary) => {
      const original = summaryIndex.get(group.id) ?? group;
      const candidateUrl = resolveMediaUrl(original, true);
      if (!candidateUrl) {
        setSnackbar({ message: copy.snackbar.noMedia, duration: 2400 });
        return;
      }
      void saveImageToLibrary({
        url: candidateUrl,
        jobId: original.hero.jobId ?? original.hero.job?.jobId ?? original.id,
        label: original.hero.prompt ?? undefined,
      })
        .then(() => setSnackbar({ message: copy.snackbar.saved, duration: 2000 }))
        .catch(() => setSnackbar({ message: copy.snackbar.saveFailed, duration: 2400 }));
    },
    [copy.snackbar.noMedia, copy.snackbar.saveFailed, copy.snackbar.saved, resolveMediaUrl, summaryIndex]
  );

  const handleCardAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      const original = summaryIndex.get(group.id) ?? group;
      if (action === 'view') {
        handleCardView(original);
        return;
      }
      if (action === 'download') {
        handleCardDownload(original);
        return;
      }
      if (action === 'copy') {
        handleCardCopy(original);
        return;
      }
      if (action === 'save-image' && feedType === 'image') {
        handleCardSaveImage(original);
        return;
      }
      if (action === 'remove') {
        handleRemoveGroup(original);
        return;
      }
      onGroupAction?.(original, action);
    },
    [
      feedType,
      handleCardCopy,
      handleCardDownload,
      handleCardSaveImage,
      handleCardView,
      handleRemoveGroup,
      onGroupAction,
      summaryIndex,
    ]
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
            metaLabel={feedType === 'image' ? resolveAspectRatioLabel(group) : undefined}
            menuVariant={feedType === 'video' ? 'gallery' : 'gallery-image'}
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
      <ButtonLink
        href="/jobs"
        prefetch={false}
        variant="ghost"
        size="sm"
        className="rounded-input border border-transparent px-3 py-1 text-[12px] font-medium text-text-muted hover:text-text-secondary"
      >
        {copy.viewAll}
      </ButtonLink>
    </header>
  );

  const curatedBanner = hasCuratedJobs ? (
    <div className="rounded-card border border-hairline bg-white/80 px-3 py-2 text-[12px] text-text-secondary">{copy.curated}</div>
  ) : null;

  const errorBanner = error ? (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-[#FACC15]/60 bg-[#FEF3C7] px-3 py-2 text-[12px] text-[#92400E]">
      <span role="alert">{copy.error}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={retry}
        className="rounded-input border-[#92400E]/20 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-[#92400E] hover:bg-white"
      >
        {copy.retry}
      </Button>
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
        <aside className="flex h-[calc(125vh-var(--header-height))] w-full max-w-[312px] shrink-0 flex-col border-l border-border bg-bg/80 px-3 pb-6 pt-4">
          {content}
        </aside>
      ) : (
        <section className="flex w-full flex-col gap-4">
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
      <div className="inline-flex max-w-xl flex-wrap items-center gap-4 rounded-card border border-white/15 bg-black/80 px-4 py-3 text-[13px] text-white shadow-lg backdrop-blur">
        <span>{state.message}</span>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                type="button"
                onClick={() => {
                  onClose();
                  action.onClick();
                }}
                variant="outline"
                size="sm"
                className={clsx(
                  'rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-micro',
                  action.variant === 'primary'
                    ? 'border-transparent bg-brand text-on-brand hover:bg-brandHover'
                    : 'border border-white/30 bg-transparent text-white hover:bg-white/10'
                )}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
