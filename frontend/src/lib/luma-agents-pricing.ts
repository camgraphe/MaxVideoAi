import {
  LUMA_RAY_32_DURATIONS,
  LUMA_RAY_32_RESOLUTIONS,
  type LumaAgentsImageEngineId,
  type LumaAgentsImageMode,
} from '@/lib/luma-agents';
import type { Mode } from '@/types/engines';

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
  dynamic_range: 'sdr' | 'hdr' | 'hdr_exr';
  computed_total_usd: number;
};

export type LumaRay32InterpolatedPricingBreakdown = {
  engineId: 'luma-ray-3-2';
  providerCostSource: string;
  mode: Extract<Mode, 'v2v' | 'reframe'>;
  duration: '5s' | '10s' | 'per_second';
  durationSec: number;
  resolution: '540p' | '720p' | '1080p';
  dynamic_range: 'sdr' | 'hdr' | 'hdr_exr';
  fal_reference_usd: number;
  luma_direct_floor_usd?: number;
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

export type LumaRay32InterpolatedPriceComputation = {
  totalUsd: number;
  baseSubtotalUsd: number;
  breakdown: LumaRay32InterpolatedPricingBreakdown;
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

const RAY_32_DIRECT_VIDEO_EDIT_PRICE_USD = {
  '5s': {
    '540p': 0.72,
    '720p': 1.08,
    '1080p': 2.16,
  },
  '10s': {
    '540p': 1.44,
    '720p': 2.16,
    '1080p': 4.32,
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
  hdr?: boolean | null;
  exrExport?: boolean | null;
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
  const dynamicRange = params.exrExport ? 'hdr_exr' : params.hdr ? 'hdr' : 'sdr';
  if (dynamicRange !== 'sdr') {
    if (typedResolution === '540p') {
      throw new Error('Luma Ray 3.2 HDR pricing requires 720p or 1080p resolution.');
    }
    if (typedDuration === '10s') {
      throw new Error('Luma Ray 3.2 HDR pricing supports 5s public requests only.');
    }
  }
  if (params.exrExport && !params.hdr) {
    throw new Error('Luma Ray 3.2 EXR export pricing requires HDR.');
  }
  const dynamicRangeMultiplier = dynamicRange === 'hdr_exr' ? 3 : dynamicRange === 'hdr' ? 2 : 1;
  const totalUsd = Number((RAY_32_FAL_REFERENCE_PRICE_USD[typedDuration][typedResolution] * dynamicRangeMultiplier).toFixed(4));

  return {
    totalUsd,
    baseSubtotalUsd: totalUsd,
    breakdown: {
      engineId: 'luma-ray-3-2',
      falReferenceSource: 'fal_luma_ray_3_2_generation',
      duration: typedDuration,
      resolution: typedResolution,
      dynamic_range: dynamicRange,
      computed_total_usd: totalUsd,
    },
  };
}

function normalizeRay32Duration(value: string | number | null | undefined): '5s' | '10s' {
  const duration =
    typeof value === 'number'
      ? (`${Math.round(value)}s` as string)
      : value?.trim().toLowerCase();
  if (!LUMA_RAY_32_DURATIONS.includes(duration as '5s' | '10s')) {
    throw new Error('Luma Ray 3.2 supports 5s or 10s direct priced durations.');
  }
  return duration as '5s' | '10s';
}

function normalizeRay32Resolution(value: string | null | undefined): '540p' | '720p' | '1080p' {
  const resolution = value?.trim().toLowerCase();
  if (!LUMA_RAY_32_RESOLUTIONS.includes(resolution as '540p' | '720p' | '1080p')) {
    throw new Error('Luma Ray 3.2 supports 540p, 720p, or 1080p direct priced resolutions.');
  }
  return resolution as '540p' | '720p' | '1080p';
}

export function calculateLumaRay32InterpolatedPrice(params: {
  mode: Extract<Mode, 'v2v' | 'reframe'>;
  durationSec: number;
  duration: string | number | null | undefined;
  resolution: string | null | undefined;
  hdr?: boolean | null;
  exrExport?: boolean | null;
}): LumaRay32InterpolatedPriceComputation {
  const resolution = normalizeRay32Resolution(params.resolution);
  const dynamicRange = params.exrExport ? 'hdr_exr' : params.hdr ? 'hdr' : 'sdr';
  if (dynamicRange !== 'sdr' && resolution === '540p') {
    throw new Error('Luma Ray 3.2 HDR pricing requires 720p or 1080p resolution.');
  }
  if (params.exrExport && !params.hdr) {
    throw new Error('Luma Ray 3.2 EXR export pricing requires HDR.');
  }
  const dynamicRangeMultiplier = dynamicRange === 'hdr_exr' ? 3 : dynamicRange === 'hdr' ? 2 : 1;

  if (params.mode === 'reframe') {
    if (dynamicRange !== 'sdr') {
      throw new Error('Luma Ray 3.2 Reframe pricing is standard dynamic range only.');
    }
    const durationSec = Math.max(1, params.durationSec);
    const falReferenceUsd = Number(((RAY_32_FAL_REFERENCE_PRICE_USD['5s'][resolution] / 5) * durationSec).toFixed(4));
    return {
      totalUsd: falReferenceUsd,
      baseSubtotalUsd: falReferenceUsd,
      breakdown: {
        engineId: 'luma-ray-3-2',
        providerCostSource: 'fal_luma_ray_3_2_reframe_interpolated',
        mode: params.mode,
        duration: 'per_second',
        durationSec,
        resolution,
        dynamic_range: dynamicRange,
        fal_reference_usd: falReferenceUsd,
        computed_total_usd: falReferenceUsd,
      },
    };
  }

  const duration = normalizeRay32Duration(params.duration);
  const durationSec = duration === '10s' ? 10 : 5;
  const falReferenceUsd = Number((RAY_32_FAL_REFERENCE_PRICE_USD[duration][resolution] * dynamicRangeMultiplier).toFixed(4));
  const lumaDirectFloorUsd = Number((RAY_32_DIRECT_VIDEO_EDIT_PRICE_USD[duration][resolution] * dynamicRangeMultiplier).toFixed(4));
  const totalUsd = Math.max(falReferenceUsd, lumaDirectFloorUsd);
  return {
    totalUsd,
    baseSubtotalUsd: totalUsd,
    breakdown: {
      engineId: 'luma-ray-3-2',
      providerCostSource: 'fal_luma_ray_3_2_video_edit_interpolated',
      mode: params.mode,
      duration,
      durationSec,
      resolution,
      dynamic_range: dynamicRange,
      fal_reference_usd: falReferenceUsd,
      luma_direct_floor_usd: lumaDirectFloorUsd,
      computed_total_usd: totalUsd,
    },
  };
}

export const calculateLumaRay32DirectPrice = calculateLumaRay32InterpolatedPrice;
export type LumaRay32DirectPricingBreakdown = LumaRay32InterpolatedPricingBreakdown;
export type LumaRay32DirectPriceComputation = LumaRay32InterpolatedPriceComputation;
