import {
  getGptImage2PresetSize, parseGptImage2SizeKey, resolveGptImage2AutoInputImageSize,
  resolveGptImage2PricingTier, validateGptImage2CustomImageSize, type GptImage2ImageSize,
} from './gptImage2';

/** Public estimates require known pixels; billing owns the tier mapping and custom bounds. */
export function resolvePublicGptImageQuoteSize(resolution: string, inputSize: unknown): {
  billingKey: string; customImageSize: GptImage2ImageSize | null;
} | null {
  const key = resolution.toLowerCase();
  if (inputSize !== undefined) {
    if (!inputSize || typeof inputSize !== 'object' || Array.isArray(inputSize)) return null;
    const given = inputSize as Record<string, unknown>;
    if (typeof given.width !== 'number' || typeof given.height !== 'number'
      || !Number.isFinite(given.width) || !Number.isFinite(given.height)
      || given.width <= 0 || given.height <= 0) return null;
  }
  if (key === 'custom') {
    const validated = validateGptImage2CustomImageSize(inputSize);
    return validated.ok ? { billingKey: resolveGptImage2PricingTier(key, validated.size).billingKey,
      customImageSize: validated.size } : null;
  }
  if (key === 'auto') {
    if (!inputSize || typeof inputSize !== 'object' || Array.isArray(inputSize)) return null;
    const size = resolveGptImage2AutoInputImageSize([inputSize]);
    return size ? { billingKey: resolveGptImage2PricingTier(key, size).billingKey, customImageSize: size } : null;
  }
  const size = parseGptImage2SizeKey(key) ?? getGptImage2PresetSize(key);
  if (!size) return null;
  if (inputSize !== undefined) {
    const given = inputSize as Record<string, unknown>;
    if (given.width !== size.width || given.height !== size.height) return null;
  }
  return { billingKey: resolveGptImage2PricingTier(key).billingKey,
    customImageSize: parseGptImage2SizeKey(key) };
}
