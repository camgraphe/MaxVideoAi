'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { dedupeAltsInList, getImageAlt, inferRenderTag } from '@/lib/image-alt';
import { ExampleGalleryCard } from '@/components/examples/ExampleGalleryCard';
import {
  BATCH_SIZE,
  dedupeExamples,
  DEFAULT_INITIAL_DESKTOP_BATCH,
  DEFAULT_INITIAL_MOBILE_BATCH,
  splitIntoColumns,
} from '@/components/examples/examples-gallery-helpers';
import { useExamplesGalleryColumns } from '@/components/examples/useExamplesGalleryColumns';
import type { ExampleGalleryVideo, ExampleSort } from '@/components/examples/examples-gallery-types';
import masonryStyles from './examples-masonry.module.css';

export type { ExampleGalleryVideo } from '@/components/examples/examples-gallery-types';

export default function ExamplesGalleryGridClient({
  initialExamples,
  detailsCtaLabel = 'View settings & price',
  loadMoreLabel = 'Load more examples',
  loadingLabel = 'Loading…',
  noPreviewLabel = 'No preview',
  prioritizeFirstPoster = false,
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
  detailsCtaLabel?: string;
  loadMoreLabel?: string;
  loadingLabel?: string;
  noPreviewLabel?: string;
  prioritizeFirstPoster?: boolean;
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
  const baseAll = useMemo(() => dedupeExamples(initialExamples), [initialExamples]);
  const columnCount = useExamplesGalleryColumns();
  const [nextOffset, setNextOffset] = useState(() => initialOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleVideos, setVisibleVideos] = useState<ExampleGalleryVideo[]>(() =>
    baseAll.slice(0, initialDesktopBatch)
  );

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
    if (isLoading || nextOffset >= pageOffsetEnd) return;
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
        if (engineFilter) params.set('engine', engineFilter);
        if (locale) params.set('locale', locale);

        const res = await fetch(`/api/examples?${params.toString()}`, { method: 'GET' });
        const payload = await res.json();
        if (!res.ok || !payload?.ok) {
          localOffset += fetchLimit;
          continue;
        }
        const incoming = Array.isArray(payload.cards) ? payload.cards : [];
        if (incoming.length) {
          setVisibleVideos((prev) => dedupeExamples([...prev, ...incoming]));
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
          {visibleVideos.map((video) => (
            <ExampleGalleryCard
              key={video.id}
              video={video}
              isFirst={video.id === firstVisibleId}
              forceExclusivePlay={false}
              enableTallCardLayout={false}
              enableInlineVideo={false}
              detailsCtaLabel={detailsCtaLabel}
              noPreviewLabel={noPreviewLabel}
              prioritizePoster={prioritizeFirstPoster && video.id === firstVisibleId}
              audioAvailableLabel={audioAvailableLabel}
              locale={locale}
              altText={resolveAltText(video, altById, locale)}
            />
          ))}
        </div>
      ) : (
        <div className={masonryStyles.masonry}>
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className={masonryStyles.column}>
              {column.map((video) => (
                <ExampleGalleryCard
                  key={video.id}
                  video={video}
                  isFirst={video.id === firstVisibleId}
                  forceExclusivePlay={false}
                  enableTallCardLayout={shouldUseTallCardLayout}
                  enableInlineVideo
                  detailsCtaLabel={detailsCtaLabel}
                  noPreviewLabel={noPreviewLabel}
                  prioritizePoster={prioritizeFirstPoster && video.id === firstVisibleId}
                  audioAvailableLabel={audioAvailableLabel}
                  locale={locale}
                  altText={resolveAltText(video, altById, locale)}
                />
              ))}
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

function resolveAltText(video: ExampleGalleryVideo, altById: Map<string, string>, locale: string) {
  return (
    altById.get(video.id) ??
    getImageAlt({
      kind: 'renderThumb',
      engine: video.engineLabel,
      label: locale === 'en' ? video.prompt : video.engineLabel,
      locale,
    })
  );
}
