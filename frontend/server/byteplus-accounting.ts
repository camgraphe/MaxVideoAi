import {
  BYTEPLUS_MODELARK_PROVIDER,
  BytePlusModelArkError,
  requireBytePlusSeedanceProfile,
} from '@/server/video-providers/byteplus-modelark';
import { isRecord } from './byteplus-record-utils';
import type { BytePlusPendingJob } from './byteplus-poll-types';
import { BYTEPLUS_MODELARK_LIST_PRICE_SOURCE, getBytePlusVideoListRate } from './byteplus-list-tariff';
import { seedance25OutputDimensions } from './seedance25-output-dimensions';

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

// Seedance 1.5 has a different 480p raster from Seedance 2.5. These are
// published output dimensions, used only when provider token usage is absent.
const SEEDANCE_1_5_TOKEN_DIMENSIONS: typeof BYTEPLUS_TOKEN_DIMENSIONS = {
  '480p': {
    '21:9': { width: 992, height: 432 },
    '16:9': { width: 864, height: 496 },
    '4:3': { width: 752, height: 560 },
    '1:1': { width: 640, height: 640 },
    '3:4': { width: 560, height: 752 },
    '9:16': { width: 496, height: 864 },
  },
  '720p': {
    '21:9': { width: 1470, height: 630 },
    '16:9': { width: 1280, height: 720 },
    '4:3': { width: 1112, height: 834 },
    '1:1': { width: 960, height: 960 },
    '3:4': { width: 834, height: 1112 },
    '9:16': { width: 720, height: 1280 },
  },
  '1080p': {
    '21:9': { width: 2206, height: 946 },
    '16:9': { width: 1920, height: 1080 },
    '4:3': { width: 1664, height: 1248 },
    '1:1': { width: 1440, height: 1440 },
    '3:4': { width: 1248, height: 1664 },
    '9:16': { width: 1080, height: 1920 },
  },
};

function tokenDimensions(engineId: string, resolution: string, aspectRatio: string) {
  if (engineId === 'seedance-2-5') return seedance25OutputDimensions(resolution, aspectRatio);
  return (engineId === 'seedance-1-5-pro'
    ? SEEDANCE_1_5_TOKEN_DIMENSIONS
    : BYTEPLUS_TOKEN_DIMENSIONS)[resolution]?.[aspectRatio];
}

export function expectedBytePlusTokens(
  job: Pick<BytePlusPendingJob, 'engine_id' | 'duration_sec' | 'settings_snapshot'>
): number {
  const profile = requireBytePlusSeedanceProfile(job.engine_id);
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  const core = isRecord(settings.core) ? settings.core : {};
  const requestedResolution = typeof core.resolution === 'string' ? core.resolution : null;
  const requestedAspectRatio = typeof core.aspectRatio === 'string' ? core.aspectRatio : null;
  const resolution = profile.resolutions.includes(requestedResolution as never)
    ? requestedResolution!
    : profile.resolutions.includes('720p')
      ? '720p'
      : profile.resolutions[0];
  const aspectRatio = profile.aspectRatios.includes(requestedAspectRatio as never)
    ? requestedAspectRatio!
    : profile.aspectRatios.includes('16:9')
      ? '16:9'
      : profile.aspectRatios[0];
  const dimensions =
    resolution && aspectRatio
      ? tokenDimensions(job.engine_id, resolution, aspectRatio)
      : undefined;
  if (!dimensions) {
    throw new BytePlusModelArkError(
      'BytePlus accounting dimensions are not configured for this profile.',
      { status: 500, code: 'BYTEPLUS_ACCOUNTING_DIMENSIONS_MISSING' }
    );
  }
  return (
    dimensions.width *
    dimensions.height *
    Math.max(1, Math.round(job.duration_sec)) *
    profile.framesPerSecond
  ) / 1024;
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
  resolution?: string | null,
  generateAudio = true,
): number {
  const profile = requireBytePlusSeedanceProfile(engineId);
  const selectedResolution = resolution ?? (profile.resolutions.includes('720p') ? '720p' : profile.resolutions[0]);
  if (!selectedResolution) throw new Error(`BytePlus resolution missing for ${engineId}`);
  return getBytePlusVideoListRate({
    profile: profile.pricingProfileKey,
    resolution: selectedResolution,
    billingInputType: billingInputType === 'video_input' ? 'video_input' : 'no_video_input',
    generateAudio,
  }).unitPriceUsdPer1kTokens;
}

