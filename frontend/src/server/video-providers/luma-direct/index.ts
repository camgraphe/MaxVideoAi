import type { Mode } from '@/types/engines';
import type { VideoProviderAdapter } from '../types';
import { getLumaDirectClient } from './client';
import { estimateLumaDirectCost } from './cost';
import { classifyLumaDirectError } from './errors';
import { LUMA_DIRECT_PROVIDER } from './model-map';
import { buildLumaDirectPayload } from './payload';
import { normalizeLumaDirectGeneration } from './response';

export const lumaDirectAdapter: VideoProviderAdapter = {
  key: LUMA_DIRECT_PROVIDER,
  async submit(input) {
    const payload = buildLumaDirectPayload({
      engineId: input.engineId,
      mode: input.mode as Mode,
      prompt: input.prompt,
      durationSec: input.durationSec,
      aspectRatio: input.aspectRatio ?? null,
      resolution: input.resolution ?? null,
      imageUrl: input.imageUrl ?? null,
      falPayload: {
        engineId: input.engineId,
        prompt: input.prompt,
        mode: input.mode,
        durationSec: input.durationSec,
        aspectRatio: input.aspectRatio ?? undefined,
        resolution: input.resolution ?? undefined,
        imageUrl: input.imageUrl ?? undefined,
      },
    });
    const generation = await getLumaDirectClient().createGeneration(payload);
    const normalized = normalizeLumaDirectGeneration(generation);
    return {
      provider: LUMA_DIRECT_PROVIDER,
      providerJobId: normalized.providerJobId,
      providerModel: payload.providerModel,
      status: normalized.status,
      raw: generation,
    };
  },
  async poll(input) {
    const generation = await getLumaDirectClient().fetchGeneration(input.providerJobId);
    return normalizeLumaDirectGeneration(generation, input.providerJobId);
  },
  normalizeResult: normalizeLumaDirectGeneration,
  normalizeError: classifyLumaDirectError,
  estimateCost: estimateLumaDirectCost,
};

export { LUMA_DIRECT_PROVIDER } from './model-map';
export { estimateLumaDirectCost } from './cost';
export { getLumaDirectClient } from './client';
export { classifyLumaDirectError } from './errors';
