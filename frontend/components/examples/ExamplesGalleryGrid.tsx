import ExamplesGalleryGridClient, { type ExampleGalleryVideo } from './ExamplesGalleryGrid.client';

export type { ExampleGalleryVideo } from './ExamplesGalleryGrid.client';

export function ExamplesGalleryGrid({
  initialExamples,
  loadMoreLabel = 'Load more examples',
  sort,
  engineFilter,
  initialOffset,
  pageOffsetEnd,
  locale,
}: {
  initialExamples: ExampleGalleryVideo[];
  loadMoreLabel?: string;
  sort: 'playlist' | 'date-desc' | 'date-asc' | 'duration-asc' | 'duration-desc' | 'engine-asc';
  engineFilter?: string | null;
  initialOffset: number;
  pageOffsetEnd: number;
  locale: string;
}) {
  return (
    <ExamplesGalleryGridClient
      initialExamples={initialExamples}
      loadMoreLabel={loadMoreLabel}
      sort={sort}
      engineFilter={engineFilter}
      initialOffset={initialOffset}
      pageOffsetEnd={pageOffsetEnd}
      locale={locale}
    />
  );
}
