import {
  MINIMAX_H3_MAX_ENDPOINTS,
  MINIMAX_H3_MAX_ID,
  MINIMAX_H3_MAX_PROMPT_EXPANSION_MODES,
  MINIMAX_H3_MAX_RESOLUTIONS,
  MINIMAX_H3_MAX_TEXT_ASPECT_RATIOS,
} from '@/src/config/fal-engines/minimax-h3-max';
import type { GeneratePayload } from '@/lib/fal-types';

export type MinimaxH3MaxMode = 't2v' | 'i2v' | 'ref2v';
export type PromptExpansionMode = 'balanced' | 'quality';
export type MinimaxH3MaxResolution = (typeof MINIMAX_H3_MAX_RESOLUTIONS)[number];
export type MinimaxH3MaxReferenceType = 'image' | 'video' | 'audio';

export type MinimaxH3MaxReference = {
  type: string;
  url: string;
};

export type MinimaxH3MaxRequestInput = {
  mode: MinimaxH3MaxMode;
  prompt: string;
  durationSec?: number;
  resolution?: string | null;
  aspectRatio?: string | null;
  promptExpansionMode?: string | null;
  imageUrl?: string | null;
  endImageUrl?: string | null;
  references?: readonly MinimaxH3MaxReference[];
  referenceImageUrls?: readonly string[];
  referenceVideoUrls?: readonly string[];
  referenceAudioUrls?: readonly string[];
};

type GroupedReferences = Record<MinimaxH3MaxReferenceType, string[]>;

export type NormalizedMinimaxH3MaxRequest = {
  mode: MinimaxH3MaxMode;
  prompt: string;
  durationSec: number;
  resolution: MinimaxH3MaxResolution;
  promptExpansionMode: PromptExpansionMode;
  aspectRatio?: (typeof MINIMAX_H3_MAX_TEXT_ASPECT_RATIOS)[number];
  imageUrl?: string;
  endImageUrl?: string;
  references: GroupedReferences;
};

export function isMinimaxH3MaxEngineId(id: string | null | undefined): boolean {
  return id === MINIMAX_H3_MAX_ID;
}

export function isMinimaxH3MaxRuntimeModeAvailable(mode: string | null | undefined): boolean {
  return mode === 't2v';
}

export function resolveMinimaxH3MaxEndpoint(mode: MinimaxH3MaxMode): string {
  const endpoint = MINIMAX_H3_MAX_ENDPOINTS[mode];
  if (!endpoint) throw new Error(`Unsupported MiniMax H3 Max mode: ${String(mode)}`);
  return endpoint;
}