export function estimateBytePlusProviderCostCents(input: {
  engineId: string;
  durationSec: number;
  resolution: string;
  aspectRatio: string;
  billingInputType: 'video_input' | 'no_video_input';
  generateAudio?: boolean;
}): number {
  if (!Number.isSafeInteger(input.durationSec) || input.durationSec < 1) {
    throw new Error('Invalid BytePlus provider-cost duration.');
  }
  const dimensions = tokenDimensions(input.engineId, input.resolution, input.aspectRatio);
  if (!dimensions) throw new Error('Invalid BytePlus provider-cost dimensions.');
  const totalTokens = (
    dimensions.width * dimensions.height * input.durationSec * 24
  ) / 1024;
  const unitPriceUsdPer1kTokens = getBytePlusUnitPriceUsdPer1kTokens(
    input.engineId,
    input.billingInputType,
    input.resolution,
    input.generateAudio,
  );
  const costCents = Math.ceil(
    ((totalTokens * unitPriceUsdPer1kTokens) / 1000) * 100 - Number.EPSILON,
  );
  if (!Number.isSafeInteger(costCents) || costCents < 1) {
    throw new Error('Invalid BytePlus provider-cost estimate.');
  }
  return costCents;
}

export function buildBytePlusListCostBreakdown(input: {
  job: BytePlusPendingJob;
  model: string;
  resolution: string;
  aspectRatio: string;
  usage: { totalTokens: number | null; completionTokens: number | null } | null;
}) {
  const { job, usage } = input;
  const totalTokens = usage?.totalTokens ?? expectedBytePlusTokens(job);
  const accounting = getBytePlusAccounting(job);
  const unitPriceUsdPer1kTokens = getBytePlusUnitPriceUsdPer1kTokens(
    job.engine_id, accounting.byteplusBillingInputType, input.resolution, accounting.generateAudio,
  );
  const providerCostUsd = Number(((totalTokens * unitPriceUsdPer1kTokens) / 1000).toFixed(6));
  return {
    provider: BYTEPLUS_MODELARK_PROVIDER,
    provider_cost_source: 'byteplus_published_list_rate',
    provider_cost_status: usage?.totalTokens == null
      ? 'list_estimate_from_dimensions'
      : 'list_estimate_from_provider_usage',
    provider_list_rate_source: BYTEPLUS_MODELARK_LIST_PRICE_SOURCE.url,
    model: input.model,
    mode: accounting.mode,
    input_type: accounting.inputType,
    byteplus_billing_input_type: accounting.byteplusBillingInputType,
    generate_audio: accounting.generateAudio,
    has_start_image: accounting.hasStartImage,
    has_end_image: accounting.hasEndImage,
    has_reference_images: accounting.hasReferenceImages,
    has_reference_videos: accounting.hasReferenceVideos,
    has_reference_audio: accounting.hasReferenceAudio,
    resolution: input.resolution,
    aspect_ratio: input.aspectRatio,
    duration_sec: job.duration_sec,
    provider_tokens: totalTokens,
    total_tokens: totalTokens,
    completion_tokens: usage?.completionTokens ?? null,
    unit_price_usd_per_1k_tokens: unitPriceUsdPer1kTokens,
    provider_cost_usd_list: providerCostUsd,
    provider_cost_usd_effective: null,
    provider_cost_usd_observed: null,
  };
}
