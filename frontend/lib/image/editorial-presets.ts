import klingImageIllustrations from '../../config/model-kling-image-4-illustrations.json';
import startFrames from '../../config/model-cinematic-start-frames.json';
import { listSeedreamEditorialImages } from '../seedream-editorial-images';
import type { PublicModelQuoteInput } from '../pricing-public-model-contract';

/** Public examples are selected by ID, never by caller-supplied prompts or reference URLs. */
export function getImageEditorialPreset(engineId: string, exampleId: string, origin = 'https://maxvideoai.com') {
  const images = listSeedreamEditorialImages(engineId);
  const image = images.find(item => item.id === exampleId);
  if (image) {
    const source = images.find(item => item.id === image.sourceImageId);
    const quoteInput: PublicModelQuoteInput = { modelId: engineId, mode: image.settings.mode, durationSec: 1,
      resolution: image.settings.resolution, aspectRatio: image.settings.aspectRatio, referenceImageCount: source ? 1 : 0 };
    return {
      quoteInput,
      snapshot: { schemaVersion: 1, surface: 'image', engineId, inputMode: image.settings.mode, prompt: image.prompt,
        core: { ...image.settings }, refs: { imageUrls: source ? [new URL(source.original.url, origin).href] : [] } },
    };
  }
  if (engineId === klingImageIllustrations.modelSlug) {
    const illustration = klingImageIllustrations.assets.find(item => item.id === exampleId);
    if (!illustration) return null;
    const core = { resolution: '2K', aspectRatio: '3:2', numImages: 1 };
    const quoteInput: PublicModelQuoteInput = { modelId: engineId, mode: 't2i', durationSec: 1,
      resolution: core.resolution, aspectRatio: core.aspectRatio, quantity: core.numImages, referenceImageCount: 0 };
    return {
      quoteInput,
      // The prompt is a starting point for Kling Image. The illustration is never imported.
      snapshot: { schemaVersion: 1, surface: 'image', engineId, inputMode: 't2i', prompt: illustration.prompt, core, refs: { imageUrls: [] as string[] } },
    };
  }
  if (engineId !== 'gpt-image-2-6-sunburst') return null;
  const frame = startFrames.find(item => item.id === exampleId && item.sourceEngineId === engineId);
  if (!frame) return null;
  const customImageSize = { width: frame.original.width, height: frame.original.height };
  const quoteInput: PublicModelQuoteInput = { modelId: engineId, mode: 't2i', durationSec: 1, resolution: 'custom',
    quality: 'max', customImageSize, referenceImageCount: 0 };
  return {
    quoteInput,
    snapshot: { schemaVersion: 1, surface: 'image', engineId, inputMode: 't2i', prompt: frame.prompt,
      core: { numImages: 1, resolution: 'custom', customImageSize, quality: 'max', complexity: 'high', outputFormat: 'png' },
      refs: { imageUrls: [] as string[] } },
  };
}

export function imageEditorialPresetHref(engineId: string, exampleId: string, locale: string) {
  return `/app/image?${new URLSearchParams({ engine: engineId, example: exampleId, lang: locale })}`;
}
