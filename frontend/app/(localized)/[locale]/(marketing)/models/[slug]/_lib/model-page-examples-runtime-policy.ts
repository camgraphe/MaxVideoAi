import type { ExampleGalleryVideo } from '@/components/examples/examples-gallery-types';
import type { AppLocale } from '@/i18n/locales';
import { dedupeAltsInList, getImageAlt, inferRenderTag } from '@/lib/image-alt';

const SILENT_ENGINE_IDS = new Set([
  'minimax-hailuo-02-text',
  'pika-text-to-video',
  'luma-ray-2',
  'lumaRay2',
  'luma-ray-2-flash',
  'lumaRay2_flash',
  'luma-ray-3-2',
]);

const NUMBERED_ALT_MODELS = new Set([
  'seedance-2-0',
  'minimax-hailuo-02-text',
  'wan-2-6',
  'pika-text-to-video',
]);

export type ModelExamplesRuntimePolicy = {
  audioMode: 'runtime' | 'silent';
  previewAltMode: 'prompt' | 'numbered-model-example';
};

export function resolveModelExamplesRuntimePolicy({
  modelSlug,
  engineId,
}: {
  modelSlug: string;
  engineId: string;
}): ModelExamplesRuntimePolicy {
  return {
    audioMode: SILENT_ENGINE_IDS.has(engineId) ? 'silent' : 'runtime',
    previewAltMode: NUMBERED_ALT_MODELS.has(modelSlug) ? 'numbered-model-example' : 'prompt',
  };
}

export function buildModelExamplePreviewAlts({
  galleryVideos,
  locale,
  modelName,
  mode,
}: {
  galleryVideos: readonly ExampleGalleryVideo[];
  locale: AppLocale;
  modelName: string;
  mode: ModelExamplesRuntimePolicy['previewAltMode'];
}): Map<string, string> {
  const exampleLabel = locale === 'fr' ? 'exemple' : locale === 'es' ? 'ejemplo' : 'example';
  return dedupeAltsInList(galleryVideos.slice(0, 6).map((video, index) => {
    const prompt = video.promptFull ?? video.prompt;
    const tag = inferRenderTag(prompt, locale);
    const label = mode === 'numbered-model-example'
      ? `${modelName} ${tag ? `${tag} ` : ''}${exampleLabel} ${index + 1}`
      : prompt;
    return {
      id: video.id,
      alt: getImageAlt({ kind: 'renderThumb', engine: video.engineLabel, label, prompt: label, locale }),
      tag,
      index,
      locale,
    };
  }));
}