function normalizedUrls(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function groupReferences(input: MinimaxH3MaxRequestInput): GroupedReferences {
  const grouped: GroupedReferences = {
    image: normalizedUrls(input.referenceImageUrls),
    video: normalizedUrls(input.referenceVideoUrls),
    audio: normalizedUrls(input.referenceAudioUrls),
  };
  for (const reference of input.references ?? []) {
    if (reference.type !== 'image' && reference.type !== 'video' && reference.type !== 'audio') {
      throw new Error('MiniMax H3 Max reference type must be image, video, or audio.');
    }
    const url = reference.url.trim();
    if (!url) throw new Error(`MiniMax H3 Max ${reference.type} reference URL is required.`);
    if (!grouped[reference.type].includes(url)) grouped[reference.type].push(url);
  }
  return grouped;
}

export function normalizeMinimaxH3MaxRequest(
  input: MinimaxH3MaxRequestInput,
): NormalizedMinimaxH3MaxRequest {
  if (input.mode !== 't2v' && input.mode !== 'i2v' && input.mode !== 'ref2v') {
    throw new Error(`Unsupported MiniMax H3 Max mode: ${String(input.mode)}`);
  }
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error('MiniMax H3 Max prompt is required.');
  if (prompt.length > 50_000) throw new Error('MiniMax H3 Max prompts must be at most 50000 characters.');

  const durationSec = input.durationSec ?? 5;
  if (!Number.isInteger(durationSec) || durationSec < 5 || durationSec > 15) {
    throw new Error('MiniMax H3 Max duration must be an integer from 5 through 15 seconds.');
  }
  const resolution = input.resolution?.trim() || '768P';
  if (!(MINIMAX_H3_MAX_RESOLUTIONS as readonly string[]).includes(resolution)) {
    throw new Error('MiniMax H3 Max resolution must be 480P or 768P.');
  }
  const promptExpansionMode = input.promptExpansionMode?.trim() || 'balanced';
  if (!(MINIMAX_H3_MAX_PROMPT_EXPANSION_MODES as readonly string[]).includes(promptExpansionMode)) {
    throw new Error('MiniMax H3 Max prompt expansion mode must be balanced or quality.');
  }

  const imageUrl = input.imageUrl?.trim() ?? '';
  const endImageUrl = input.endImageUrl?.trim() ?? '';
  if (input.mode === 'i2v' && !imageUrl) {
    throw new Error('MiniMax H3 Max image-to-video requires a start image.');
  }
  if (input.mode !== 'i2v' && (imageUrl || endImageUrl)) {
    throw new Error('MiniMax H3 Max start and end images are only valid for image-to-video.');
  }

  let aspectRatio: NormalizedMinimaxH3MaxRequest['aspectRatio'];
  if (input.mode === 't2v') {
    const value = input.aspectRatio?.trim() || '16:9';
    if (!(MINIMAX_H3_MAX_TEXT_ASPECT_RATIOS as readonly string[]).includes(value)) {
      throw new Error('MiniMax H3 Max text aspect ratio is unsupported.');
    }
    aspectRatio = value as NormalizedMinimaxH3MaxRequest['aspectRatio'];
  } else if (input.aspectRatio?.trim()) {
    throw new Error('MiniMax H3 Max aspect ratio is available for text-to-video only.');
  }

  const references = groupReferences(input);
  const referenceCount = references.image.length + references.video.length + references.audio.length;
  if (references.image.length > 9) throw new Error('MiniMax H3 Max supports up to 9 reference images.');
  if (references.video.length > 3) throw new Error('MiniMax H3 Max supports up to 3 reference videos.');
  if (references.audio.length > 3) throw new Error('MiniMax H3 Max supports up to 3 reference audio clips.');
  if (referenceCount > 12) throw new Error('MiniMax H3 Max supports up to 12 references total.');
  if (input.mode === 'ref2v' && references.image.length + references.video.length === 0) {
    throw new Error('MiniMax H3 Max reference-to-video requires an image or video reference; audio cannot be used alone.');
  }
  if (input.mode !== 'ref2v' && referenceCount > 0) {
    throw new Error('MiniMax H3 Max references are only valid for reference-to-video.');
  }

  return {
    mode: input.mode,
    prompt,
    durationSec,
    resolution: resolution as MinimaxH3MaxResolution,
    promptExpansionMode: promptExpansionMode as PromptExpansionMode,
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(endImageUrl ? { endImageUrl } : {}),
    references,
  };
}

export function buildMinimaxH3MaxFalRequest(input: MinimaxH3MaxRequestInput): {
  model: string;
  requestBody: Record<string, unknown>;
} {
  const request = normalizeMinimaxH3MaxRequest(input);
  const requestBody: Record<string, unknown> = {
    prompt: request.prompt,
    duration: request.durationSec,
    resolution: request.resolution,
    prompt_expansion_mode: request.promptExpansionMode,
  };
  if (request.aspectRatio) requestBody.aspect_ratio = request.aspectRatio;
  if (request.imageUrl) requestBody.image_url = request.imageUrl;
  if (request.endImageUrl) requestBody.end_image_url = request.endImageUrl;
  if (request.references.image.length) requestBody.reference_image_urls = request.references.image;
  if (request.references.video.length) requestBody.reference_video_urls = request.references.video;
  if (request.references.audio.length) requestBody.reference_audio_urls = request.references.audio;

  return {
    model: resolveMinimaxH3MaxEndpoint(request.mode),
    requestBody,
  };
}

function payloadAttachmentUrls(payload: GeneratePayload, slotId: string): string[] {
  return normalizedUrls(
    (payload.inputs ?? [])
      .filter((attachment) => attachment.slotId?.trim() === slotId)
      .map((attachment) => attachment.url?.trim() ?? attachment.dataUrl?.trim() ?? ''),
  );
}

function payloadDurationSec(payload: GeneratePayload): number | undefined {
  const value = payload.durationOption ?? payload.durationSec;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+(?:\.\d+)?s?$/iu.test(value.trim())) {
    return Number(value.trim().replace(/s$/iu, ''));
  }
  return undefined;
}

export function buildMinimaxH3MaxFalRequestFromPayload(payload: GeneratePayload): {
  model: string;
  requestBody: Record<string, unknown>;
} {
  const mode = (payload.mode ?? 't2v') as MinimaxH3MaxMode;
  const extraInputValues = payload.extraInputValues ?? {};
  const firstImage = (slotId: string) => payloadAttachmentUrls(payload, slotId)[0];

  return buildMinimaxH3MaxFalRequest({
    mode,
    prompt: payload.prompt,
    durationSec: payloadDurationSec(payload),
    resolution: payload.resolution,
    aspectRatio: payload.aspectRatio,
    promptExpansionMode:
      typeof extraInputValues.prompt_expansion_mode === 'string'
        ? extraInputValues.prompt_expansion_mode
        : null,
    imageUrl: firstImage('image_url') ?? payload.imageUrl,
    endImageUrl: firstImage('end_image_url') ?? payload.endImageUrl,
    referenceImageUrls: payloadAttachmentUrls(payload, 'reference_image_urls'),
    referenceVideoUrls: payloadAttachmentUrls(payload, 'reference_video_urls'),
    referenceAudioUrls: payloadAttachmentUrls(payload, 'reference_audio_urls'),
  });
}
