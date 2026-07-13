import { ENV } from '@/lib/env';
import type { LumaRay2EditWorkflow } from '@/lib/luma-ray2-pricing';

const DEFAULT_PRICING = {
  lumaRay2: {
    base5s540pUsd: 0.5,
    modifyPerSecondUsd: 0.12,
    reframePerSecondUsd: 0.2,
  },
  lumaRay2_flash: {
    base5s540pUsd: 0.2,
    modifyPerSecondUsd: 0.12,
    reframePerSecondUsd: 0.06,
  },
} as const;

function numberOrDefault(value: string | undefined, fallback: number): number {
  return value == null ? fallback : Number(value);
}

export function getLumaRay2BasePriceUsd(engineId: string): number {
  if (engineId === 'lumaRay2_flash') {
    return numberOrDefault(
      ENV.LUMARAY2_FLASH_BASE_5S_540P_USD ?? ENV.LUMARAY2_BASE_5S_540P_USD,
      DEFAULT_PRICING.lumaRay2_flash.base5s540pUsd
    );
  }
  return numberOrDefault(ENV.LUMARAY2_BASE_5S_540P_USD, DEFAULT_PRICING.lumaRay2.base5s540pUsd);
}

export function getLumaRay2EditRateUsd(engineId: string, workflow: LumaRay2EditWorkflow): number {
  if (workflow === 'modify') {
    if (engineId === 'lumaRay2_flash') {
      return numberOrDefault(
        ENV.LUMARAY2_FLASH_MODIFY_PER_SECOND_USD ?? ENV.LUMARAY2_MODIFY_PER_SECOND_USD,
        DEFAULT_PRICING.lumaRay2_flash.modifyPerSecondUsd
      );
    }
    return numberOrDefault(
      ENV.LUMARAY2_MODIFY_PER_SECOND_USD,
      DEFAULT_PRICING.lumaRay2.modifyPerSecondUsd
    );
  }
  if (engineId === 'lumaRay2_flash') {
    return numberOrDefault(
      ENV.LUMARAY2_FLASH_REFRAME_PER_SECOND_USD ?? ENV.LUMARAY2_REFRAME_PER_SECOND_USD,
      DEFAULT_PRICING.lumaRay2_flash.reframePerSecondUsd
    );
  }
  return numberOrDefault(
    ENV.LUMARAY2_REFRAME_PER_SECOND_USD,
    DEFAULT_PRICING.lumaRay2.reframePerSecondUsd
  );
}
