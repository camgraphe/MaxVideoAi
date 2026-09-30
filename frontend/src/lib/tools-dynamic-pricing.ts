/** Versioned defaults preserve existing prices until a product explicitly overrides them. */
export const UPSCALE_VIDEO_DEFAULT_PRICE_MULTIPLIER = 4;
export const BACKGROUND_REMOVAL_DEFAULT_PRICE_MULTIPLIER = 2;

const defaults: Readonly<Record<string, number>> = {
  'upscale-video-seedvr': UPSCALE_VIDEO_DEFAULT_PRICE_MULTIPLIER,
  'upscale-video-flashvsr': UPSCALE_VIDEO_DEFAULT_PRICE_MULTIPLIER,
  'upscale-video-topaz': UPSCALE_VIDEO_DEFAULT_PRICE_MULTIPLIER,
  'background-removal-video-v3': BACKGROUND_REMOVAL_DEFAULT_PRICE_MULTIPLIER,
};

export function validateToolPriceMultiplier(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 1000) {
    throw new Error('Dynamic price multiplier must be a finite number between 1 and 1000.');
  }
  return value;
}

/** An invalid authored override fails closed; absent overrides retain the reviewed default. */
export function resolveDynamicToolPriceMultiplier(productKey: string, metadata?: Record<string, unknown> | null): number | null {
  if (!Object.hasOwn(defaults, productKey)) return null;
  return metadata && Object.hasOwn(metadata, 'dynamicPriceMultiplier')
    ? validateToolPriceMultiplier(metadata.dynamicPriceMultiplier) : defaults[productKey]!;
}
