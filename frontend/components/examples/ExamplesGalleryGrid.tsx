import ExamplesGalleryGridClient, { type ExampleGalleryVideo } from './ExamplesGalleryGrid.client';

export type { ExampleGalleryVideo } from './ExamplesGalleryGrid.client';

export function ExamplesGalleryGrid({
  examples,
  loadMoreLabel = 'Load more examples',
}: {
  examples: ExampleGalleryVideo[];
  loadMoreLabel?: string;
}) {
  return <ExamplesGalleryGridClient examples={examples} loadMoreLabel={loadMoreLabel} />;
}
