import { z } from 'zod';

export const SORA_VARIANTS = ['sora2', 'sora2pro'] as const;
export type SoraVariant = (typeof SORA_VARIANTS)[number];
export type SoraMode = 't2v' | 'i2v';

const durationSchema = z.union([z.literal(4), z.literal(8), z.literal(12)]);

const apiKeySchema = z
  .string()
  .trim()
  .min(10, 'api_key must be at least 10 characters')
  .max(128)
  .optional();

const imageUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return false;
    if (value.startsWith('data:')) return true;
    try {
      // eslint-disable-next-line no-new
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, 'image_url must be a valid URL or data URI');

const baseShape = {
  prompt: z.string().trim().min(1, 'prompt is required'),
  duration: durationSchema,
  api_key: apiKeySchema,
} as const;

const Sora2T2V = z
  .object({
    variant: z.literal('sora2'),
    mode: z.literal('t2v'),
    resolution: z.literal('720p'),
    aspect_ratio: z.enum(['16:9', '9:16']),
    ...baseShape,
  })
  .strict();

const Sora2I2V = z
  .object({
    variant: z.literal('sora2'),
    mode: z.literal('i2v'),
    resolution: z.enum(['auto', '720p']),
    aspect_ratio: z.enum(['auto', '16:9', '9:16']),
    image_url: imageUrlSchema,
    ...baseShape,
  })
  .strict();

const Sora2ProT2V = z
  .object({
    variant: z.literal('sora2pro'),
    mode: z.literal('t2v'),
    resolution: z.enum(['720p', '1080p']),
    aspect_ratio: z.enum(['16:9', '9:16']),
    ...baseShape,
  })
  .strict();

const Sora2ProI2V = z
  .object({
    variant: z.literal('sora2pro'),
    mode: z.literal('i2v'),
    resolution: z.enum(['auto', '720p', '1080p']),
    aspect_ratio: z.enum(['auto', '16:9', '9:16']),
    image_url: imageUrlSchema,
    ...baseShape,
  })
  .strict();

export const SORA_REQUEST_SCHEMA = z.union([Sora2T2V, Sora2I2V, Sora2ProT2V, Sora2ProI2V]);

export type SoraRequest = z.infer<typeof SORA_REQUEST_SCHEMA>;

export function isSoraEngineId(engineId: string): engineId is 'sora-2' | 'sora-2-pro' {
  return engineId === 'sora-2' || engineId === 'sora-2-pro';
}

export function getSoraVariantForEngine(engineId: string): SoraVariant {
  return engineId === 'sora-2-pro' ? 'sora2pro' : 'sora2';
}

export function parseSoraRequest(input: unknown): SoraRequest {
  return SORA_REQUEST_SCHEMA.parse(input);
}

type BuildResult = {
  model: string;
  input: Record<string, unknown>;
};

const MODEL_MAP: Record<SoraVariant, Record<SoraMode, string>> = {
  sora2: {
    t2v: 'fal-ai/sora-2/text-to-video',
    i2v: 'fal-ai/sora-2/image-to-video',
  },
  sora2pro: {
    t2v: 'fal-ai/sora-2/text-to-video/pro',
    i2v: 'fal-ai/sora-2/image-to-video/pro',
  },
};

export function buildSoraFalInput(request: SoraRequest): BuildResult {
  const model = MODEL_MAP[request.variant][request.mode];
  const input: Record<string, unknown> = {
    prompt: request.prompt,
    resolution: request.resolution,
    aspect_ratio: request.aspect_ratio,
    duration: request.duration,
  };

  if (request.api_key) {
    input.api_key = request.api_key;
  }

  if (request.mode === 'i2v') {
    input.image_url = request.image_url;
    input.input_image = request.image_url;
  }

  return { model, input };
}
