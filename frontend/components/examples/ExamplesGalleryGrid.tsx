import ExamplesGalleryGridClient from './ExamplesGalleryGrid.client';
import type { ExamplesGalleryProps } from './examples-gallery-props';
export type { ExampleGalleryVideo } from './examples-gallery-types';
export function ExamplesGalleryGrid(props:ExamplesGalleryProps) {
  return <ExamplesGalleryGridClient {...props} />;
}
