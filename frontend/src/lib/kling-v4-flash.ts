import { z } from 'zod';
import type { GeneratePayload } from '@/lib/fal-types';
import { KLING_V4_FLASH_ENDPOINTS, KLING_V4_FLASH_PROMPT_MAX_CHARS, KLING_V4_FLASH_REFERENCE_LIMIT } from '@/config/fal-engines/kling-v4-flash';

export { KLING_V4_FLASH_ENDPOINTS };
export type KlingV4FlashMode = keyof typeof KLING_V4_FLASH_ENDPOINTS;
export const isKlingV4FlashEngineId = (id: string | null | undefined): boolean => id?.trim().toLowerCase() === 'kling-v4-flash';
const url = z.string().trim().min(1);
const prompt = z.string().trim().min(1).max(KLING_V4_FLASH_PROMPT_MAX_CHARS);
const element = z.object({ frontal_image_url: url.optional(), reference_image_urls: z.array(url).min(1).max(3).optional(), video_url: url.optional() }).strict().superRefine((value, ctx) => {
  if (value.video_url ? (value.frontal_image_url || value.reference_image_urls) : !(value.frontal_image_url && value.reference_image_urls?.length)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use a subject video or a frontal image with 1–3 additional views.' });
  }
});
const common = { duration: z.number().int().min(3).max(20), resolution: z.literal('720p').optional() };
const schemas = {
  t2v: z.object({ ...common, prompt, aspect_ratio: z.enum(['16:9', '9:16', '1:1', '21:9']).optional() }).strict(),
  i2v: z.object({ ...common, prompt: prompt.optional(), start_image_url: url }).strict(),
  ref2v: z.object({ ...common, prompt, start_image_url: url.optional(), image_urls: z.array(url).max(10).optional(), video_urls: z.array(url).max(5).optional(), elements: z.array(element).max(7).optional(), aspect_ratio: z.enum(['auto', '16:9', '9:16', '1:1', '21:9']).optional() }).strict(),
};
const integer = (value: unknown) => typeof value === 'string' && /^\d+$/u.test(value.trim()) ? Number(value.trim()) : value;

/** Inspect the authored App request before common normalizers drop unsupported fields. */
export function getKlingV4FlashControlViolation(mode: string, body: Record<string, unknown>): string | null {
  if (!Object.hasOwn(KLING_V4_FLASH_ENDPOINTS, mode)) return 'Unsupported Flash mode.';
  for (const field of ['fps', 'seed', 'cfgScale', 'audio', 'generate_audio', 'voiceIds', 'voiceControl', 'shotType', 'cameraFixed', 'loop', 'numFrames', 'audioUrl', 'audio_url', 'safetyChecker', 'endImageUrl', 'videoUrl', 'multiPrompt', 'multi_prompt', 'negativePrompt']) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '') return `Flash does not support ${field}.`;
  }
  if (body.extraInputValues && Object.values(body.extraInputValues as object).some(value => value !== undefined && value !== null)) return 'Flash has no additional provider controls.';
  if (body.resolution !== undefined && body.resolution !== '720p') return 'Flash requires 720p.';
  const duration = integer(body.durationSec ?? body.duration ?? body.durationOption ?? 5);
  if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 3 || duration > 20) return 'Flash requires 3–20 whole seconds.';
  if (body.durationOption != null && integer(body.durationOption) !== duration) return 'Flash duration selectors disagree.';
  return null;
}

export function getKlingV4FlashConstraintViolation(mode: string, input: Record<string, unknown>): { field: string; message: string } | null {
  const invalid = (field: string, message: string) => ({ field, message: `Kling 4.0 Flash ${field}: ${message}` });
  if (!Object.hasOwn(schemas, mode)) return invalid('mode', 'Unsupported mode.');
  const parsed = schemas[mode as KlingV4FlashMode].safeParse({ ...input, duration: integer(input.duration) });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return invalid(issue.code === 'unrecognized_keys' ? issue.keys[0] : issue.path.join('.') || 'input', issue.message);
  }
  if (mode === 'ref2v') {
    const refs = parsed.data as z.infer<typeof schemas.ref2v>;
    const flatImages = (refs.image_urls?.length ?? 0) + Number(Boolean(refs.start_image_url));
    if (flatImages > 10) return invalid('image_urls', 'The opening image counts toward the ten-image limit.');
    if ((refs.elements?.filter(item => item.video_url).length ?? 0) > 3) return invalid('elements', 'Use at most three video subjects.');
    const count = flatImages + (refs.video_urls?.length ?? 0) + (refs.elements ?? []).reduce((n, item) => n + (item.video_url ? 1 : 1 + (item.reference_image_urls?.length ?? 0)), 0);
    if (!count) return invalid('references', 'Reference mode requires visual media.');
    if (count > KLING_V4_FLASH_REFERENCE_LIMIT) return invalid('references', 'This launch supports at most 15 originals, including subject views.');
  }
  return null;
}

