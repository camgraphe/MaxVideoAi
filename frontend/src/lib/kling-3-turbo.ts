import {
  KLING_3_TURBO_ENDPOINTS,
  KLING_3_TURBO_ENGINE_IDS,
  KLING_3_TURBO_PROVIDER_COST_CENTS_PER_SECOND,
  KLING_3_TURBO_TEXT_ASPECT_RATIOS,
  type Kling3TurboEngineId,
  type Kling3TurboMode,
} from '@/src/config/fal-engines/kling-3-turbo-shared';

export type Kling3TurboMultiPrompt = {
  prompt: string;
  durationSec: number;
};

export type Kling3TurboRequestInput = {
  engineId: Kling3TurboEngineId;
  mode: Kling3TurboMode;
  durationSec: number;
  prompt?: string | null;
  multiPrompt?: readonly Kling3TurboMultiPrompt[] | null;
  aspectRatio?: string | null;
  imageUrl?: string | null;
};

export type NormalizedKling3TurboRequest = {
  engineId: Kling3TurboEngineId;
  mode: Kling3TurboMode;
  durationSec: number;
  prompt?: string;
  multiPrompt?: Array<{ prompt: string; durationSec: number }>;
  aspectRatio?: (typeof KLING_3_TURBO_TEXT_ASPECT_RATIOS)[number];
  imageUrl?: string;
};

export function isKling3TurboEngineId(value: string): value is Kling3TurboEngineId {
  return (KLING_3_TURBO_ENGINE_IDS as readonly string[]).includes(value);
}

function validateDuration(value: number, label: string, minimum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > 15) {
    throw new Error(`${label} must be an integer from ${minimum} through 15 seconds.`);
  }
  return value;
}

export function normalizeKling3TurboRequest(input: Kling3TurboRequestInput): NormalizedKling3TurboRequest {
  if (!isKling3TurboEngineId(input.engineId)) {
    throw new Error(`Unsupported Kling 3 Turbo engine: ${input.engineId}`);
  }
  if (input.mode !== 't2v' && input.mode !== 'i2v') {
    throw new Error(`Unsupported Kling 3 Turbo mode: ${input.mode}`);
  }

  const durationSec = validateDuration(input.durationSec, 'Duration', 3);
  const prompt = input.prompt?.trim() ?? '';
  const multiPrompt = input.multiPrompt?.map((shot) => ({
    prompt: shot.prompt.trim(),
    durationSec: validateDuration(shot.durationSec, 'Multi-shot duration', 1),
  })) ?? [];

  if (prompt && multiPrompt.length) {
    throw new Error('Single prompt and multi-shot prompts are mutually exclusive.');
  }
  if (multiPrompt.length > 6) {
    throw new Error('Kling 3 Turbo supports one to six multi-shot prompts.');
  }
  if (multiPrompt.some((shot) => !shot.prompt)) {
    throw new Error('Each multi-shot prompt is required.');
  }
  const multiPromptDuration = multiPrompt.reduce((total, shot) => total + shot.durationSec, 0);
  if (multiPromptDuration > 15) {
    throw new Error('Multi-shot prompt durations cannot exceed 15 seconds.');
  }
  if (multiPrompt.length && multiPromptDuration !== durationSec) {
    throw new Error('Duration must equal the total multi-shot prompt duration.');
  }
  if (input.mode === 't2v' && !prompt && !multiPrompt.length) {
    throw new Error('A single prompt or multi-shot prompts are required for text-to-video.');
  }

  const imageUrl = input.imageUrl?.trim() ?? '';
  if (input.mode === 'i2v' && !imageUrl) {
    throw new Error('image_url is required for Kling 3 Turbo image-to-video.');
  }

  const normalized: NormalizedKling3TurboRequest = {
    engineId: input.engineId,
    mode: input.mode,
    durationSec,
  };
  if (prompt) normalized.prompt = prompt;
  if (multiPrompt.length) normalized.multiPrompt = multiPrompt;
  if (input.mode === 't2v') {
    const aspectRatio = input.aspectRatio?.trim() || '16:9';
    if (!(KLING_3_TURBO_TEXT_ASPECT_RATIOS as readonly string[]).includes(aspectRatio)) {
      throw new Error(`Unsupported Kling 3 Turbo aspect ratio: ${aspectRatio}`);
    }
    normalized.aspectRatio = aspectRatio as NormalizedKling3TurboRequest['aspectRatio'];
  }
  if (imageUrl) normalized.imageUrl = imageUrl;
  return normalized;
}

export function buildKling3TurboFalFallbackRequest(input: Kling3TurboRequestInput): {
  model: string;
  requestBody: Record<string, unknown>;
} {
  const request = normalizeKling3TurboRequest(input);
  const requestBody: Record<string, unknown> = {
    duration: String(request.durationSec),
  };
  if (request.prompt) requestBody.prompt = request.prompt;
  if (request.multiPrompt) {
    requestBody.multi_prompt = request.multiPrompt.map(({ prompt, durationSec }) => ({
      prompt,
      duration: String(durationSec),
    }));
  }
  if (request.aspectRatio) requestBody.aspect_ratio = request.aspectRatio;
  if (request.imageUrl) requestBody.image_url = request.imageUrl;

  return {
    model: KLING_3_TURBO_ENDPOINTS[request.engineId][request.mode],
    requestBody,
  };
}

export function calculateKling3TurboProviderCost(input: {
  engineId: Kling3TurboEngineId;
  durationSec: number;
}): { rateCentsPerSecond: number; providerCostExactCents: number } {
  const durationSec = validateDuration(input.durationSec, 'Duration', 3);
  const rateCentsPerSecond = KLING_3_TURBO_PROVIDER_COST_CENTS_PER_SECOND[input.engineId];
  if (rateCentsPerSecond === undefined) {
    throw new Error(`Unsupported Kling 3 Turbo engine: ${input.engineId}`);
  }
  return {
    rateCentsPerSecond,
    providerCostExactCents: Number((rateCentsPerSecond * durationSec).toFixed(6)),
  };
}
