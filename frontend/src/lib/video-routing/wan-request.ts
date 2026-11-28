import type { GeneratePayload } from '../fal-types';
import { isWan3EngineId } from '../wan3-pricing';
import type { PurchaseRequest } from '../../server/video-providers/purchase/types';
import { unsupportedVideoInput, type VideoInputProfile } from './input-profile';
import { resolveWanMediaInputs } from './wan-media';
import { encodeWanControls, hasUnreviewedWanOptions, type WanControlFields, WAN_PILOT_INPUTS, wanControls, WAVESPEED_WAN_INPUTS } from './wan-options';

export type WanRequestFacts = PurchaseRequest & { referenceVideoSeconds?: readonly number[]; promptCharacters?: number };

// Positive list: new generation options stay with their existing owner until an adapter reviews them.
const reviewedFields = new Set<string>([
  'engineId', 'mode', 'prompt', 'durationSec', 'durationOption', 'aspectRatio', 'resolution', 'audio', 'seed',
  'imageUrl', 'endImageUrl', 'referenceImages', 'audioUrl', 'videoUrl', 'inputs', 'extraInputValues',
  'idempotencyKey', 'jobId', 'localKey', 'reviewedWanPilot', 'submissionMode', 'shotType', 'fps',
] satisfies (keyof GeneratePayload)[]);

function hasUnmappedField(payload: GeneratePayload) {
  if (Object.entries(payload).some(([key, value]) => value != null && !reviewedFields.has(key))) return true;
  // The app inserts this fixed shot label for every image-to-video request. Wan has no multi-shot setting.
  if (payload.shotType && !(payload.mode === 'i2v' && payload.shotType === 'customize')) return true;
  if (payload.fps != null && payload.fps !== 30) return true;
  return payload.durationOption != null && String(payload.durationOption).replace(/s$/, '') !== String(payload.durationSec);
}

export function wanRequestFacts(payload: GeneratePayload, media: ReturnType<typeof resolveWanMediaInputs>, negativePrompt?: string | null): WanRequestFacts {
  const extras = payload.extraInputValues;
  const mode = payload.mode ?? 't2v';
  const promptCharacters = payload.prompt.trim().length;
  const clips = media.referenceVideos;
  const durations = clips.flatMap(clip => typeof clip.durationSec === 'number' ? [clip.durationSec] : []);
  return {
    engineId: payload.engineId, mode, durationSec: payload.durationSec ?? NaN,
    resolution: payload.resolution ?? '', aspectRatio: payload.aspectRatio ?? null,
    audioEnabled: payload.audio, promptCharacters,
    images: media.referenceImages.length + Number(Boolean(media.startImageUrl)),
    hasStartFrame: Boolean(media.startImageUrl), hasEndFrame: Boolean(media.endImageUrl),
    hasAudioReference: media.referenceAudio.length > 0, hasVideo: clips.length > 0,
    inputVideoSeconds: media.inputVideoDurationSec, referenceVideoSeconds: durations.length === clips.length ? durations : undefined,
    hasDocument: Boolean(extras?.file_url || extras?.web_url),
    hasUnpricedOptions: Boolean(negativePrompt?.trim()) || promptCharacters > 20_000 || (mode === 't2v' && !promptCharacters) ||
      media.ambiguousMedia || hasUnmappedField(payload) || hasUnreviewedWanOptions(extras) ||
      (payload.seed != null && (!Number.isInteger(payload.seed) || payload.seed < 0 || payload.seed > 2147483647)),
  };
}

