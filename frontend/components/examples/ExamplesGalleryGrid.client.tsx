'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { Button } from '@/components/ui/Button';
import { DeferredSourcePrompt } from '@/components/i18n/DeferredSourcePrompt.client';
import { dedupeAltsInList, getImageAlt, inferRenderTag } from '@/lib/image-alt';
import mediaStyles from './examples-media.module.css';
import masonryStyles from './examples-masonry.module.css';

export type ExampleGalleryVideo = {
  id: string;
  href: string;
  engineLabel: string;
  engineIconId: string;
  engineBrandId?: string;
  priceLabel: string | null;
  prompt: string;
  promptFull?: string | null;
  aspectRatio: string | null;
  durationSec: number;
  hasAudio: boolean;
  heroPosterUrl?: string | null;
  optimizedPosterUrl?: string | null;
  rawPosterUrl?: string | null;
  videoUrl?: string | null;
  previewVideoUrl?: string | null;
  recreateHref?: string | null;
  modelHref?: string | null;
  sourceIndex?: number;
};

const BATCH_SIZE = 8;
const DEFAULT_INITIAL_MOBILE_BATCH = 4;
const DEFAULT_INITIAL_DESKTOP_BATCH = 8;
const LANDSCAPE_SIZES = '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw';
const PORTRAIT_SIZES = '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw';
const DEFAULT_LANDSCAPE_RATIO = 16 / 9;
const DEFAULT_LANDSCAPE_HEIGHT_PERCENT = 100 / DEFAULT_LANDSCAPE_RATIO;
const TALL_CARD_MEDIA_PERCENT = Number((DEFAULT_LANDSCAPE_HEIGHT_PERCENT * 2).toFixed(3));

type ExampleSort = 'playlist' | 'date-desc' | 'date-asc' | 'duration-asc' | 'duration-desc' | 'engine-asc';

function buildWatchAnchorText(locale: string, video: ExampleGalleryVideo): string {
  const ratio = video.aspectRatio ?? 'Auto';
  const duration = `${video.durationSec}s`;
  if (locale === 'fr') {
    return `Voir l'exemple video ${video.engineLabel} - ${video.prompt} - ${ratio} - ${duration}`;
  }
  if (locale === 'es') {
    return `Ver ejemplo de video ${video.engineLabel} - ${video.prompt} - ${ratio} - ${duration}`;
  }
  return `Watch ${video.engineLabel} video example - ${video.prompt} - ${ratio} - ${duration}`;
}

