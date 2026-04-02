import {
  getLumaRay2DurationInfo,
  getLumaRay2ResolutionInfo,
  LUMA_RAY2_ERROR_UNSUPPORTED,
  type LumaRay2DurationLabel,
  type LumaRay2ResolutionValue,
} from './luma-ray2';

export type LumaRay2PriceBreakdown = {
  engineId: 'luma-ray2' | 'luma-ray2-flash';
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

export type LumaRay2EditWorkflow = 'modify' | 'reframe';

export type LumaRay2EditPriceBreakdown = {
  engineId: 'luma-ray2' | 'luma-ray2-flash';
  workflow: LumaRay2EditWorkflow;
  seconds: number;
  rate_per_second_usd: number;
  computed_total_usd: number;
};

export type LumaRay2EditPriceComputation = {
  totalUsd: number;
  baseSubtotalUsd: number;
  breakdown: LumaRay2EditPriceBreakdown;
};

export function calculateLumaRay2Price(params: {
  baseUsd: number;
  duration: number | string | null | undefined;
  resolution: string | null | undefined;
  loop?: boolean;
  engineId?: 'luma-ray2' | 'luma-ray2-flash';
}): LumaRay2PriceComputation {
  const { baseUsd, duration, resolution, loop, engineId = 'luma-ray2' } = params;
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
      engineId,
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

export function calculateLumaRay2EditPrice(params: {
  engineId?: 'luma-ray2' | 'luma-ray2-flash';
  workflow: LumaRay2EditWorkflow;
  durationSec: number;
  rateUsd: number;
}): LumaRay2EditPriceComputation {
  const { durationSec, rateUsd, workflow, engineId = 'luma-ray2' } = params;
  const seconds = Math.max(1, Math.round(durationSec));
  if (typeof rateUsd !== 'number' || Number.isNaN(rateUsd) || rateUsd <= 0) {
    throw new Error('Luma Ray 2 edit rate must be a positive number');
  }

  const baseSubtotalUsd = Number((seconds * rateUsd).toFixed(4));
  return {
    totalUsd: baseSubtotalUsd,
    baseSubtotalUsd,
    breakdown: {
      engineId,
      workflow,
      seconds,
      rate_per_second_usd: Number(rateUsd.toFixed(4)),
      computed_total_usd: baseSubtotalUsd,
    },
  };
}
