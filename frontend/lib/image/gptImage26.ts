import { z } from 'zod';
import type { ImageGenerationRequest } from '@/types/image-generation';

export const GPT_IMAGE_26_IDS = ['gpt-image-2-6-flare', 'gpt-image-2-6-sunburst'] as const;
export const GPT_IMAGE_26_MODELS = ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'] as const;
export const GPT_IMAGE_26_QUALITIES = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export const GPT_IMAGE_26_COMPLEXITIES = ['low', 'medium', 'high'] as const;
// The first release uses the three sizes explicitly documented for all GPT Image
// models. Custom/auto dimensions need separate 2.6 pricing and access qualification.
export const GPT_IMAGE_26_SIZES = ['1024x1024', '1536x1024', '1024x1536'] as const;
export const isGptImage26EngineId = (id: string | null | undefined): boolean => GPT_IMAGE_26_IDS.some(value => value === id);
const schema = z.object({
  resolution: z.enum(GPT_IMAGE_26_SIZES).default('1024x1024'),
  quality: z.enum(GPT_IMAGE_26_QUALITIES).default('high'),
  complexity: z.enum(GPT_IMAGE_26_COMPLEXITIES).default('high'),
  outputFormat: z.enum(['png', 'jpeg', 'webp']).default('png'),
  background: z.enum(['auto', 'opaque', 'transparent']).default('auto'),
  numImages: z.number().int().min(1).max(4).default(1),
}).superRefine((value, ctx) => {
  if (value.background === 'transparent' && value.outputFormat === 'jpeg') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['background'], message: 'Transparent output requires PNG or WebP.' });
});
export type GptImage26Settings = z.infer<typeof schema>;

export function normalizeGptImage26Settings(input: Partial<ImageGenerationRequest>): GptImage26Settings {
  const raw = input as Record<string, unknown>;
  for (const field of ['maskUrl', 'mask', 'markup', 'svg', 'frameCount', 'frameDurationMs', 'frame_count', 'frame_duration_ms', 'seed', 'style', 'thinkingLevel', 'maxOutputTokens', 'systemInstruction', 'enableWebSearch', 'enableImageSearch', 'limitGenerations', 'watermark', 'customImageSize', 'outputCompression', 'inputFidelity', 'stream', 'partialImages']) {
    if (raw[field] !== undefined && raw[field] !== null && raw[field] !== false && raw[field] !== '') throw new Error(`GPT Image 2.6 does not support ${field} in this release.`);
  }
  return schema.parse({ resolution: input.resolution, quality: input.quality, complexity: input.complexity, outputFormat: input.outputFormat, background: input.background, numImages: input.numImages });
}
