'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { Job } from '@/types/jobs';
import type { GroupSummary } from '@/types/groups';
import type { VideoGroup } from '@/types/video-groups';
import { saveImageToLibrary, useEngines, useInfiniteJobs } from '@/lib/api';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import type { GroupedJobAction } from '@/components/GroupedJobCard';
import { normalizeGroupSummaries, normalizeGroupSummary } from '@/lib/normalize-group-summary';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { GroupViewerModal } from '@/components/groups/GroupViewerModal';
import { adaptGroupSummary } from '@/lib/video-group-adapter';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { copyTextToClipboard } from '@/lib/clipboard';
import { isExpiredRefundedFailedGalleryItem } from '@/lib/gallery-retention';
import { PRIMARY_VIDEO_READY_EVENT } from '@/lib/video-warmup-events';
import { GalleryRailCards } from './GalleryRailCards';
import { GalleryRailSnackbar, type SnackbarState } from './GalleryRailSnackbar';
import { GalleryRailCuratedBanner, GalleryRailErrorBanner, GalleryRailHeader } from './GalleryRailStatus';
import {
  DEFAULT_GALLERY_COPY,
  DEFAULT_GROUP_PROVIDER,
  INITIAL_EAGER_PREVIEW_COUNT,
  filterGalleryFeedJobs,
  resolveAspectRatioLabel,
  resolveBackgroundWarmPreviewLimit,
  resolveDisplayedActiveGroup,
  resolveMediaUrl,
  type GalleryCopy,
  type GalleryFeedType,
  type GalleryVariant,
} from './gallery-rail-utils';
import { useGalleryRailScrollbar } from './useGalleryRailScrollbar';

export interface GalleryFeedState {
  visibleGroups: GroupSummary[];
  sampleOnly: boolean;
}

export interface GalleryRailProps {
  engine: EngineCaps;
  engineRegistry?: EngineCaps[];
  feedType?: GalleryFeedType;
  activeGroups?: GroupSummary[];
  onOpenGroup?: (group: GroupSummary) => void;
  onGroupAction?: (group: GroupSummary, action: GroupedJobAction, options?: { autoPlayPreview?: boolean }) => void;
  onFeedStateChange?: (state: GalleryFeedState) => void;
  jobFilter?: (job: Job) => boolean;
  variant?: GalleryVariant;
}

const BACKGROUND_WARM_START_DELAY_MS = 200;
const BACKGROUND_WARM_STEP_DELAY_MS = 900;

