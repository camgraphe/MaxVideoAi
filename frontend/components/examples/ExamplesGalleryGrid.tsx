import ExamplesGalleryGridClient, { type ExampleGalleryVideo } from './ExamplesGalleryGrid.client';

export type { ExampleGalleryVideo } from './ExamplesGalleryGrid.client';

export function ExamplesGalleryGrid({
  initialExamples,
  detailsCtaLabel = 'View settings & price',
  loadMoreLabel = 'Load more examples',
  loadingLabel = 'Loading…',
  noPreviewLabel = 'No preview',
  prioritizeFirstPoster = false,
  audioAvailableLabel = 'Audio available on playback',
  initialDesktopBatch = 8,
  initialMobileBatch = 4,
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
  sort: 'playlist' | 'date-desc' | 'date-asc' | 'duration-asc' | 'duration-desc' | 'engine-asc';
  engineFilter?: string | null;
  initialOffset: number;
  pageOffsetEnd: number;
  locale: string;
}) {
  return (
    <ExamplesGalleryGridClient
      detailsCtaLabel={detailsCtaLabel}
      initialExamples={initialExamples}
      loadMoreLabel={loadMoreLabel}
      loadingLabel={loadingLabel}
      noPreviewLabel={noPreviewLabel}
      prioritizeFirstPoster={prioritizeFirstPoster}
      audioAvailableLabel={audioAvailableLabel}
      initialDesktopBatch={initialDesktopBatch}
      initialMobileBatch={initialMobileBatch}
      sort={sort}
      engineFilter={engineFilter}
      initialOffset={initialOffset}
      pageOffsetEnd={pageOffsetEnd}
      locale={locale}
    />
  );
}
