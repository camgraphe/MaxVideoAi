import { z } from 'zod';
import { isStablePublicMediaUrl } from '@/lib/media';
import { getFlux3MaxConstraintViolation, parseFlux3MaxKeyframeIndexes } from '@/lib/flux-3-max';
import type { GalleryVideo } from '@/server/videos-normalization';

function isDurablePublicUrl(value: string): boolean {
  if (!isStablePublicMediaUrl(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      !/(^|\.)(fal\.media|fal\.run)$/i.test(url.hostname);
  } catch { return false; }
}

const publicUrl = z.string().refine(isDurablePublicUrl);
const caption = z.string().refine(value => value.trim().length > 0);
const referenceCaptionsSchema = z.array(z.object({ en: caption, fr: caption, es: caption }).strict()).min(1).max(10);
type ReferenceCaptions = z.infer<typeof referenceCaptionsSchema>;
const recipeSchema = z.object({
  jobId: z.string().min(1), engineId: z.literal('flux-3-max'), prompt: z.string().min(1),
  durationSec: z.number().int().min(5).max(20), resolution: z.enum(['720p', '1080p']),
  aspectRatio: z.enum(['auto', '21:9', '2:1', '16:9', '4:3', '1:1', '3:4', '9:16']),
  audio: z.boolean(), reasoningLevel: z.enum(['low', 'high']), seed: z.number().int().safe().nullable(),
  keyframes: z.array(z.object({ imageUrl: publicUrl, frameIndex: z.number().int().min(0) }).strict()).min(1).max(10),
}).strict().refine(value => !getFlux3MaxConstraintViolation('ref2v', {
  prompt: value.prompt, duration: value.durationSec, resolution: value.resolution, aspect_ratio: value.aspectRatio,
  generate_audio: value.audio, reasoning_level: value.reasoningLevel, seed: value.seed ?? undefined,
  reference_image_urls: value.keyframes.map(frame => frame.imageUrl),
  keyframe_indexes: value.keyframes.map(frame => frame.frameIndex).join(','),
}));

export type PublicKeyframeRecipe = z.infer<typeof recipeSchema>;
export type ModelKeyframeDemoSelection = { modelSlug: string; jobId: string; referenceImages: string[]; referenceCaptions?: ReferenceCaptions };
export type PublicKeyframeDemo = { recipe: PublicKeyframeRecipe; videoUrl: string; posterUrl: string; modelName: string; referenceCaptions?: ReferenceCaptions };

export function parsePublicKeyframeRecipe(input: unknown): PublicKeyframeRecipe | null {
  const parsed = recipeSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Only explicitly reviewed reference URLs can become a public teaching recipe. */
export function projectPublicKeyframeDemo(video: GalleryVideo | null, selection: ModelKeyframeDemoSelection): PublicKeyframeDemo | null {
  if (!video || video.id !== selection.jobId || video.engineId !== selection.modelSlug ||
    selection.modelSlug !== 'flux-3-max' || video.visibility !== 'public' || !video.indexable ||
    !video.videoUrl || !isDurablePublicUrl(video.videoUrl) || !video.thumbUrl || !isDurablePublicUrl(video.thumbUrl)) return null;
  const snapshot = record(video.settingsSnapshot);
  const core = record(snapshot.core);
  const advanced = record(snapshot.advanced);
  const extras = record(advanced.extraInputValues);
  const refs = record(snapshot.refs);
  if (snapshot.engineId !== video.engineId || snapshot.inputMode !== 'ref2v' || snapshot.prompt !== video.prompt ||
    core.durationSec !== video.durationSec || !Array.isArray(refs.referenceImages) ||
    JSON.stringify(refs.referenceImages) !== JSON.stringify(selection.referenceImages)) return null;
  const indexes = parseFlux3MaxKeyframeIndexes(extras.keyframe_indexes);
  if (!indexes || indexes.length !== refs.referenceImages.length) return null;
  const captions = referenceCaptionsSchema.optional().safeParse(selection.referenceCaptions);
  if (!captions.success || (captions.data && captions.data.length !== refs.referenceImages.length)) return null;
  const recipe = parsePublicKeyframeRecipe({
    jobId: video.id, engineId: video.engineId, prompt: video.prompt,
    durationSec: core.durationSec, resolution: core.resolution, aspectRatio: core.aspectRatio,
    audio: core.audio, reasoningLevel: extras.reasoning_level ?? 'high', seed: advanced.seed ?? null,
    keyframes: refs.referenceImages.map((imageUrl, index) => ({ imageUrl, frameIndex: indexes[index] })),
  });
  return recipe ? { recipe, videoUrl: video.videoUrl, posterUrl: video.thumbUrl, modelName: video.engineLabel,
    ...(captions.data ? { referenceCaptions: captions.data } : {}) } : null;
}

export function buildPublicKeyframeSettingsSnapshot(recipe: PublicKeyframeRecipe) {
  return {
    schemaVersion: 1, surface: 'video', engineId: recipe.engineId, inputMode: 'ref2v', prompt: recipe.prompt,
    negativePrompt: null,
    core: { durationSec: recipe.durationSec, durationOption: String(recipe.durationSec), resolution: recipe.resolution,
      aspectRatio: recipe.aspectRatio, audio: recipe.audio, fps: 24, iterationCount: 1, numFrames: null },
    advanced: { seed: recipe.seed, extraInputValues: { reasoning_level: recipe.reasoningLevel,
      keyframe_indexes: recipe.keyframes.map(frame => frame.frameIndex).join(',') } },
    refs: {
      referenceImages: recipe.keyframes.map(frame => frame.imageUrl),
      inputs: recipe.keyframes.map((frame, index) => ({ slotId: 'reference_image_urls', kind: 'image',
        url: frame.imageUrl, name: `keyframe-${index + 1}`, type: 'image/*', size: 0 })),
    },
  };
}
