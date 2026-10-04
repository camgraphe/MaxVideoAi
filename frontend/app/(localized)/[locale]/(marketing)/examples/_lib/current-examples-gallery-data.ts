import { quoteCurrentExamplePrices } from '@/server/current-example-price';
import { buildExamplesGalleryData } from './examples-page-data';

type GalleryInput = Omit<Parameters<typeof buildExamplesGalleryData>[0], 'currentPrices'>;

export async function buildCurrentExamplesGalleryData(input: GalleryInput) {
  const currentPrices = await quoteCurrentExamplePrices(input.allVideos);
  return buildExamplesGalleryData({ ...input, currentPrices });
}
