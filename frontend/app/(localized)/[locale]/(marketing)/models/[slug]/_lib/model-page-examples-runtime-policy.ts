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

const DECISION_ALT_PREFIX_ENGINE_IDS = new Set([
  'luma-ray-2',
  'lumaRay2',
  'luma-ray-3-2',
  'sora-2-pro',
  'sora-2',
  'ltx-2-3-fast',
  'ltx-2-3-pro',
  'ltx-2-3',
  'kling-3-pro',
  'kling-3-4k',
  'kling-3-standard',
  'veo-3-1-lite',
  'veo-3-1',
  'veo-3-1-fast',
  'seedance-2-0-fast',
  'seedance-1-5-pro',
]);

export type ModelExamplesRuntimePolicy = {
  audioMode: 'runtime' | 'silent';
  previewAltMode: 'prompt' | 'numbered-model-example';
  decisionAltMode: 'preview-alt' | 'model-name-prefix';
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
    decisionAltMode: DECISION_ALT_PREFIX_ENGINE_IDS.has(engineId)
      ? 'model-name-prefix'
      : 'preview-alt',
  };
}

export function buildModelExamplePreviewAlts({
  galleryVideos,
  locale,
  modelName,
  mode,
  numberedExampleLabel,
}: {
  galleryVideos: readonly ExampleGalleryVideo[];
  locale: AppLocale;
  modelName: string;
  mode: ModelExamplesRuntimePolicy['previewAltMode'];
  numberedExampleLabel: string;
}): Map<string, string> {
  return dedupeAltsInList(galleryVideos.slice(0, 6).map((video, index) => {
    const prompt = video.promptFull ?? video.prompt;
    const tag = inferRenderTag(prompt, locale);
    const label = mode === 'numbered-model-example'
      ? `${modelName} ${tag ? `${tag} ` : ''}${numberedExampleLabel} ${index + 1}`
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