/** Both flat APIs share semantics. Each describes its own wire names and treatment of inherited framing. */
type WanFlatFields = WanControlFields & Record<'prompt' | 'duration' | 'resolution' | 'ratio' | 'seed' | 'first' | 'last' | 'images' | 'videos', string>;
type WanFlatAdapter = { profile: VideoInputProfile; fields: WanFlatFields; automaticRatio?: string; requiresPrompt: boolean };
const falFields: WanFlatFields = {
  prompt: 'prompt', duration: 'duration', resolution: 'resolution', ratio: 'aspect_ratio', seed: 'seed',
  generateAudio: 'audio', expandPrompt: 'enable_prompt_expansion',
  first: 'start_image_url', last: 'end_image_url', images: 'reference_image_urls', videos: 'reference_video_urls',
};
export const wanFlatAdapters = {
  fal: { profile: WAN_PILOT_INPUTS, fields: falFields, automaticRatio: 'adaptive', requiresPrompt: false },
  wavespeed: { profile: WAVESPEED_WAN_INPUTS, automaticRatio: undefined, requiresPrompt: true,
    fields: { ...falFields, generateAudio: 'generate_audio', first: 'image', last: 'last_image', images: 'reference_images', videos: 'reference_videos' } },
} satisfies Record<string, WanFlatAdapter>;

export function wanFlatExclusion(provider: keyof typeof wanFlatAdapters, r: WanRequestFacts): string | null {
  if (!isWan3EngineId(r.engineId)) return 'Unreviewed engine edition';
  const exception = unsupportedVideoInput(r, wanFlatAdapters[provider].profile);
  if (exception) return exception;
  if (typeof r.audioEnabled !== 'boolean') return 'Resolved generated-audio setting is required';
  if (r.promptCharacters != null && (!Number.isSafeInteger(r.promptCharacters) || r.promptCharacters < 0 || r.promptCharacters > 20_000))
    return 'Prompt length outside the reviewed range';
  if ((r.mode === 't2v' || wanFlatAdapters[provider].requiresPrompt) && (r.promptCharacters == null || r.promptCharacters < 1))
    return 'Evidence of a nonempty prompt is required';
  const clips = r.referenceVideoSeconds;
  if (!r.hasVideo) return clips?.length ? 'Unexpected source video durations' : null;
  if (!clips?.length || clips.length > 5 || clips.some(sec => !Number.isFinite(sec) || sec < 1 || sec > 15))
    return 'Each reference video needs a verified duration of 1 to 15 seconds';
  const total = clips.reduce((sum, sec) => sum + sec, 0);
  if (r.inputVideoSeconds == null || !Number.isFinite(r.inputVideoSeconds) ||
      Math.abs(r.inputVideoSeconds - total) > 1e-9 || total > 15 || total + r.durationSec > 30)
    return 'Reference durations exceed limits or disagree with the source total';
  return null;
}

/** Pure encoding, shared by a private Fal pilot and the WaveSpeed catalogue preview. */
export function encodeWanFlatRequest(provider: keyof typeof wanFlatAdapters, payload: GeneratePayload): Record<string, unknown> {
  const media = resolveWanMediaInputs({ imageUrl: payload.imageUrl, falPayload: payload });
  const facts = wanRequestFacts(payload, media);
  const reason = wanFlatExclusion(provider, facts);
  if (reason) throw new Error(reason);
  const adapter = wanFlatAdapters[provider];
  const fields = adapter.fields;
  const ratio = facts.aspectRatio == null || ['auto', 'adaptive'].includes(facts.aspectRatio)
    ? adapter.automaticRatio : facts.aspectRatio;
  const expansion = payload.extraInputValues?.enable_prompt_expansion;
  const controls = wanControls(facts.mode, facts.audioEnabled === true, typeof expansion === 'boolean' ? expansion : undefined);
  return {
    ...(payload.prompt.trim() ? { [fields.prompt]: payload.prompt } : {}),
    [fields.duration]: facts.durationSec, [fields.resolution]: facts.resolution.toLowerCase(),
    ...(ratio ? { [fields.ratio]: ratio } : {}),
    ...encodeWanControls(fields, controls),
    ...(payload.seed != null ? { [fields.seed]: payload.seed } : {}),
    ...(media.startImageUrl ? { [fields.first]: media.startImageUrl } : {}),
    ...(media.endImageUrl ? { [fields.last]: media.endImageUrl } : {}),
    ...(media.referenceImages.length ? { [fields.images]: media.referenceImages.map(r => r.url) } : {}),
    ...(media.referenceVideos.length ? { [fields.videos]: media.referenceVideos.map(r => r.url) } : {}),
  };
}
