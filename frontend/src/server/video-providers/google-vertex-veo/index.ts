import type { Mode } from '@/types/engines';
import type { VideoProviderAdapter } from '../types';
import { estimateGoogleVertexVeoCost } from './cost';
import { getGoogleVertexVeoClient } from './client';
import { classifyGoogleVertexVeoError } from './errors';
import { GOOGLE_VERTEX_VEO_PROVIDER, resolveGoogleVertexVeoModelRoute } from './model-map';
import { buildGoogleVertexVeoPayload } from './payload';
import { normalizeGoogleVertexVeoOperation } from './response';

export const googleVertexVeoAdapter: VideoProviderAdapter = {
  key: GOOGLE_VERTEX_VEO_PROVIDER,
  async submit(input) {
    const payload = await buildGoogleVertexVeoPayload({
      engineId: input.engineId,
      mode: input.mode as Mode,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      durationSec: input.durationSec,
      aspectRatio: input.aspectRatio ?? null,
      audioEnabled: input.audioEnabled,
      falPayload: {
        engineId: input.engineId,
        prompt: input.prompt,
        mode: input.mode,
        durationSec: input.durationSec,
        aspectRatio: input.aspectRatio ?? undefined,
        audio: input.audioEnabled,
        imageUrl: input.imageUrl ?? undefined,
        cfgScale: input.cfgScale,
      },
    });
    const operation = await getGoogleVertexVeoClient().createTask(payload);
    const normalized = normalizeGoogleVertexVeoOperation(operation);
    return {
      provider: GOOGLE_VERTEX_VEO_PROVIDER,
      providerJobId: normalized.providerJobId,
      providerModel: payload.providerModel,
      status: normalized.status,
      raw: operation,
    };
  },
  async poll(input) {
    const route = resolveGoogleVertexVeoModelRoute(input.engineId);
    const operation = await getGoogleVertexVeoClient().fetchOperation({
      providerModel: route.providerModel,
      operationName: input.providerJobId,
    });
    return normalizeGoogleVertexVeoOperation(operation, input.providerJobId);
  },
  normalizeResult: normalizeGoogleVertexVeoOperation,
  normalizeError: classifyGoogleVertexVeoError,
  estimateCost: estimateGoogleVertexVeoCost,
};

export { GOOGLE_VERTEX_VEO_PROVIDER } from './model-map';
export { estimateGoogleVertexVeoCost } from './cost';
export { getGoogleVertexVeoClient } from './client';
export { classifyGoogleVertexVeoError } from './errors';
