import { quoteCurrentExamplePrices, type CurrentExamplePrice } from '@/server/current-example-price';
import { buildExamplesGalleryData } from './examples-page-data';

type GalleryInput = Omit<Parameters<typeof buildExamplesGalleryData>[0], 'currentPrices'>;

export function prepareCurrentExamplesGalleryData(input: GalleryInput) {
  // Observe rejection immediately, even when an empty/filtered gallery never renders a price slot.
  // A failed optional quote cannot hide the posters or expose a historical amount.
  const currentPrices = quoteCurrentExamplePrices(input.allVideos)
    .catch(() => new Map<string, CurrentExamplePrice>());
  return { ...buildExamplesGalleryData(input), currentPrices };
}
