import { AlibabaModelStudioError } from './errors';
import { resolveAlibabaModelRoute } from './model-map';
import { WAN_3_REFERENCE_AUDIO_MIME_TYPES } from '../../../config/fal-engines/wan-3-shared';
import type {
  AlibabaMedia,
  AlibabaReferenceAsset,
  AlibabaVideoPayload,
  AlibabaVideoResolution,
} from './types';

export type AlibabaVideoPayloadInput = {
  engineId: string;
  mode: string;
  prompt: string;
  durationSec: number;
  resolution?: string | null;
  aspectRatio?: string | null;
  audioEnabled?: boolean;
  startImageUrl?: string | null;
  endImageUrl?: string | null;
  referenceImageUrls?: Array<string | AlibabaReferenceAsset> | null;
  referenceVideoUrls?: Array<string | AlibabaReferenceAsset> | null;
  referenceAudioUrls?: Array<string | AlibabaReferenceAsset> | null;
  fileUrl?: string | null;
  webUrl?: string | null;
  inputVideoDurationSec?: number | null;
  promptExtend?: boolean;
  seed?: number | null;
};

const RESOLUTIONS = new Set(['480P', '720P', '1080P']);
const RATIOS = new Set(['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16']);

function invalidRequest(message: string, code: string, body?: unknown): never {
  throw new AlibabaModelStudioError(message, {
    code,
    errorClass: 'invalid_request',
    body: body ?? { message },
  });
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeResolution(value: string | null | undefined): AlibabaVideoResolution {
  const normalized = (cleanString(value) ?? '720p').toUpperCase();
  if (RESOLUTIONS.has(normalized)) return normalized as AlibabaVideoResolution;
  invalidRequest('Alibaba video generation supports 480p, 720p, or 1080p resolution.', 'ALIBABA_UNSUPPORTED_RESOLUTION', {
    resolution: value,
  });
}

function normalizeRatio(value: string | null | undefined): string {
  const raw = cleanString(value) ?? 'adaptive';
  const normalized = raw === 'auto' ? 'adaptive' : raw;
  if (RATIOS.has(normalized)) return normalized;
  invalidRequest('Alibaba video generation received an unsupported aspect ratio.', 'ALIBABA_UNSUPPORTED_ASPECT_RATIO', {
    aspectRatio: value,
  });
}

function requireInteger(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    invalidRequest(`${label} must be between ${min} and ${max} seconds.`, 'ALIBABA_UNSUPPORTED_DURATION', {
      durationSec: value,
    });
  }
  return value;
}

function normalizeAsset(value: string | AlibabaReferenceAsset, kind: string): AlibabaReferenceAsset {
  const asset = typeof value === 'string' ? { url: value } : value;
  const url = cleanString(asset.url);
  if (!url) invalidRequest(`${kind} requires a URL.`, 'ALIBABA_REFERENCE_URL_MISSING');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    invalidRequest(`${kind} requires a valid HTTPS URL.`, 'ALIBABA_REFERENCE_URL_INVALID');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    invalidRequest(`${kind} requires a valid HTTPS URL.`, 'ALIBABA_REFERENCE_URL_INVALID');
  }
  const mimeType = cleanString(asset.mimeType)?.toLowerCase() ?? null;
  if (kind.includes('image')) {
    if (asset.hasAlpha === true || mimeType === 'image/gif' || mimeType === 'image/svg+xml') {
      invalidRequest('Alibaba reference images must be supported raster images without alpha.', 'ALIBABA_REFERENCE_IMAGE_UNSUPPORTED');
    }
    if (mimeType && !['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/webp'].includes(mimeType)) {
      invalidRequest('Alibaba reference image type is unsupported.', 'ALIBABA_REFERENCE_IMAGE_UNSUPPORTED');
    }
  }
  if (kind.includes('video') && mimeType && !['video/mp4', 'video/quicktime'].includes(mimeType)) {
    invalidRequest('Alibaba reference video type is unsupported.', 'ALIBABA_REFERENCE_VIDEO_UNSUPPORTED');
  }
  if (kind.includes('audio') && mimeType && !WAN_3_REFERENCE_AUDIO_MIME_TYPES.some((accepted) => accepted === mimeType)) {
    invalidRequest('Alibaba reference audio type is unsupported.', 'ALIBABA_REFERENCE_AUDIO_UNSUPPORTED');
  }
  return { ...asset, url };
}

