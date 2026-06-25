import {
  BYTEPLUS_SEEDANCE_ASPECT_RATIOS,
  PUBLIC_SEEDANCE_ENGINE_ID,
  PUBLIC_SEEDANCE_MINI_ENGINE_ID,
} from '@/server/video-providers/byteplus-modelark';
import { isRecord } from './byteplus-record-utils';
import type { BytePlusPendingJob } from './byteplus-poll-types';

const BYTEPLUS_FAST_UNIT_PRICE_USD_PER_1K_TOKENS = 0.0056;
const BYTEPLUS_STANDARD_UNIT_PRICE_USD_PER_1K_TOKENS = 0.007;
const BYTEPLUS_STANDARD_4K_NO_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS = 0.004;
const BYTEPLUS_STANDARD_4K_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS = 0.0024;
const BYTEPLUS_MINI_NO_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS = 0.0035;
const BYTEPLUS_MINI_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS = 0.0021;

const BYTEPLUS_TOKEN_DIMENSIONS: Record<string, Record<string, { width: number; height: number }>> = {
  '480p': {
    '21:9': { width: 1120, height: 480 },
    '16:9': { width: 854, height: 480 },
    '4:3': { width: 640, height: 480 },
    '1:1': { width: 480, height: 480 },
    '3:4': { width: 480, height: 640 },
    '9:16': { width: 480, height: 854 },
  },
  '720p': {
    '21:9': { width: 1680, height: 720 },
    '16:9': { width: 1280, height: 720 },
    '4:3': { width: 960, height: 720 },
    '1:1': { width: 720, height: 720 },
    '3:4': { width: 720, height: 960 },
    '9:16': { width: 720, height: 1280 },
  },
  '1080p': {
    '21:9': { width: 2520, height: 1080 },
    '16:9': { width: 1920, height: 1080 },
    '4:3': { width: 1440, height: 1080 },
    '1:1': { width: 1080, height: 1080 },
    '3:4': { width: 1080, height: 1440 },
    '9:16': { width: 1080, height: 1920 },
  },
  '4k': {
    '21:9': { width: 4398, height: 1886 },
    '16:9': { width: 3840, height: 2160 },
    '4:3': { width: 3326, height: 2494 },
    '1:1': { width: 2880, height: 2880 },
    '3:4': { width: 2494, height: 3326 },
    '9:16': { width: 2160, height: 3840 },
  },
};

export function expectedBytePlusTokens(job: Pick<BytePlusPendingJob, 'duration_sec' | 'settings_snapshot'>): number {
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  const core = isRecord(settings.core) ? settings.core : {};
  const resolution = typeof core.resolution === 'string' ? core.resolution : '720p';
  const aspectRatio =
    typeof core.aspectRatio === 'string' && BYTEPLUS_SEEDANCE_ASPECT_RATIOS.includes(core.aspectRatio as never)
      ? core.aspectRatio
      : '16:9';
  const dimensions = BYTEPLUS_TOKEN_DIMENSIONS[resolution]?.[aspectRatio] ?? BYTEPLUS_TOKEN_DIMENSIONS['720p']['16:9'];
  return (dimensions.width * dimensions.height * Math.max(1, Math.round(job.duration_sec)) * 24) / 1024;
}

export function getBytePlusAccounting(job: Pick<BytePlusPendingJob, 'settings_snapshot' | 'has_audio'>) {
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  const refs = isRecord(settings.refs) ? settings.refs : {};
  const mode =
    settings.inputMode === 'extend'
      ? 'extend'
      : settings.inputMode === 'v2v'
        ? 'v2v'
        : settings.inputMode === 'ref2v'
          ? 'ref2v'
          : settings.inputMode === 'i2v'
            ? 'i2v'
            : 't2v';
  const hasStartImage = mode === 'i2v' && typeof refs.imageUrl === 'string' && refs.imageUrl.trim().length > 0;
  const hasEndImage = mode === 'i2v' && typeof refs.endImageUrl === 'string' && refs.endImageUrl.trim().length > 0;
  const hasReferenceImages = Array.isArray(refs.referenceImages) && refs.referenceImages.length > 0;
  const hasReferenceVideos = Array.isArray(refs.videoUrls) && refs.videoUrls.length > 0;
  const hasReferenceAudio = typeof refs.audioUrl === 'string' || (Array.isArray(refs.audioUrls) && refs.audioUrls.length > 0);
  const inputType =
    mode === 'extend'
      ? 'video_extension'
      : mode === 'v2v'
        ? 'video_edit'
        : mode === 'ref2v'
          ? 'reference_generation'
          : hasEndImage
            ? 'first_last_frame'
            : hasStartImage
              ? 'image_input'
              : 'text_input';

  return {
    mode,
    inputType,
    hasStartImage,
    hasEndImage,
    hasReferenceImages,
    hasReferenceVideos,
    hasReferenceAudio,
    generateAudio: job.has_audio === true,
    byteplusBillingInputType: hasReferenceVideos || mode === 'v2v' || mode === 'extend' ? 'video_input' : 'no_video_input',
  };
}

export function getBytePlusUnitPriceUsdPer1kTokens(
  engineId: string | null | undefined,
  billingInputType?: string | null,
  resolution?: string | null
): number {
  if (engineId === PUBLIC_SEEDANCE_ENGINE_ID) {
    if ((resolution ?? '').trim().toLowerCase() === '4k') {
      return billingInputType === 'video_input'
        ? BYTEPLUS_STANDARD_4K_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS
        : BYTEPLUS_STANDARD_4K_NO_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS;
    }
    return BYTEPLUS_STANDARD_UNIT_PRICE_USD_PER_1K_TOKENS;
  }
  if (engineId === PUBLIC_SEEDANCE_MINI_ENGINE_ID) {
    return billingInputType === 'video_input'
      ? BYTEPLUS_MINI_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS
      : BYTEPLUS_MINI_NO_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS;
  }
  return BYTEPLUS_FAST_UNIT_PRICE_USD_PER_1K_TOKENS;
}
