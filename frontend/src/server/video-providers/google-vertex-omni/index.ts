import type { Mode } from '@/types/engines';
import type { VideoProviderAdapter } from '../types';
import { estimateGoogleVertexOmniCost } from './cost';
import { getGoogleVertexOmniClient } from './client';
import { classifyGoogleVertexOmniError } from './errors';
import { GOOGLE_VERTEX_OMNI_PROVIDER } from './model-map';
import { stageGoogleVertexOmniPayloadMedia } from './media-input';
import { buildGoogleVertexOmniOutputGcsUri, buildGoogleVertexOmniPayload } from './payload';
import { normalizeGoogleVertexOmniInteraction } from './response';

export const googleVertexOmniAdapter: VideoProviderAdapter = {
  key: GOOGLE_VERTEX_OMNI_PROVIDER,
  async submit(input) {
    const client = getGoogleVertexOmniClient();
    const inputGcsPrefix = (
      process.env.GOOGLE_VERTEX_OMNI_INPUT_GCS_URI
      ?? process.env.GOOGLE_VERTEX_INPUT_GCS_URI
      ?? process.env.GOOGLE_VERTEX_VEO_INPUT_GCS_URI
      ?? ''
    ).trim();
    const outputGcsPrefix = (
      process.env.GOOGLE_VERTEX_OMNI_OUTPUT_GCS_URI
      ?? process.env.GOOGLE_VERTEX_INPUT_GCS_URI
      ?? process.env.GOOGLE_VERTEX_VEO_OUTPUT_GCS_URI
      ?? process.env.GOOGLE_VERTEX_VEO_INPUT_GCS_URI
      ?? ''
    ).trim();
    const falPayload = {
      engineId: input.engineId,
      prompt: input.prompt,
      mode: input.mode,
      durationSec: input.durationSec,
      aspectRatio: input.aspectRatio ?? undefined,
      audio: input.audioEnabled,
      imageUrl: input.imageUrl ?? undefined,
      cfgScale: input.cfgScale,
    };
    const stagedFalPayload = input.imageUrl && !input.imageUrl.startsWith('gs://')
      ? await stageGoogleVertexOmniPayloadMedia({
          falPayload,
          inputGcsPrefix,
          objectNamespace: `omni-inputs/${input.publicJobId}`,
          accessToken: await client.accessToken(),
        })
      : falPayload;
    const payload = await buildGoogleVertexOmniPayload({
      engineId: input.engineId,
      mode: input.mode as Mode,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      aspectRatio: input.aspectRatio ?? null,
      durationSec: input.durationSec,
      resolution: '720p',
      outputGcsUri: buildGoogleVertexOmniOutputGcsUri(outputGcsPrefix, input.publicJobId),
      falPayload: stagedFalPayload,
    });
    const interaction = await client.createInteraction(payload);
    const normalized = normalizeGoogleVertexOmniInteraction(interaction);
    return {
      provider: GOOGLE_VERTEX_OMNI_PROVIDER,
      providerJobId: normalized.providerJobId,
      providerModel: payload.model,
      status: normalized.status,
      raw: interaction,
    };
  },
  async poll(input) {
    const interaction = await getGoogleVertexOmniClient().fetchInteraction(input.providerJobId);
    return normalizeGoogleVertexOmniInteraction(interaction, input.providerJobId);
  },
  normalizeResult: normalizeGoogleVertexOmniInteraction,
  normalizeError: classifyGoogleVertexOmniError,
  estimateCost: estimateGoogleVertexOmniCost,
};

export { GOOGLE_VERTEX_OMNI_PROVIDER, resolveGoogleVertexOmniModelRoute } from './model-map';
export { estimateGoogleVertexOmniCost } from './cost';
export { getGoogleVertexOmniClient } from './client';
export { classifyGoogleVertexOmniError } from './errors';
