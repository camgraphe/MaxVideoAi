import type { ExampleGalleryVideo, ExampleSort } from './examples-gallery-types';
export type ExamplesGalleryProps = {
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
  openingEnabled?: boolean;
  familyLabel?: string;
};
