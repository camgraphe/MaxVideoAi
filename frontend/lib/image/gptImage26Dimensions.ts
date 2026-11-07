/** GPT Image 2.6 guide and official calculator, checked 2026-11-06. */
export const GPT_IMAGE_26_SIZE_LIMITS = {
  minPixels: 655_360, maxPixels: 8_294_400, maxEdge: 3840, maxAspectRatio: 3, multipleOf: 16,
} as const;

export const GPT_IMAGE_26_PRESET_SIZES = [
  '1024x1024', '1536x1024', '1024x1536',
  '1536x864', '864x1536', '1024x768', '768x1024', '1536x512', '512x1536',
  '2048x2048', '2048x1152', '1152x2048', '2560x1440', '1440x2560',
  '2880x2880', '3840x2160', '2160x3840',
] as const;
export const GPT_IMAGE_26_SIZES = [...GPT_IMAGE_26_PRESET_SIZES, 'custom', 'auto'] as const;
export type GptImage26Dimensions = { width: number; height: number };

export function validateGptImage26Dimensions(size: GptImage26Dimensions): boolean {
  const { width, height } = size;
  const limits = GPT_IMAGE_26_SIZE_LIMITS;
  return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0
    && width % limits.multipleOf === 0 && height % limits.multipleOf === 0
    && Math.max(width, height) <= limits.maxEdge
    && width * height >= limits.minPixels && width * height <= limits.maxPixels
    && Math.max(width, height) <= Math.min(width, height) * limits.maxAspectRatio;
}

export function gptImage26PixelSize(resolution: string, customImageSize?: GptImage26Dimensions | null): GptImage26Dimensions | null {
  if (resolution === 'auto') return null;
  const match = /^(\d+)x(\d+)$/.exec(resolution);
  const size = resolution === 'custom' ? customImageSize : match ? {width: Number(match[1]), height: Number(match[2])} : null;
  if (!size || !validateGptImage26Dimensions(size)) throw new Error('GPT Image 2.6 requires valid dimensions: multiples of 16, 655360–8294400 pixels, at most 3840 per edge and a ratio from 1:3 to 3:1.');
  return size;
}

export function gptImage26SizeMatchesRatio(size: GptImage26Dimensions, ratio: string): boolean {
  const match = /^(\d+):(\d+)$/.exec(ratio);
  return Boolean(match && Number(match[1]) > 0 && Number(match[2]) > 0
    && size.width * Number(match[2]) === size.height * Number(match[1]));
}