export function buildKlingV4FlashFalRequest(payload: GeneratePayload): { model: string; requestBody: Record<string, unknown> } {
  const mode = payload.mode ?? 't2v';
  if (!Object.hasOwn(KLING_V4_FLASH_ENDPOINTS, mode)) throw new Error('Kling 4.0 Flash mode is unsupported.');
  const unsupported = { fps: payload.fps, seed: payload.seed, cfgScale: payload.cfgScale, audio: payload.audio === false ? false : undefined,
    voiceIds: payload.voiceIds?.length ? payload.voiceIds : undefined, shotType: payload.shotType, cameraFixed: payload.cameraFixed,
    loop: payload.loop, numFrames: payload.numFrames, audioUrl: payload.audioUrl, safetyChecker: payload.safetyChecker,
    endImageUrl: payload.endImageUrl, videoUrl: payload.videoUrl, multiPrompt: payload.multiPrompt };
  for (const [field, value] of Object.entries(unsupported)) {
    if (value !== undefined && value !== null) throw new Error(`Kling 4.0 Flash does not expose ${field}.`);
  }
  if (Object.values(payload.extraInputValues ?? {}).some(value => value !== undefined)) throw new Error('Kling 4.0 Flash unsupported extra controls.');
  const inputs = payload.inputs ?? [];
  const imageSlots = ['image_url', 'start_image_url', 'first_frame_url', 'image_urls', 'reference_image_urls', 'reference_images'];
  const videoSlots = ['video_urls', 'reference_video_urls', 'reference_videos'];
  for (const item of inputs) {
    if (!(item.kind === 'image' ? imageSlots : item.kind === 'video' ? videoSlots : []).includes(item.slotId ?? '')) throw new Error('Kling 4.0 Flash unsupported attachment.');
  }
  const read = (item: (typeof inputs)[number] | undefined) => item?.url?.trim() || item?.dataUrl?.trim();
  const image = payload.imageUrl?.trim() || read(inputs.find(item => ['image_url', 'start_image_url', 'first_frame_url'].includes(item.slotId ?? '')));
  const images = payload.referenceImages ?? inputs.filter(item => ['image_urls', 'reference_image_urls', 'reference_images'].includes(item.slotId ?? '')).map(read);
  const videos = inputs.filter(item => videoSlots.includes(item.slotId ?? '')).map(read);
  const elements = payload.elements?.map(item => {
    if (item.providerElementId !== undefined || item.voiceId !== undefined) throw new Error('Kling 4.0 Flash does not accept provider or voice bindings.');
    return { ...(item.frontalImageUrl ? { frontal_image_url: item.frontalImageUrl } : {}), ...(item.referenceImageUrls ? { reference_image_urls: item.referenceImageUrls } : {}), ...(item.videoUrl ? { video_url: item.videoUrl } : {}) };
  });
  if (payload.durationOption != null && payload.durationSec != null && integer(payload.durationOption) !== payload.durationSec) throw new Error('Kling 4.0 Flash conflicting duration selectors.');
  const requestBody: Record<string, unknown> = {
    ...(payload.prompt.trim() ? { prompt: payload.prompt.trim() } : {}), duration: integer(payload.durationOption ?? payload.durationSec ?? 5), resolution: payload.resolution ?? '720p',
    ...(mode !== 'i2v' ? { aspect_ratio: payload.aspectRatio ?? '16:9' } : {}), ...(image ? { start_image_url: image } : {}),
    ...(images.length ? { image_urls: images } : {}), ...(videos.length ? { video_urls: videos } : {}), ...(elements?.length ? { elements } : {}),
  };
  const violation = getKlingV4FlashConstraintViolation(mode, requestBody);
  if (violation) throw new Error(violation.message);
  return { model: KLING_V4_FLASH_ENDPOINTS[mode as KlingV4FlashMode], requestBody };
}
