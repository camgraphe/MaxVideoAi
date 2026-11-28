import type { GeneratePayload } from '@/lib/fal-types';
import { isWan3EngineId } from '@/lib/wan3-pricing';
import { encodeWanFlatRequest, wanFlatAdapters, wanFlatExclusion } from '@/lib/video-routing/wan-request';
import type { ComparisonRequest } from './comparison-offers';

/** Named lab scenarios only. No customer prompt, signed URL, or provider call enters this view. */
export function wanInputExamples(request: ComparisonRequest) {
  if (!isWan3EngineId(request.engineId) || typeof request.audioEnabled !== 'boolean') return [];
  const asset = (name: string) => 'https://example.invalid/' + name;
  const payload: GeneratePayload = {
    engineId: request.engineId, mode: request.mode, prompt: 'Example prompt', durationSec: request.durationSec,
    resolution: request.resolution, aspectRatio: request.aspectRatio ?? undefined, audio: request.audioEnabled,
    imageUrl: request.hasStartFrame ? asset('first.jpg') : undefined, endImageUrl: request.hasEndFrame ? asset('last.jpg') : undefined,
    referenceImages: Array.from({length: request.images - Number(request.hasStartFrame === true)}, (_, i) => asset('reference-' + (i + 1) + '.jpg')),
    inputs: request.referenceVideoSeconds?.map((durationSec, index) => ({
      name: 'Source clip', kind: 'video', type: 'video/mp4', size: 0, slotId: 'reference_video_urls',
      url: asset('reference-' + (index + 1) + '.mp4'), durationSec,
    })),
  };
  return (Object.keys(wanFlatAdapters) as (keyof typeof wanFlatAdapters)[]).flatMap(provider =>
    wanFlatExclusion(provider, request) ? [] : [{ provider, input: encodeWanFlatRequest(provider, payload) }]);
}
