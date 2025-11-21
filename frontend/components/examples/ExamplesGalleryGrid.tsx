import ExamplesGalleryGridClient, { type ExampleGalleryVideo } from './ExamplesGalleryGrid.client';

export type { ExampleGalleryVideo } from './ExamplesGalleryGrid.client';

export function ExamplesGalleryGrid({
  initialVideos,
  remainingVideos,
  loadMoreLabel = 'Load more examples',
}: {
  initialVideos: ExampleGalleryVideo[];
  remainingVideos: ExampleGalleryVideo[];
  loadMoreLabel?: string;
}) {
  return <ExamplesGalleryGridClient initialVideos={initialVideos} remainingVideos={remainingVideos} loadMoreLabel={loadMoreLabel} />;
}
