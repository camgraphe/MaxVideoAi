import { z } from 'zod';
import type { GeneratePayload } from '@/lib/fal-types';
import { KLING_V4_ENDPOINTS, KLING_V4_PROMPT_MAX_CHARS } from '@/config/fal-engines/kling-v4';

// fal public OpenAPI, verified 2026-10-25. Account access is a separate release gate.
export { KLING_V4_ENDPOINTS };
export type KlingV4Mode = keyof typeof KLING_V4_ENDPOINTS;
export const isKlingV4EngineId = (id: string | null | undefined): boolean => id?.trim().toLowerCase() === 'kling-v4';

const url = z.string().trim().min(1);
const duration = z.number().int().min(3).max(30);
const imageElement = z.object({
  frontal_image_url: url,
  reference_image_urls: z.array(url).min(1).max(3),
}).strict();
const referenceElement = z.object({
  frontal_image_url: url.optional(),
  reference_image_urls: z.array(url).min(1).max(3).optional(),
  video_url: url.optional(),
  voice_id: url.optional(),
}).strict().superRefine((value, ctx) => {
  const hasImages = Boolean(value.frontal_image_url && value.reference_image_urls?.length);
  if (value.video_url ? (value.frontal_image_url || value.reference_image_urls) : !hasImages) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use either an element video or a frontal image with 1–3 additional views.' });
  }
});
const shot = z.object({ prompt: z.string().trim().min(1).max(512), duration: z.number().int().min(1).max(30) }).strict();
const common = {
  prompt: z.string().trim().min(1).max(KLING_V4_PROMPT_MAX_CHARS).optional(),
  multi_prompt: z.array(shot).min(1).optional(),
  duration,
  resolution: z.enum(['720p', '1080p']).optional(),
};
const schemas = {
  t2v: z.object({ ...common, aspect_ratio: z.enum(['16:9', '9:16', '1:1', '21:9']).optional() }).strict(),
  i2v: z.object({ ...common, start_image_url: url, end_image_url: url.optional() }).strict(),
  ref2v: z.object({ ...common, start_image_url: url.optional(), image_urls: z.array(url).max(10).optional(), video_urls: z.array(url).max(5).optional(),
    elements: z.array(referenceElement).max(7).optional(), aspect_ratio: z.enum(['auto', '16:9', '9:16', '1:1', '21:9']).optional() }).strict(),
  v2v: z.object({ prompt: z.string().trim().min(1).max(KLING_V4_PROMPT_MAX_CHARS), video_url: url, image_urls: z.array(url).max(10).optional(),
    elements: z.array(imageElement).max(7).optional(), duration: duration.optional(), resolution: common.resolution }).strict(),
};

function integer(value: unknown): unknown {
  return typeof value === 'string' && /^\d+$/u.test(value.trim()) ? Number(value.trim()) : value;
}

/** Pure validation only: no network, metadata probing, billing or model access claim. */
export function getKlingV4ConstraintViolation(mode: string, input: Record<string, unknown>): { field: string; message: string } | null {
  const invalid = (field: string, message: string) => ({ field, message: `Kling V4 ${field}: ${message}` });
  if (!Object.hasOwn(schemas, mode)) return invalid('mode', 'Unsupported mode.');
  const parsed = schemas[mode as KlingV4Mode].safeParse({ ...input, ...(input.duration !== undefined ? { duration: integer(input.duration) } : {}) });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.code === 'unrecognized_keys' ? issue.keys[0] : issue.path.join('.') || 'input';
    return invalid(field, issue.message);
  }
  const value = parsed.data;
  if (mode !== 'v2v') {
    const generation = value as z.infer<typeof schemas.t2v>;
    if (Boolean(generation.prompt) === Boolean(generation.multi_prompt?.length)) return invalid('prompt', 'Provide a prompt or a shot plan, exclusively.');
    if (generation.multi_prompt && generation.multi_prompt.reduce((sum, item) => sum + item.duration, 0) !== generation.duration) {
      return invalid('duration', 'The shot durations must sum to the requested duration.');
    }
  }
  if (mode === 'ref2v') {
    const refs = parsed.data as z.infer<typeof schemas.ref2v>;
    if ((refs.image_urls?.length ?? 0) + Number(Boolean(refs.start_image_url)) > 10) return invalid('image_urls', 'The start frame counts toward the ten-image limit.');
    if (!refs.start_image_url && !refs.image_urls?.length && !refs.video_urls?.length && !refs.elements?.length) return invalid('references', 'Reference mode requires visual media.');
    if ((refs.elements?.filter(item => item.voice_id).length ?? 0) > 3) return invalid('elements', 'At most three elements may have a voice.');
    if ((refs.elements?.filter(item => item.video_url).length ?? 0) > 3) return invalid('elements', 'At most three elements may use video.');
  }
  return null;
}

