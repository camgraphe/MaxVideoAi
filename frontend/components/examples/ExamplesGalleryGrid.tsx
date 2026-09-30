import ExamplesGalleryGridClient from './ExamplesGalleryGrid.client';
import type { ExamplesGalleryProps } from './examples-gallery-props';
export type { ExampleGalleryVideo } from './examples-gallery-types';
export function ExamplesGalleryGrid(props:ExamplesGalleryProps) {
  const initialExamples = props.initialExamples.map(example => {
    const summary = { ...example };
    delete summary.promptFull;
    return summary;
  });
  return <ExamplesGalleryGridClient {...props} initialExamples={initialExamples} />;
}
