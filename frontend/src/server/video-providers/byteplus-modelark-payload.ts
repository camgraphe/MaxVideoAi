import type { AspectRatio, Mode, Resolution } from '@/types/engines';
import {
  BYTEPLUS_SEEDANCE_ASPECT_RATIOS,
  BYTEPLUS_SEEDANCE_DURATION_OPTIONS,
  BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS,
  BYTEPLUS_SEEDANCE_MINI_DEFAULT_MODEL_ID,
  BYTEPLUS_SEEDANCE_MINI_DURATION_OPTIONS,
  BYTEPLUS_SEEDANCE_MODES,
} from './byteplus-modelark-constants';
import { BytePlusModelArkError } from './byteplus-modelark-error';

type BytePlusContentItem =
  | { type: 'text'; text: string }
  | {
      type: 'image_url';
      image_url: { url: string };
      role: 'reference_image';
    }
  | {
      type: 'video_url';
      video_url: { url: string };
      role: 'reference_video';
    }
  | {
      type: 'audio_url';
      audio_url: { url: string };
      role: 'reference_audio';
    };

export type BytePlusSeedanceFastPayload = {
  model: string;
  content: BytePlusContentItem[];
  resolution: '480p' | '720p' | '1080p' | '4k';
  ratio: '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16';
  duration: number;
  generate_audio: boolean;
  watermark: false;
};

export type BytePlusSeedancePayload = BytePlusSeedanceFastPayload;

function uniqueNonEmptyUrls(values: Array<string | null | undefined> | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
}