function normalizeAssets(
  values: Array<string | AlibabaReferenceAsset> | null | undefined,
  kind: string,
  max: number
): AlibabaReferenceAsset[] {
  const assets = (values ?? []).map((value) => normalizeAsset(value, kind));
  if (assets.length > max) {
    invalidRequest(`Alibaba ${kind} accepts at most ${max} assets.`, 'ALIBABA_REFERENCE_LIMIT_EXCEEDED', {
      kind,
      count: assets.length,
      max,
    });
  }
  return assets;
}

function validateTimedReferences(assets: AlibabaReferenceAsset[], kind: 'video' | 'audio'): number | null {
  const knownDurations = assets.map((asset) => asset.durationSec).filter((value): value is number => typeof value === 'number');
  for (const duration of knownDurations) {
    if (!Number.isFinite(duration) || duration <= 0 || duration > 15) {
      invalidRequest(`Each Alibaba reference ${kind} must be between 0 and 15 seconds.`, 'ALIBABA_REFERENCE_DURATION_INVALID');
    }
  }
  if (knownDurations.length !== assets.length) return null;
  const total = knownDurations.reduce((sum, duration) => sum + duration, 0);
  if (total > 15) {
    invalidRequest(`Combined Alibaba reference ${kind} must not exceed 15 seconds.`, 'ALIBABA_REFERENCE_DURATION_EXCEEDED');
  }
  return total;
}

function pushMedia(target: AlibabaMedia[], type: AlibabaMedia['type'], assets: AlibabaReferenceAsset[]) {
  for (const asset of assets) target.push({ type, url: asset.url });
}

function buildWanPayload(input: AlibabaVideoPayloadInput, model: 'wan3.0-video' | 'wan3.0-video-prime'): AlibabaVideoPayload {
  const duration = requireInteger(input.durationSec, 2, 30, 'Wan 3 duration');
  const prompt = cleanString(input.prompt);
  if ((prompt?.length ?? 0) > 20_000) {
    invalidRequest('Wan 3 prompt must not exceed 20,000 characters.', 'ALIBABA_PROMPT_TOO_LONG');
  }
  const referenceImages = normalizeAssets(input.referenceImageUrls, 'reference image', 10);
  const referenceVideos = normalizeAssets(input.referenceVideoUrls, 'reference video', 5);
  const referenceAudio = normalizeAssets(input.referenceAudioUrls, 'reference audio', 5);
  const file = cleanString(input.fileUrl) ? normalizeAsset(input.fileUrl as string, 'document') : null;
  const link = cleanString(input.webUrl) ? normalizeAsset(input.webUrl as string, 'webpage') : null;
  validateTimedReferences(referenceVideos, 'video');
  validateTimedReferences(referenceAudio, 'audio');
  if (file && link) {
    invalidRequest('Wan 3 cannot combine document and webpage references.', 'ALIBABA_FILE_LINK_CONFLICT');
  }
  if ((file || link) && input.promptExtend === false) {
    invalidRequest('Wan 3 document and webpage references require prompt expansion.', 'ALIBABA_PROMPT_EXPANSION_REQUIRED');
  }

  const startImage = cleanString(input.startImageUrl)
    ? normalizeAsset(input.startImageUrl as string, 'start image')
    : null;
  const endImage = cleanString(input.endImageUrl)
    ? normalizeAsset(input.endImageUrl as string, 'end image')
    : null;
  if (endImage && !startImage) {
    invalidRequest('Wan 3 last-frame input requires a first frame.', 'ALIBABA_LAST_FRAME_REQUIRES_FIRST_FRAME');
  }
  if ((startImage || endImage) && (referenceImages.length || referenceVideos.length || referenceAudio.length || file || link)) {
    invalidRequest(
      'Wan 3 cannot combine frame interpolation with reference media.',
      'ALIBABA_FRAME_REFERENCE_CONFLICT'
    );
  }
  if (input.mode === 'i2v' && !startImage) {
    invalidRequest('Wan 3 image-to-video requires a first frame.', 'ALIBABA_FIRST_FRAME_REQUIRED');
  }
  if (input.mode === 'ref2v' && referenceImages.length + referenceVideos.length + referenceAudio.length === 0 && !file && !link) {
    invalidRequest('Wan 3 reference-to-video requires reference media.', 'ALIBABA_REFERENCE_REQUIRED');
  }
  if ((input.mode === 'v2v' || input.mode === 'extend') && referenceVideos.length !== 1) {
    invalidRequest(`Wan 3 ${input.mode} requires exactly one source video.`, 'ALIBABA_SOURCE_VIDEO_REQUIRED');
  }
  const inputVideoDuration = input.inputVideoDurationSec
    ?? (referenceVideos.length === 1 ? referenceVideos[0]?.durationSec : null);
  if (typeof inputVideoDuration === 'number' && inputVideoDuration + duration > 30) {
    invalidRequest('Wan 3 input and output duration must not exceed 30 seconds.', 'ALIBABA_TOTAL_DURATION_EXCEEDED');
  }

  const media: AlibabaMedia[] = [];
  if (startImage) media.push({ type: 'first_frame', url: startImage.url });
  if (endImage) media.push({ type: 'last_frame', url: endImage.url });
  pushMedia(media, 'reference_image', referenceImages);
  pushMedia(media, 'reference_video', referenceVideos);
  pushMedia(media, 'reference_audio', referenceAudio);
  if (file) media.push({ type: 'file', url: file.url });
  if (link) media.push({ type: 'link', url: link.url });
  return {
    model,
    input: {
      ...(prompt ? { prompt } : {}),
      ...(media.length ? { media } : {}),
    },
    parameters: {
      resolution: normalizeResolution(input.resolution),
      ratio: normalizeRatio(input.aspectRatio),
      duration,
      audio: input.audioEnabled === true,
      prompt_extend: input.promptExtend !== false,
      watermark: false,
      ...(typeof input.seed === 'number' ? { seed: input.seed } : {}),
    },
  };
}

