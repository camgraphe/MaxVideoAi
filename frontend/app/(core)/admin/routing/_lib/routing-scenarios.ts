import { type PurchaseRequest, quoteVideoPurchase } from '@/server/video-providers/purchase-router';
import { getBaseEngineIncludingHidden } from '@/lib/engines';

const wan: PurchaseRequest = {
  engineId: 'wan-3-prime',
  mode: 't2v',
  durationSec: 15,
  resolution: '480p',
  aspectRatio: '16:9',
  images: 0,
  hasEndFrame: false,
  hasVideo: false,
  hasAudioReference: false,
  hasDocument: false,
  inputVideoSeconds: 0,
  audioEnabled: true,
};
const kling = { ...wan, engineId: 'kling-3-pro', durationSec: 5, resolution: '1080p' };

function scenario(id: string, label: string, request: PurchaseRequest) {
  const quote = quoteVideoPurchase(request);
  if (!quote || quote.baselineMicros < 0)
    throw new Error('Missing purchase policy or baseline for scenario ' + id);
  const seconds = request.hasVideo
    ? request.inputVideoSeconds + ' s input + ' + request.durationSec + ' s output'
    : request.durationSec + ' s';
  const settings = [
    seconds,
    request.resolution,
    request.aspectRatio,
    request.audioEnabled ? 'audio on' : 'audio off',
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    id,
    label,
    settings,
    engineId: request.engineId,
    engineLabel: getBaseEngineIncludingHidden(request.engineId)?.label ?? request.engineId,
    strategy: quote.strategy,
    candidates: quote.candidates,
    ceiling: quote.baselineMicros,
  };
}
export type RoutingScenario = ReturnType<typeof scenario>;

export function routingScenarios(): RoutingScenario[] {
  return [
    scenario('text', 'Text to video', wan),
    scenario('reference', 'One reference image', {
      ...wan,
      mode: 'ref2v',
      durationSec: 4,
      resolution: '720p',
      images: 1,
    }),
    scenario('video', 'Reference video', {
      ...wan,
      mode: 'ref2v',
      durationSec: 5,
      resolution: '720p',
      hasVideo: true,
      inputVideoSeconds: 5,
    }),
    scenario('extend', 'Extend video', {
      ...wan,
      mode: 'extend',
      durationSec: 5,
      resolution: '720p',
      hasVideo: true,
      inputVideoSeconds: 5,
    }),
    scenario('omni-reference', 'Two reference images', {
      ...kling,
      engineId: 'kling-o3-pro',
      mode: 'ref2v',
      durationSec: 10,
      images: 2,
      aspectRatio: '1:1',
    }),
    scenario('kling-text', 'Text to video', kling),
    scenario('kling-image', 'Start image', { ...kling, mode: 'i2v', images: 1, audioEnabled: false }),
    scenario('kling-camera', 'Start image with camera control', {
      ...kling,
      mode: 'i2v',
      images: 1,
      requiresDirectControls: true,
    }),
  ];
}
