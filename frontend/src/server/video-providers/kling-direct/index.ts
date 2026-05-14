import type { VideoProviderAdapter } from '../types';
import { getKlingDirectClient } from './client';
import { estimateKlingDirectCost } from './cost';
import { classifyKlingDirectError } from './errors';
import { resolveKlingDirectModelRoute, resolveKlingDirectPollPathPrefix } from './model-map';
import { buildKlingDirectPayload } from './payload';
import { normalizeKlingDirectTask } from './response';

export const klingDirectAdapter: VideoProviderAdapter = {
  key: 'kling_direct',
  async submit(input) {
    const payload = buildKlingDirectPayload({
      engineId: input.engineId,
      jobId: input.publicJobId,
      mode: input.mode,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      durationSec: input.durationSec,
      aspectRatio: input.aspectRatio,
      audioEnabled: input.audioEnabled,
      imageUrl: input.imageUrl,
      cfgScale: input.cfgScale,
    });
    const task = await getKlingDirectClient().createTask(payload);
    return {
      provider: 'kling_direct',
      providerJobId: task.providerJobId,
      providerModel: payload.providerModel,
      status: task.status,
      raw: task.raw,
    };
  },
  async poll(input) {
    const route = resolveKlingDirectModelRoute(input.engineId);
    const pollPathPrefix = input.pollPathPrefix ?? resolveKlingDirectPollPathPrefix(route, input.mode ?? 't2v');
    return getKlingDirectClient().retrieveTask({
      pollPathPrefix,
      providerJobId: input.providerJobId,
    });
  },
  normalizeResult: normalizeKlingDirectTask,
  normalizeError: classifyKlingDirectError,
  estimateCost: estimateKlingDirectCost,
};
