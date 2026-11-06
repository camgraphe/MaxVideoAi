import { z } from 'zod';
import type { ImageGenerationRequest } from '@/types/image-generation';
import { GPT_IMAGE_26_SIZES, gptImage26PixelSize } from './gptImage26Dimensions';
export { GPT_IMAGE_26_SIZES } from './gptImage26Dimensions';

export const GPT_IMAGE_26_IDS = ['gpt-image-2-6-flare', 'gpt-image-2-6-sunburst'] as const;
export const GPT_IMAGE_26_MODELS = ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'] as const;
export const GPT_IMAGE_26_EXPLICIT_QUALITIES = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export const GPT_IMAGE_26_QUALITIES = [...GPT_IMAGE_26_EXPLICIT_QUALITIES, 'auto'] as const;
export const GPT_IMAGE_26_COMPLEXITIES = ['low', 'medium', 'high'] as const;
export const isGptImage26EngineId = (id: string | null | undefined): boolean => GPT_IMAGE_26_IDS.some(value => value === id);

/** Owned original metadata must be admissible before either a quote or submission. */
export function gptImage26ReferenceFailure(reference: {
  mimeType?: string | null; sizeBytes?: number | null; width?: number | null; height?: number | null;
}): 'metadata_unverified' | 'format_unsupported' | 'size_exceeded' | 'dimensions_unverified' | null {
  if (!reference.mimeType || !Number.isSafeInteger(reference.sizeBytes) || !(reference.sizeBytes! > 0)) return 'metadata_unverified';
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(reference.mimeType)) return 'format_unsupported';
  if (reference.sizeBytes! > 25 * 1024 * 1024) return 'size_exceeded';
  if (!Number.isSafeInteger(reference.width) || !Number.isSafeInteger(reference.height)
    || !(reference.width! > 0 && reference.height! > 0)) return 'dimensions_unverified';
  return null;
}
const schema = z.object({
  resolution: z.enum(GPT_IMAGE_26_SIZES).default('1024x1024'),
  quality: z.enum(GPT_IMAGE_26_QUALITIES).default('high'),
  complexity: z.enum(GPT_IMAGE_26_COMPLEXITIES).default('high'),
  outputFormat: z.enum(['png', 'jpeg', 'webp']).default('png'),
  outputCompression: z.number().int().min(0).max(100).optional(),
  background: z.enum(['auto', 'opaque', 'transparent']).default('auto'),
  numImages: z.number().int().min(1).max(10).default(1),
  customImageSize: z.object({width: z.number().int(), height: z.number().int()}).optional(),
}).superRefine((value, ctx) => {
  if (value.outputCompression !== undefined && value.outputFormat === 'png') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['outputCompression'], message: 'Output compression requires JPEG or WebP.' });
  if (value.background === 'transparent' && value.outputFormat === 'jpeg') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['background'], message: 'Transparent output requires PNG or WebP.' });
  try {
    const size = gptImage26PixelSize(value.resolution, value.customImageSize);
    if (value.customImageSize && value.resolution !== 'custom'
      && (!size || size.width !== value.customImageSize.width || size.height !== value.customImageSize.height)) {
      throw new Error('Custom dimensions must match the selected size.');
    }
  } catch (error) { ctx.addIssue({code: z.ZodIssueCode.custom, path: ['resolution'], message: (error as Error).message}); }
});
export type GptImage26Settings = z.infer<typeof schema>;

export function normalizeGptImage26Settings(input: Partial<ImageGenerationRequest>): GptImage26Settings {
  const raw = input as Record<string, unknown>;
  if (input.prompt !== undefined && (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 32000)) throw new Error('GPT Image 2.6 requires a prompt of 1–32000 characters.');
  if (input.mode === 't2i' && ((input.imageUrls?.length ?? 0) + (input.characterReferences?.length ?? 0))) throw new Error('GPT Image 2.6 references require edit mode.');
  for (const field of ['maskUrl', 'mask', 'markup', 'svg', 'frameCount', 'frameDurationMs', 'frame_count', 'frame_duration_ms', 'seed', 'style', 'thinkingLevel', 'maxOutputTokens', 'systemInstruction', 'enableWebSearch', 'enableImageSearch', 'limitGenerations', 'watermark', 'inputFidelity', 'stream', 'partialImages']) {
    if (raw[field] !== undefined && raw[field] !== null && raw[field] !== false && raw[field] !== '') throw new Error(`GPT Image 2.6 does not support ${field} in this release.`);
  }
  return schema.parse({ resolution: input.resolution, quality: input.quality, complexity: input.complexity, outputFormat: input.outputFormat, outputCompression: input.outputCompression, background: input.background, numImages: input.numImages, customImageSize: input.customImageSize ?? undefined });
}