export default function ExamplesGalleryGridClient({
  initialExamples,
  loadMoreLabel = 'Load more examples',
  loadingLabel = 'Loading…',
  noPreviewLabel = 'No preview',
  audioAvailableLabel = 'Audio available on playback',
  initialDesktopBatch = DEFAULT_INITIAL_DESKTOP_BATCH,
  initialMobileBatch = DEFAULT_INITIAL_MOBILE_BATCH,
  sort,
  engineFilter,
  initialOffset,
  pageOffsetEnd,
  locale,
}: {
  initialExamples: ExampleGalleryVideo[];
  loadMoreLabel?: string;
  loadingLabel?: string;
  noPreviewLabel?: string;
  audioAvailableLabel?: string;
  initialDesktopBatch?: number;
  initialMobileBatch?: number;
  sort: ExampleSort;
  engineFilter?: string | null;
  initialOffset: number;
  pageOffsetEnd: number;
  locale: string;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const baseAll = useMemo(() => dedupe(initialExamples), [initialExamples]);
  const columnCount = useColumnCount();
  const [nextOffset, setNextOffset] = useState(() => initialOffset);
  const [isLoading, setIsLoading] = useState(false);

  const [visibleVideos, setVisibleVideos] = useState<ExampleGalleryVideo[]>(() =>
    baseAll.slice(0, initialDesktopBatch)
  );

  // Reset batches when the filtered dataset changes (e.g., engine filter navigation).
  useEffect(() => {
    const nextInitialBatch = isMobile ? initialMobileBatch : initialDesktopBatch;
    setVisibleVideos(baseAll.slice(0, nextInitialBatch));
    setNextOffset(initialOffset);
  }, [baseAll, initialDesktopBatch, initialMobileBatch, initialOffset, isMobile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const syncViewport = () => setIsMobile(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener?.('change', syncViewport);
    return () => {
      mediaQuery.removeEventListener?.('change', syncViewport);
    };
  }, []);

  const handleLoadMore = async () => {
    if (isLoading) return;
    if (nextOffset >= pageOffsetEnd) return;
    setIsLoading(true);
    try {
      let localOffset = nextOffset;
      let didAppend = false;
      while (localOffset < pageOffsetEnd && !didAppend) {
        const remaining = Math.max(0, pageOffsetEnd - localOffset);
        const fetchLimit = Math.max(1, Math.min(BATCH_SIZE, remaining));
        const params = new URLSearchParams();
        params.set('sort', sort);
        params.set('limit', String(fetchLimit));
        params.set('offset', String(localOffset));
        if (engineFilter) {
          params.set('engine', engineFilter);
        }
        if (locale) {
          params.set('locale', locale);
        }
        const res = await fetch(`/api/examples?${params.toString()}`, { method: 'GET' });
        const payload = await res.json();
        if (!res.ok || !payload?.ok) {
          localOffset += fetchLimit;
          continue;
        }
        const incoming = Array.isArray(payload.cards) ? payload.cards : [];
        if (incoming.length) {
          setVisibleVideos((prev) => dedupe([...prev, ...incoming]));
          didAppend = true;
        }
        localOffset += fetchLimit;
      }
      setNextOffset(localOffset);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = useMemo(() => splitIntoColumns(visibleVideos, columnCount), [visibleVideos, columnCount]);
  const altById = useMemo(() => {
    const alts = visibleVideos.map((video, index) => {
      const promptSeed = locale === 'en' ? video.promptFull ?? video.prompt : video.engineLabel;
      const baseAlt = getImageAlt({
        kind: 'renderThumb',
        engine: video.engineLabel,
        label: promptSeed,
        prompt: promptSeed,
        locale,
      });
      return {
        id: video.id,
        alt: baseAlt,
        tag: inferRenderTag(promptSeed, locale),
        index: video.sourceIndex ?? index,
        locale,
      };
    });
    return dedupeAltsInList(alts);
  }, [locale, visibleVideos]);
  const shouldUseTallCardLayout = !isMobile;
  const firstVisibleId = visibleVideos[0]?.id;
  const hasMore = nextOffset < pageOffsetEnd;

  return (
    <div className="space-y-3 p-3 sm:space-y-4 sm:p-6">
      {isMobile ? (
        <div className="flex flex-col gap-3">
          {visibleVideos.map((video) => {
            const isFirstVideo = video.id === firstVisibleId;
            return (
              <ExampleCard
                key={video.id}
                video={video}
                isFirst={isFirstVideo}
                forceExclusivePlay={false}
                enableTallCardLayout={false}
                enableInlineVideo={false}
                showRecreateLink={false}
                noPreviewLabel={noPreviewLabel}
                audioAvailableLabel={audioAvailableLabel}
                locale={locale}
                altText={
                  altById.get(video.id) ??
                  getImageAlt({
                    kind: 'renderThumb',
                    engine: video.engineLabel,
                    label: locale === 'en' ? video.prompt : video.engineLabel,
                    locale,
                  })
                }
              />
            );
          })}
        </div>
      ) : (
        <div className={masonryStyles.masonry}>
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className={masonryStyles.column}>
              {column.map((video) => {
                const isFirstVideo = video.id === firstVisibleId;
                return (
                  <ExampleCard
                    key={video.id}
                    video={video}
                    isFirst={isFirstVideo}
                    forceExclusivePlay={false}
                    enableTallCardLayout={shouldUseTallCardLayout}
                    enableInlineVideo
                    showRecreateLink
                    noPreviewLabel={noPreviewLabel}
                    audioAvailableLabel={audioAvailableLabel}
                    locale={locale}
                    altText={
                      altById.get(video.id) ??
                      getImageAlt({
                        kind: 'renderThumb',
                        engine: video.engineLabel,
                        label: locale === 'en' ? video.prompt : video.engineLabel,
                        locale,
                      })
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
      {hasMore ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoading}
            className="border-brand/40 text-brand shadow-card hover:border-brand hover:bg-brand/10"
          >
            {isLoading ? loadingLabel : loadMoreLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ExampleCard({
  video,
  isFirst,
  forceExclusivePlay,
  enableTallCardLayout,
  enableInlineVideo,
  showRecreateLink,
  noPreviewLabel,
  audioAvailableLabel,
  locale,
  altText,
}: {
  video: ExampleGalleryVideo;
  isFirst: boolean;
  forceExclusivePlay: boolean;
  enableTallCardLayout: boolean;
  enableInlineVideo: boolean;
  showRecreateLink: boolean;
  noPreviewLabel: string;
  audioAvailableLabel: string;
  locale: string;
  altText: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const rawAspect = useMemo(() => (video.aspectRatio ? parseAspectRatio(video.aspectRatio) : 16 / 9), [video.aspectRatio]);
  const isPortrait = rawAspect < 1;
  const posterSizes = isPortrait ? PORTRAIT_SIZES : LANDSCAPE_SIZES;
  const inlineVideoUrl = video.previewVideoUrl ?? video.videoUrl ?? null;
  const shouldLoadVideo = enableInlineVideo && inView && Boolean(inlineVideoUrl);
  const shouldPlay = shouldLoadVideo && (isHovered || isFirst || forceExclusivePlay);
  const mediaPaddingPercent = Number((100 / rawAspect).toFixed(3));
  const tallCardEnabled = enableTallCardLayout && isPortrait;
  const mediaPadding = tallCardEnabled
    ? `calc(${TALL_CARD_MEDIA_PERCENT}% + var(--examples-grid-row-gap, 10px))`
    : `${mediaPaddingPercent}%`;

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setInView(entry.isIntersecting);
      },
      { rootMargin: '120px 0px 120px 0px', threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !shouldPlay) return;
    const pauseOthers = () => {
      if (!forceExclusivePlay) return;
      try {
        document.querySelectorAll('video[data-examples-card]').forEach((el) => {
          if (el !== node) {
            (el as HTMLVideoElement).pause();
          }
        });
      } catch {
        /* ignore */
      }
    };

    const play = async () => {
      try {
        pauseOthers();
        await node.play();
        setVideoReady(true);
      } catch {
        // ignore autoplay failures
      }
    };
    void play();
    return () => {
      node.pause();
    };
  }, [shouldPlay, forceExclusivePlay]);

  // Let next/image optimize the original poster once instead of wrapping a
  // pre-optimized /_next/image URL and breaking the request.
  const posterSrc = video.rawPosterUrl ?? null;
  const watchAnchorText = buildWatchAnchorText(locale, video);
  const playingLabel = locale === 'fr' ? 'Lecture' : locale === 'es' ? 'Reproduciendo' : 'Playing';
  const recreateLabel =
    locale === 'fr' ? 'Recréer ce plan' : locale === 'es' ? 'Recrear esta toma' : 'Recreate this shot';

  return (
    <div
      ref={cardRef}
      className="group relative overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-card focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-bg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        href={video.href}
        className="absolute inset-0 z-0"
        aria-label={altText}
        prefetch={false}
      >
        <span className="sr-only">{watchAnchorText}</span>
      </Link>
      <div className="pointer-events-none relative z-10">
        <div className={clsx(mediaStyles.mediaOuter, 'relative w-full overflow-hidden bg-surface-on-media-dark-5')}>
          <div className="relative w-full" style={{ paddingBottom: mediaPadding }}>
            <div className="absolute inset-0">
              {shouldLoadVideo && inlineVideoUrl ? (
                <video
                  ref={videoRef}
                  muted
                  loop
                  playsInline
                  poster={posterSrc ?? undefined}
                  data-examples-card
                  aria-label={altText}
                  className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.02]"
                >
                  <source src={inlineVideoUrl} type="video/mp4" />
                </video>
              ) : posterSrc ? (
                <Image
                  src={posterSrc}
                  alt={altText}
                  fill
                  className="h-full w-full object-cover object-center"
                  decoding="async"
                  sizes={posterSizes}
                  quality={52}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-placeholder text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                  {noPreviewLabel}
                </div>
              )}
              {video.hasAudio ? <AudioEqualizerBadge tone="light" size="sm" label={audioAvailableLabel} /> : null}
            </div>
          </div>
        </div>
        <div className="space-y-1 px-3 py-2.5 text-left sm:px-4 sm:py-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-micro text-text-muted sm:gap-2 sm:text-xs">
            {video.modelHref ? (
              <Link href={video.modelHref} prefetch={false} className="pointer-events-auto hover:text-text-primary">
                {video.engineLabel}
              </Link>
            ) : (
              <span>{video.engineLabel}</span>
            )}
          </div>
          <DeferredSourcePrompt
            locale={locale}
            prompt={video.prompt}
            mode="inline"
            promptClassName="line-clamp-2 text-[13px] font-semibold leading-snug text-text-primary sm:text-sm"
            fallbackClassName="line-clamp-2 text-[13px] font-semibold leading-snug text-text-primary sm:text-sm"
          />
          <p className="text-[10px] text-text-secondary sm:text-[11px]">
            {video.aspectRatio ?? 'Auto'} · {video.durationSec}s {videoReady ? `· ${playingLabel}` : ''}
          </p>
          {showRecreateLink && video.recreateHref ? (
            <div className="pt-1">
              <Link
                href={video.recreateHref}
                prefetch={false}
                className="pointer-events-auto text-[11px] font-semibold text-brand transition hover:text-brand-hover"
              >
                {recreateLabel} →
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function dedupe(videos: ExampleGalleryVideo[]) {
  const seen = new Set<string>();
  const out: ExampleGalleryVideo[] = [];
  for (const video of videos) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    out.push(video);
  }
  return out;
}

function parseAspectRatio(aspect: string) {
  const [w, h] = aspect.split(':').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return 16 / 9;
  return w / h;
}

function estimateCardHeightWeight(aspectRatio: string | null) {
  const ratio = aspectRatio ? parseAspectRatio(aspectRatio) : DEFAULT_LANDSCAPE_RATIO;
  if (ratio < 0.9) return 1.8;
  if (ratio < 1.1) return 1;
  return 0.6;
}

function splitIntoColumns(videos: ExampleGalleryVideo[], columnCount: number): ExampleGalleryVideo[][] {
  if (!videos.length) return [];
  const safeCount = Math.max(1, Math.floor(columnCount) || 1);
  const count = Math.min(safeCount, videos.length);
  const columns: ExampleGalleryVideo[][] = Array.from({ length: count }, () => []);
  const heights = Array.from({ length: count }, () => 0);

  for (const video of videos) {
    const targetHeight = Math.min(...heights);
    const targetIndex = heights.indexOf(targetHeight);
    columns[targetIndex].push(video);
    heights[targetIndex] += estimateCardHeightWeight(video.aspectRatio);
  }

  return columns;
}

function useColumnCount() {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const twoColumns = window.matchMedia('(max-width: 1279px)');
    const oneColumn = window.matchMedia('(max-width: 767px)');

    const update = () => {
      if (oneColumn.matches) {
        setCount(1);
      } else if (twoColumns.matches) {
        setCount(2);
      } else {
        setCount(3);
      }
    };

    update();
    const unsubscribers = [twoColumns, oneColumn].map((query) => {
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
      }
      query.addListener(update);
      return () => query.removeListener(update);
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  return count;
}