function buildHappyHorsePayload(input: AlibabaVideoPayloadInput): AlibabaVideoPayload {
  const route = resolveAlibabaModelRoute(input.engineId, input.mode);
  if (!route || route.family !== 'happyhorse11') {
    invalidRequest('Unsupported HappyHorse 1.1 mode.', 'ALIBABA_MODEL_MODE_UNSUPPORTED');
  }
  const duration = requireInteger(input.durationSec, 3, 15, 'HappyHorse 1.1 duration');
  const prompt = cleanString(input.prompt);
  if (input.mode === 't2v' && !prompt) invalidRequest('HappyHorse T2V requires a prompt.', 'ALIBABA_PROMPT_REQUIRED');
  if (input.mode === 'ref2v' && !prompt) invalidRequest('HappyHorse R2V requires a prompt.', 'ALIBABA_PROMPT_REQUIRED');
  if ((prompt?.length ?? 0) > 5_000) {
    invalidRequest('HappyHorse 1.1 prompt must not exceed 5,000 characters.', 'ALIBABA_PROMPT_TOO_LONG');
  }

  const media: AlibabaMedia[] = [];
  if (input.mode === 'i2v') {
    const startImage = cleanString(input.startImageUrl)
      ? normalizeAsset(input.startImageUrl as string, 'start image')
      : null;
    if (!startImage) invalidRequest('HappyHorse I2V requires a first frame.', 'ALIBABA_FIRST_FRAME_REQUIRED');
    media.push({ type: 'first_frame', url: startImage.url });
  } else if (input.mode === 'ref2v') {
    const references = normalizeAssets(input.referenceImageUrls, 'reference image', 10);
    if (!references.length) invalidRequest('HappyHorse R2V requires reference images.', 'ALIBABA_REFERENCE_REQUIRED');
    pushMedia(media, 'reference_image', references);
  }

  return {
    model: route.model,
    input: {
      ...(prompt ? { prompt } : {}),
      ...(media.length ? { media } : {}),
    },
    parameters: {
      resolution: normalizeResolution(input.resolution),
      ...(input.mode === 'i2v' ? {} : { ratio: normalizeRatio(input.aspectRatio) }),
      duration,
      watermark: false,
      ...(typeof input.seed === 'number' ? { seed: input.seed } : {}),
    },
  };
}

export function buildAlibabaVideoPayload(input: AlibabaVideoPayloadInput): AlibabaVideoPayload {
  const route = resolveAlibabaModelRoute(input.engineId, input.mode);
  if (!route) {
    invalidRequest(
      `${input.engineId}/${input.mode} is not supported by Alibaba Model Studio.`,
      'ALIBABA_MODEL_MODE_UNSUPPORTED'
    );
  }
  if (route.family === 'wan3') return buildWanPayload(input, route.model as 'wan3.0-video' | 'wan3.0-video-prime');
  return buildHappyHorsePayload(input);
}
