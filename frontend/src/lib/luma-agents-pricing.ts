import {
  LUMA_RAY_32_DURATIONS,
  LUMA_RAY_32_RESOLUTIONS,
  type LumaAgentsImageEngineId,
  type LumaAgentsImageMode,
} from '@/lib/luma-agents';

export type LumaAgentsImageReferencePricingBreakdown = {
  engineId: LumaAgentsImageEngineId;
  mode: LumaAgentsImageMode;
  falReferenceSource: string;
  base_task_usd: number;
  source_or_reference_image_count: number;
  per_source_or_reference_image_usd: number;
  computed_total_usd: number;
};

export type LumaRay32ReferencePricingBreakdown = {
  engineId: 'luma-ray-3-2';
  falReferenceSource: string;
  duration: '5s' | '10s';
  resolution: '540p' | '720p' | '1080p';
  computed_total_usd: number;
};

export type LumaAgentsImageReferencePriceComputation = {
  totalUsd: number;
  baseSubtotalUsd: number;
  breakdown: LumaAgentsImageReferencePricingBreakdown;
};

export type LumaRay32ReferencePriceComputation = {
  totalUsd: number;
  baseSubtotalUsd: number;
  breakdown: LumaRay32ReferencePricingBreakdown;
};

const LUMA_UNI_BASE_TASK_USD: Record<LumaAgentsImageEngineId, number> = {
  'luma-uni-1': 0.042,
  'luma-uni-1-max': 0.102,
};

const LUMA_UNI_REFERENCE_IMAGE_USD = 0.003;

const RAY_32_FAL_REFERENCE_PRICE_USD = {
  '5s': {
    '540p': 0.5,
    '720p': 1,
    '1080p': 2,
  },
  '10s': {
    '540p': 1,
    '720p': 2,
    '1080p': 4,
  },
} as const;

export function calculateLumaAgentsImageReferencePrice(params: {
  engineId: LumaAgentsImageEngineId;
  mode: LumaAgentsImageMode;
  referenceImageCount: number;
}): LumaAgentsImageReferencePriceComputation {
  const sourceOrReferenceCount =
    params.mode === 'i2i'
      ? 1 + Math.max(0, Math.round(params.referenceImageCount))
      : Math.max(0, Math.round(params.referenceImageCount));
  const baseTaskUsd = LUMA_UNI_BASE_TASK_USD[params.engineId];
  const totalUsd = Number((baseTaskUsd + LUMA_UNI_REFERENCE_IMAGE_USD * sourceOrReferenceCount).toFixed(4));

  return {
    totalUsd,
    baseSubtotalUsd: totalUsd,
    breakdown: {
      engineId: params.engineId,
      mode: params.mode,
      falReferenceSource: params.mode === 't2i' ? 'fal_luma_uni_text_to_image' : 'fal_luma_uni_image_edit',
      base_task_usd: baseTaskUsd,
      source_or_reference_image_count: sourceOrReferenceCount,
      per_source_or_reference_image_usd: LUMA_UNI_REFERENCE_IMAGE_USD,
      computed_total_usd: totalUsd,
    },
  };
}

export function calculateLumaRay32ReferencePrice(params: {
  duration: string | number | null | undefined;
  resolution: string | null | undefined;
}): LumaRay32ReferencePriceComputation {
  const duration =
    typeof params.duration === 'number'
      ? (`${Math.round(params.duration)}s` as string)
      : params.duration?.trim().toLowerCase();
  if (!LUMA_RAY_32_DURATIONS.includes(duration as '5s' | '10s')) {
    throw new Error('Luma Ray 3.2 supports 5s or 10s public fallback-safe durations.');
  }

  const resolution = params.resolution?.trim().toLowerCase();
  if (!LUMA_RAY_32_RESOLUTIONS.includes(resolution as '540p' | '720p' | '1080p')) {
    throw new Error('Luma Ray 3.2 supports 540p, 720p, or 1080p public fallback-safe resolutions.');
  }

  const typedDuration = duration as '5s' | '10s';
  const typedResolution = resolution as '540p' | '720p' | '1080p';
  const totalUsd = RAY_32_FAL_REFERENCE_PRICE_USD[typedDuration][typedResolution];

  return {
    totalUsd,
    baseSubtotalUsd: totalUsd,
    breakdown: {
      engineId: 'luma-ray-3-2',
      falReferenceSource: 'fal_luma_ray_3_2_generation',
      duration: typedDuration,
      resolution: typedResolution,
      computed_total_usd: totalUsd,
    },
  };
}