export function buildBytePlusSeedancePayload(params: {
  modelId: string;
  prompt: string;
  durationSec: number;
  mode?: Extract<Mode, 't2v' | 'i2v' | 'ref2v' | 'v2v' | 'extend'>;
  imageUrl?: string | null;
  endImageUrl?: string | null;
  referenceImageUrls?: string[];
  referenceVideoUrls?: string[];
  referenceAudioUrls?: string[];
  resolution?: string | null;
  ratio?: string | null;
  generateAudio?: boolean;
  allowedResolutions?: Resolution[];
  allowedDurationOptions?: readonly number[];
}): BytePlusSeedancePayload {
  const prompt = params.prompt.trim();
  const duration = Math.trunc(params.durationSec);
  const mode = params.mode ?? 't2v';
  const imageUrl = typeof params.imageUrl === 'string' ? params.imageUrl.trim() : '';
  const endImageUrl = typeof params.endImageUrl === 'string' ? params.endImageUrl.trim() : '';
  const referenceImageUrls = uniqueNonEmptyUrls(params.referenceImageUrls);
  const referenceVideoUrls = uniqueNonEmptyUrls(params.referenceVideoUrls);
  const referenceAudioUrls = uniqueNonEmptyUrls(params.referenceAudioUrls);
  const allowedResolutions = params.allowedResolutions?.length ? params.allowedResolutions : BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS;
  const allowedDurationOptions = params.allowedDurationOptions?.length
    ? params.allowedDurationOptions
    : params.modelId.trim() === BYTEPLUS_SEEDANCE_MINI_DEFAULT_MODEL_ID
      ? BYTEPLUS_SEEDANCE_MINI_DURATION_OPTIONS
      : BYTEPLUS_SEEDANCE_DURATION_OPTIONS;
  const requestedResolution = (typeof params.resolution === 'string' && params.resolution.trim()
    ? params.resolution.trim()
    : '720p') as Resolution;
  const requestedRatio = (typeof params.ratio === 'string' && params.ratio.trim() ? params.ratio.trim() : '16:9') as AspectRatio;
  if (!prompt) {
    throw new BytePlusModelArkError('Prompt is required for BytePlus Seedance.', { code: 'PROMPT_REQUIRED' });
  }
  if (!BYTEPLUS_SEEDANCE_MODES.includes(mode)) {
    throw new BytePlusModelArkError('BytePlus Seedance supports only configured T2V, I2V, reference, video edit, and extension modes.', {
      code: 'BYTEPLUS_MODE_UNSUPPORTED',
    });
  }
  if (mode === 'i2v' && !imageUrl) {
    throw new BytePlusModelArkError('Image URL is required for BytePlus Seedance image-to-video.', {
      code: 'IMAGE_URL_REQUIRED',
    });
  }
  if (mode === 'ref2v' && referenceImageUrls.length + referenceVideoUrls.length + referenceAudioUrls.length === 0) {
    throw new BytePlusModelArkError('At least one reference image, video, or audio URL is required for BytePlus Seedance reference-to-video.', {
      code: 'REFERENCE_URL_REQUIRED',
    });
  }
  if (mode === 'ref2v' && referenceImageUrls.length + referenceVideoUrls.length === 0) {
    throw new BytePlusModelArkError('At least one reference image or video URL is required for BytePlus Seedance reference-to-video.', {
      code: 'REFERENCE_MEDIA_REQUIRED',
    });
  }
  if ((mode === 'v2v' || mode === 'extend') && referenceVideoUrls.length === 0) {
    throw new BytePlusModelArkError('At least one source video URL is required for BytePlus Seedance video edit and extension modes.', {
      code: 'VIDEO_URL_REQUIRED',
    });
  }
  if (!Number.isFinite(duration) || !allowedDurationOptions.includes(duration as never)) {
    const minDuration = allowedDurationOptions[0] ?? 5;
    const maxDuration = allowedDurationOptions[allowedDurationOptions.length - 1] ?? 15;
    throw new BytePlusModelArkError(`BytePlus Seedance duration must be between ${minDuration} and ${maxDuration} seconds.`, {
      code: 'BYTEPLUS_DURATION_UNSUPPORTED',
    });
  }
  if (!params.modelId.trim()) {
    throw new BytePlusModelArkError('BytePlus Seedance model id is not configured.', {
      code: 'BYTEPLUS_MODEL_MISSING',
    });
  }
  if (!allowedResolutions.includes(requestedResolution)) {
    throw new BytePlusModelArkError('BytePlus Seedance resolution is not supported by this model.', {
      code: 'BYTEPLUS_RESOLUTION_UNSUPPORTED',
    });
  }
  if (!BYTEPLUS_SEEDANCE_ASPECT_RATIOS.includes(requestedRatio)) {
    throw new BytePlusModelArkError('BytePlus Seedance aspect ratio is not supported.', {
      code: 'BYTEPLUS_RATIO_UNSUPPORTED',
    });
  }

  const text =
    mode === 'i2v' && endImageUrl
      ? `Use Image 1 as the opening frame and Image 2 as the final frame. ${prompt}`
      : mode === 'i2v'
        ? `Use Image 1 as the opening frame. ${prompt}`
        : prompt;
  const content: BytePlusContentItem[] = [{ type: 'text', text }];
  if (mode === 'i2v') {
    content.push({
      type: 'image_url',
      image_url: { url: imageUrl },
      role: 'reference_image',
    });
    if (endImageUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: endImageUrl },
        role: 'reference_image',
      });
    }
  }
  if (mode === 'ref2v' || mode === 'v2v' || mode === 'extend') {
    for (const url of referenceImageUrls) {
      content.push({
        type: 'image_url',
        image_url: { url },
        role: 'reference_image',
      });
    }
    for (const url of referenceVideoUrls) {
      content.push({
        type: 'video_url',
        video_url: { url },
        role: 'reference_video',
      });
    }
    for (const url of referenceAudioUrls) {
      content.push({
        type: 'audio_url',
        audio_url: { url },
        role: 'reference_audio',
      });
    }
  }

  return {
    model: params.modelId.trim(),
    content,
    resolution: requestedResolution as BytePlusSeedancePayload['resolution'],
    ratio: requestedRatio as BytePlusSeedancePayload['ratio'],
    duration,
    generate_audio: params.generateAudio === true,
    watermark: false,
  };
}

export function buildBytePlusSeedanceFastPayload(params: Parameters<typeof buildBytePlusSeedancePayload>[0]): BytePlusSeedanceFastPayload {
  return buildBytePlusSeedancePayload(params);
}
