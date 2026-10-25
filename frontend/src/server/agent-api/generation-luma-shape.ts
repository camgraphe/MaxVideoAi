import { buildLumaAgentsVideoPayload } from '@/server/video-providers/luma-agents/payload';
import type { CanonicalGenerationRequest } from './generation-types';
/** Shape validation only. Private lineage is separately resolved with the transaction executor. */
export function validateLumaCanonicalShape(request: CanonicalGenerationRequest, extraInputValues: Record<string, unknown>) {
  const refs = request.references;
  if (request.mode === 'extend' && (!request.sourceJobId || refs.length > 1 || refs.some(ref => ref.role !== 'source' || ref.kind !== 'asset'))) {
    throw new Error('One owned source generation is required.');
  }
  buildLumaAgentsVideoPayload({ engineId: request.engineId, mode: request.mode, prompt: request.prompt,
    durationSec: Number(request.settings.durationSec ?? 5), resolution: String(request.settings.resolution ?? '720p'),
    aspectRatio: typeof request.settings.aspectRatio === 'string' ? request.settings.aspectRatio : undefined,
    loop: request.settings.loop === true,
    imageUrl: refs.some(ref => ref.role === 'first_frame' || (ref.role === 'source' && request.mode === 'i2v')) ? 'https://validation.invalid/start.png' : undefined,
    endImageUrl: refs.some(ref => ref.role === 'last_frame') ? 'https://validation.invalid/end.png' : undefined,
    videoUrl: request.mode === 'v2v' || request.mode === 'reframe' ? 'https://validation.invalid/source.mp4' : undefined,
    keyframeUrls: refs.filter(ref => ref.role === 'reference').map((_, i) => `https://validation.invalid/${i}.png`),
    extraInputValues,
    trustedGenerationSource: request.mode === 'extend' ? { providerGenerationId: 'shape-validation-only' } : undefined,
    extendDirection: request.settings.extendDirection as 'forward' | 'backward' | undefined,
  });
}
