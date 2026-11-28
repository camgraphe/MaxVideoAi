import type { AlibabaVideoPayload } from '../alibaba-model-studio/types';
import { createPinnedVideoRouterClient, VideoRouterSubmitError } from './client';
import { findBotSmartProfile } from './wan-profiles';

export { VideoRouterSubmitError } from './client';

export function createVideoRouterClient(key = process.env.VIDEOROUTER_API_KEY, fetcher = fetch) {
  const client = createPinnedVideoRouterClient(key, fetcher);
  return {
    getTask: client.getTask,
    async createVideo(payload: AlibabaVideoPayload) {
      const { input, parameters } = payload;
      const media = input.media ?? [];
      const engineId = payload.model === 'wan3.0-video-prime' ? 'wan-3-prime'
        : payload.model === 'wan3.0-video' ? 'wan-3' : '';
      const resolution = parameters.resolution.toLowerCase();
      const profile = findBotSmartProfile({ engineId, mode: media.length ? 'ref2v' : 't2v',
        durationSec: parameters.duration, resolution, aspectRatio: parameters.ratio, images: media.length });
      if (!profile || !input.prompt?.trim() || parameters.audio !== true || parameters.prompt_extend !== true ||
          parameters.seed !== undefined || media.some(m => m.type !== 'reference_image' || !m.url.startsWith('https://'))) {
        throw new VideoRouterSubmitError('refused', 'UNSUPPORTED_PILOT_INPUT');
      }
      return client.createVideo({
        hostModel: profile.hostModel,
        maximumUsd: profile.costMicros / 1e6,
        body: {
          model: profile.model, provider: { only: ['botsmart'], allow_fallbacks: false },
          duration_secs: parameters.duration, strict_duration: true, resolution, aspect_ratio: parameters.ratio,
          generate_audio: true, prompt_extend: true, prompt: input.prompt,
          ...(media.length ? { input_references: media.map(m => ({ type: 'image_url', image_url: { url: m.url } })) } : {}),
        },
      });
    },
  };
}
