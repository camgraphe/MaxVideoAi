import { z } from 'zod';
import { GPT_IMAGE_26_MODELS, normalizeGptImage26Settings, type GptImage26Settings } from '@/lib/image/gptImage26';
import type { ImageGenerationMode } from '@/types/image-generation';
import { gptImage26PixelSize } from '@/lib/image/gptImage26Dimensions';

const inputSchema = z.object({
  modelId: z.enum(GPT_IMAGE_26_MODELS), mode: z.enum(['t2i', 'i2i']), prompt: z.string().trim().min(1).max(32000),
  referenceUrls: z.array(z.string().url().refine(url => url.startsWith('https://'))).max(16),
});
export type OpenAIImagePayload = {
  model: string; prompt: string; n: number; size: string; quality: string; complexity: string; output_format: string; background: string;
  output_compression?: number;
  images?: Array<{ image_url: string }>;
};
export function buildOpenAIImagePayload(input: { modelId: string; mode: ImageGenerationMode; prompt: string; settings: GptImage26Settings; referenceUrls: string[] }): OpenAIImagePayload {
  const parsed = inputSchema.parse({ modelId: input.modelId, mode: input.mode, prompt: input.prompt, referenceUrls: input.referenceUrls });
  if (parsed.mode === 'i2i' ? !parsed.referenceUrls.length : parsed.referenceUrls.length) throw new Error('GPT Image 2.6 references do not match the selected mode.');
  const settings = normalizeGptImage26Settings(input.settings);
  const pixels = gptImage26PixelSize(settings.resolution, settings.customImageSize);
  return { model: parsed.modelId, prompt: parsed.prompt, n: settings.numImages, size: pixels ? `${pixels.width}x${pixels.height}` : 'auto',
    quality: settings.quality, complexity: settings.complexity, output_format: settings.outputFormat, background: settings.background,
    ...(settings.outputCompression === undefined ? {} : { output_compression: settings.outputCompression }),
    ...(parsed.mode === 'i2i' ? { images: parsed.referenceUrls.map(image_url => ({ image_url })) } : {}) };
}
