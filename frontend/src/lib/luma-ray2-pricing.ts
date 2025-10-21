import {
  getLumaRay2DurationInfo,
  getLumaRay2ResolutionInfo,
  LUMA_RAY2_ERROR_UNSUPPORTED,
  type LumaRay2DurationLabel,
  type LumaRay2ResolutionValue,
} from './luma-ray2';

export type LumaRay2PriceBreakdown = {
  engineId: 'luma-ray2';
  base_5s_540p: number;
  duration: LumaRay2DurationLabel;
  duration_factor: number;
  resolution: LumaRay2ResolutionValue;
  resolution_factor: number;
  loop?: boolean;
  computed_total_usd: number;
};

export type LumaRay2PriceComputation = {
  totalUsd: number;
  baseSubtotalUsd: number;
  breakdown: LumaRay2PriceBreakdown;
};

export function calculateLumaRay2Price(params: {
  baseUsd: number;
  duration: number | string | null | undefined;
  resolution: string | null | undefined;
  loop?: boolean;
}): LumaRay2PriceComputation {
  const { baseUsd, duration, resolution, loop } = params;
  const durationInfo = getLumaRay2DurationInfo(duration);
  const resolutionInfo = getLumaRay2ResolutionInfo(resolution);

  if (!durationInfo || !resolutionInfo) {
    throw new Error(LUMA_RAY2_ERROR_UNSUPPORTED);
  }

  if (typeof baseUsd !== 'number' || Number.isNaN(baseUsd) || baseUsd <= 0) {
    throw new Error('Luma Ray 2 base price must be a positive number');
  }

  const baseSubtotalUsd = baseUsd * durationInfo.factor * resolutionInfo.factor;
  const totalUsd = Number(baseSubtotalUsd.toFixed(4));

  return {
    totalUsd,
    baseSubtotalUsd,
    breakdown: {
      engineId: 'luma-ray2',
      base_5s_540p: Number(baseUsd.toFixed(4)),
      duration: durationInfo.label,
      duration_factor: durationInfo.factor,
      resolution: resolutionInfo.value,
      resolution_factor: resolutionInfo.factor,
      loop: typeof loop === 'boolean' ? loop : undefined,
      computed_total_usd: totalUsd,
    },
  };
}