export function GalleryRail({
  engine,
  engineRegistry,
  feedType = 'video',
  activeGroups = [],
  onOpenGroup,
  onGroupAction,
  onFeedStateChange,
  jobFilter,
  variant = 'desktop',
}: GalleryRailProps) {
  const { t } = useI18n();
  const copy = t('workspace.generate.galleryRail', DEFAULT_GALLERY_COPY) as GalleryCopy;
  const { data, error, isLoading, isValidating, setSize, mutate, stableJobs } = useInfiniteJobs(24, { type: feedType });
  const [backgroundWarmCount, setBackgroundWarmCount] = useState(INITIAL_EAGER_PREVIEW_COUNT);
  const hasEngineRegistry = Array.isArray(engineRegistry) && engineRegistry.length > 0;
  const { data: enginesData } = useEngines('video', { includeAverages: false, enabled: !hasEngineRegistry });
  const engineList = useMemo(
    () => (hasEngineRegistry ? engineRegistry : enginesData?.engines ?? []),
    [engineRegistry, enginesData?.engines, hasEngineRegistry]
  );
  const jobs = useMemo(() => {
    if (Array.isArray(stableJobs) && stableJobs.length) return stableJobs;
    return data?.flatMap((page) => page.jobs) ?? [];
  }, [data, stableJobs]);

  useEffect(() => {
    setBackgroundWarmCount(INITIAL_EAGER_PREVIEW_COUNT);
  }, [feedType]);

  const surfaceSafeJobs = useMemo(() => {
    return filterGalleryFeedJobs(feedType, jobs);
  }, [feedType, jobs]);
  const filteredJobs = useMemo(() => {
    if (!jobFilter) return surfaceSafeJobs;
    return surfaceSafeJobs.filter(jobFilter);
  }, [jobFilter, surfaceSafeJobs]);
  const [currentVisibilityTime, setCurrentVisibilityTime] = useState(0);
  const visibleJobs = useMemo(() => {
    return filteredJobs.filter((job) => !isExpiredRefundedFailedGalleryItem(job, currentVisibilityTime));
  }, [filteredJobs, currentVisibilityTime]);
  const hasCuratedJobs = useMemo(() => visibleJobs.some((job) => job.curated), [visibleJobs]);
  const { groups: groupedJobSummariesFromApi } = useMemo(
    () => groupJobsIntoSummaries(visibleJobs, { includeSinglesAsGroups: true }),
    [visibleJobs]
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleHidden = () => {
      void mutate();
    };
    window.addEventListener('jobs:hidden', handleHidden);
    return () => window.removeEventListener('jobs:hidden', handleHidden);
  }, [mutate]);
  useEffect(() => {
    setCurrentVisibilityTime(Date.now());
    const intervalId = window.setInterval(() => {
      setCurrentVisibilityTime(Date.now());
    }, 5_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const groupedJobSummaries = useMemo(
    () => [...groupedJobSummariesFromApi].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [groupedJobSummariesFromApi]
  );
  const activeGroupIds = useMemo(() => new Set(activeGroups.map((group) => group.id)), [activeGroups]);
  const historicalGroupMap = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    groupedJobSummaries.forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }, [groupedJobSummaries]);
  const displayActiveGroups = useMemo(
    () =>
      activeGroups.map((group) =>
        resolveDisplayedActiveGroup(feedType, group, historicalGroupMap.get(group.id))
      ),
    [activeGroups, feedType, historicalGroupMap]
  );
  const historicalGroups = useMemo(() => {
    return groupedJobSummaries.filter((group) => !activeGroupIds.has(group.id));
  }, [groupedJobSummaries, activeGroupIds]);
  const summaryIndex = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    [...displayActiveGroups, ...historicalGroups].forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }, [displayActiveGroups, historicalGroups]);

  const normalizedActiveGroups = useMemo(() => normalizeGroupSummaries(displayActiveGroups), [displayActiveGroups]);
  const normalizedHistoricalGroups = useMemo(
    () => normalizeGroupSummaries(historicalGroups),
    [historicalGroups]
  );
  const [hasMounted, setHasMounted] = useState(false);

  const combinedGroups = useMemo(() => {
    const nonCurated = [...normalizedActiveGroups, ...normalizedHistoricalGroups].filter(
      (group) => !group.hero.job?.curated
    );
    if (nonCurated.length) return nonCurated;
    return [...normalizedActiveGroups, ...normalizedHistoricalGroups];
  }, [normalizedActiveGroups, normalizedHistoricalGroups]);
  const renderedGroups = useMemo(() => (hasMounted ? combinedGroups : []), [combinedGroups, hasMounted]);
  useEffect(() => {
    if (feedType !== 'video') return undefined;

    let timers: number[] = [];
    const clearTimers = () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers = [];
    };
    const handlePrimaryReady = () => {
      clearTimers();
      const targetCount = Math.min(
        resolveBackgroundWarmPreviewLimit(variant),
        Math.max(INITIAL_EAGER_PREVIEW_COUNT, renderedGroups.length)
      );
      for (let count = INITIAL_EAGER_PREVIEW_COUNT + 1; count <= targetCount; count += 1) {
        const delay =
          BACKGROUND_WARM_START_DELAY_MS +
          (count - INITIAL_EAGER_PREVIEW_COUNT - 1) * BACKGROUND_WARM_STEP_DELAY_MS;
        timers.push(
          window.setTimeout(() => {
            setBackgroundWarmCount((current) => Math.max(current, count));
          }, delay)
        );
      }
    };

    const warmupWindow = window as Window & { __maxVideoPrimaryVideoReady?: boolean };
    window.addEventListener(PRIMARY_VIDEO_READY_EVENT, handlePrimaryReady);
    if (warmupWindow.__maxVideoPrimaryVideoReady) {
      handlePrimaryReady();
    }
    return () => {
      clearTimers();
      window.removeEventListener(PRIMARY_VIDEO_READY_EVENT, handlePrimaryReady);
    };
  }, [feedType, renderedGroups.length, variant]);
  const sampleOnly = useMemo(
    () => renderedGroups.length > 0 && renderedGroups.every((group) => group.hero.job?.curated === true),
    [renderedGroups]
  );
  const [viewerGroup, setViewerGroup] = useState<VideoGroup | null>(null);

  const lastPage = data?.[data.length - 1];
  const hasMore = Boolean(lastPage?.nextCursor);
  const isDesktopVariant = variant === 'desktop';
  const isInitialLoading = hasMounted && isLoading && filteredJobs.length === 0;
  const isFetchingMore = hasMounted && isValidating && filteredJobs.length > 0;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const {
    handleRailPointerDown,
    handleRailPointerMove,
    handleRailPointerUp,
    railThumbHeight,
    railThumbOffset,
    railTrackHeight,
    railTrackRef,
    scrollContainerRef,
    showRail,
  } = useGalleryRailScrollbar({
    isDesktopVariant,
    refreshKey: `${isFetchingMore}:${isInitialLoading}:${renderedGroups.length}`,
  });

  useEffect(() => {
    setHasMounted(true);
  }, []);
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

  const handleCardOpen = useCallback(
    (group: GroupSummary) => {
      const original = summaryIndex.get(group.id) ?? group;
      if (feedType === 'video' && onGroupAction) {
        onGroupAction(original, 'open', { autoPlayPreview: true });
        return;
      }
      if (onOpenGroup) {
        onOpenGroup(original);
        return;
      }
      const normalized = normalizeGroupSummary(original);
      const adapted = adaptGroupSummary(normalized, DEFAULT_GROUP_PROVIDER);
      setViewerGroup(adapted);
    },
    [feedType, onGroupAction, onOpenGroup, summaryIndex]
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
      triggerAppDownload(candidateUrl, suggestDownloadFilename(candidateUrl, feedType === 'image' ? 'gallery-image' : 'gallery-video'));
    },
    [copy.snackbar.noMedia, feedType, summaryIndex]
  );

  const handleCardCopy = useCallback(
    (group: GroupSummary) => {
      const original = summaryIndex.get(group.id) ?? group;
      const candidateUrl = resolveMediaUrl(original, feedType === 'image');
      if (!candidateUrl) {
        setSnackbar({ message: copy.snackbar.noMedia, duration: 2400 });
        return;
      }
      void copyTextToClipboard(candidateUrl).then((copied) => {
        setSnackbar({ message: copied ? copy.snackbar.copied : copy.snackbar.copyFailed, duration: copied ? 2000 : 2400 });
      });
    },
    [copy.snackbar.copied, copy.snackbar.copyFailed, copy.snackbar.noMedia, feedType, summaryIndex]
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
    [copy.snackbar.noMedia, copy.snackbar.saveFailed, copy.snackbar.saved, summaryIndex]
  );

  const handleCardAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      const original = summaryIndex.get(group.id) ?? group;
      if (action === 'open') {
        if (feedType === 'video' && onGroupAction) {
          onGroupAction(original, 'open', { autoPlayPreview: true });
          return;
        }
        handleCardOpen(original);
        return;
      }
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
        return;
      }
      onGroupAction?.(original, action);
    },
    [
      feedType,
      handleCardCopy,
      handleCardDownload,
      handleCardSaveImage,
      handleCardOpen,
      handleCardView,
      onGroupAction,
      summaryIndex,
    ]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || isValidating) return;
    setSize((current) => current + 1);
  }, [hasMore, isLoading, isValidating, setSize]);

  const retry = useCallback(() => {
    void mutate();
  }, [mutate]);

  useEffect(() => {
    onFeedStateChange?.({ visibleGroups: renderedGroups, sampleOnly });
  }, [onFeedStateChange, renderedGroups, sampleOnly]);

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
  }, [hasMore, isDesktopVariant, loadMore, scrollContainerRef]);

  const cards = (
    <GalleryRailCards
      backgroundWarmCount={backgroundWarmCount}
      engineMap={engineMap}
      feedType={feedType}
      groups={renderedGroups}
      isFetchingMore={isFetchingMore}
      isInitialLoading={isInitialLoading}
      onCardAction={handleCardAction}
      onCardOpen={handleCardOpen}
      resolveAspectRatioLabel={resolveAspectRatioLabel}
      sentinelRef={sentinelRef}
    />
  );

  const body = (
    <div className={clsx('relative', isDesktopVariant ? 'flex-1 min-h-0' : '')}>
      <div
        ref={scrollContainerRef}
        className={clsx(
          'scrollbar-rail mt-1 space-y-4',
          isDesktopVariant ? 'h-full overflow-y-auto pr-6 pt-3' : ''
        )}
      >
        {cards}
      </div>
      {isDesktopVariant && showRail ? (
        <div className="absolute right-2 top-3">
          <div
            ref={railTrackRef}
            className="relative w-[4px] cursor-pointer touch-none rounded-full bg-brand/25"
            style={{ height: `${railTrackHeight}px` }}
            onPointerDown={handleRailPointerDown}
            onPointerMove={handleRailPointerMove}
            onPointerUp={handleRailPointerUp}
            onPointerCancel={handleRailPointerUp}
          >
            <div
              className="absolute left-0 top-0 w-full rounded-full bg-brand"
              style={{ height: `${railThumbHeight}px`, transform: `translateY(${railThumbOffset}px)` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );

  const content = (
    <>
      <GalleryRailHeader title={copy.title} viewAll={copy.viewAll} />
      <GalleryRailCuratedBanner copy={copy.curated} show={hasMounted && hasCuratedJobs} />
      <GalleryRailErrorBanner copy={copy.error} retryLabel={copy.retry} show={hasMounted && Boolean(error)} onRetry={retry} />
      {body}
      <GalleryRailSnackbar state={snackbar} onClose={closeSnackbar} />
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