/** Translate the app's canonical shape without inherited V3 truncation or field rewriting. */
export function buildKlingV4FalRequest(payload: GeneratePayload): { model: string; requestBody: Record<string, unknown> } {
  const mode = payload.mode ?? 't2v';
  if (!Object.hasOwn(KLING_V4_ENDPOINTS, mode)) throw new Error('Kling V4 mode is unsupported.');
  for (const [field, value] of Object.entries({ fps: payload.fps, seed: payload.seed, cfgScale: payload.cfgScale, audio: payload.audio === false ? false : undefined,
    voiceIds: payload.voiceIds?.length ? payload.voiceIds : undefined, shotType: payload.shotType, cameraFixed: payload.cameraFixed,
    loop: payload.loop, numFrames: payload.numFrames, audioUrl: payload.audioUrl, safetyChecker: payload.safetyChecker })) {
    if (value !== undefined && value !== null) throw new Error(`Kling V4 does not expose ${field} in this fal route.`);
  }
  const extraKeys = Object.keys(payload.extraInputValues ?? {}).filter(key => payload.extraInputValues?.[key] !== undefined);
  if (extraKeys.length) throw new Error(`Kling V4 unsupported controls: ${extraKeys.join(', ')}.`);
  const inputs = payload.inputs ?? [];
  const imageSlots = ['image_url', 'start_image_url', 'first_frame_url', 'end_image_url', 'last_frame_url', 'image_urls', 'reference_image_urls', 'reference_images'];
  const videoSlots = ['video_url', 'video_urls', 'reference_video_urls', 'reference_videos'];
  for (const item of inputs) {
    const slots = item.kind === 'image' ? imageSlots : item.kind === 'video' ? videoSlots : [];
    if (!slots.includes(item.slotId ?? '')) {
      throw new Error(`Kling V4 unsupported attachment: ${item.slotId ?? item.kind}.`);
    }
  }
  const inputUrl = (slots: string[]) => inputs.find(item => slots.includes(item.slotId ?? ''));
  const read = (item: (typeof inputs)[number] | undefined) => item?.url?.trim() || item?.dataUrl?.trim();
  const image = payload.imageUrl?.trim() || read(inputUrl(['image_url', 'start_image_url', 'first_frame_url']));
  const end = payload.endImageUrl?.trim() || read(inputUrl(['end_image_url', 'last_frame_url']));
  const images = payload.referenceImages ?? inputs.filter(item => ['image_urls', 'reference_image_urls', 'reference_images'].includes(item.slotId ?? '')).map(read);
  const videos = inputs.filter(item => ['video_urls', 'reference_video_urls', 'reference_videos'].includes(item.slotId ?? '')).map(read);
  const sourceVideo = payload.videoUrl?.trim() || read(inputUrl(['video_url']));
  const elements = payload.elements?.map(element => ({
    ...(element.frontalImageUrl ? { frontal_image_url: element.frontalImageUrl } : {}),
    ...(element.referenceImageUrls ? { reference_image_urls: element.referenceImageUrls } : {}),
    ...(element.videoUrl ? { video_url: element.videoUrl } : {}),
    ...(element.voiceId ? { voice_id: element.voiceId } : {}),
  }));
  if (payload.durationOption != null && payload.durationSec != null && integer(payload.durationOption) !== payload.durationSec) {
    throw new Error('Kling V4 conflicting duration selectors.');
  }
  const requestedDuration = payload.durationOption ?? payload.durationSec ?? (mode === 'v2v' ? undefined : 5);
  const requestBody: Record<string, unknown> = {
    ...(payload.prompt.trim() ? { prompt: payload.prompt.trim() } : {}),
    ...(payload.multiPrompt !== undefined ? { multi_prompt: payload.multiPrompt } : {}),
    ...(requestedDuration !== undefined ? { duration: integer(requestedDuration) } : {}),
    resolution: payload.resolution ?? '1080p',
    ...(mode === 't2v' || mode === 'ref2v' ? { aspect_ratio: payload.aspectRatio ?? '16:9' } : {}),
    ...(image ? { start_image_url: image } : {}), ...(end ? { end_image_url: end } : {}),
    ...(images.length ? { image_urls: images } : {}), ...(videos.length ? { video_urls: videos } : {}),
    ...(sourceVideo ? { video_url: sourceVideo } : {}), ...(elements?.length ? { elements } : {}),
  };
  const violation = getKlingV4ConstraintViolation(mode, requestBody);
  if (violation) throw new Error(violation.message);
  return { model: KLING_V4_ENDPOINTS[mode as KlingV4Mode], requestBody };
}
