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
    typeof request.audioEnabled === 'boolean' ? (request.audioEnabled ? 'audio on' : 'audio off') : '',
    request.observedVideoTokens ? request.observedVideoTokens.toLocaleString('en-US') + ' observed tokens' : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    id,
    label,
    settings,
    engineId: request.engineId,
    engineLabel: getBaseEngineIncludingHidden(request.engineId)?.label ?? request.engineId,
    priceAssumption: request.engineId === 'wan-3'
      ? 'If the 30% Alibaba account discount applies, its estimate for this request is $' + (quote.baselineMicros * 0.7 / 1e6).toFixed(2) + '.'
      : null,
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
    scenario('start-frame', 'Start image', { ...wan, mode: 'i2v', images: 1, hasStartFrame: true }),
    scenario('frame-pair', 'First and last frames', {
      ...wan, mode: 'i2v', images: 1, hasStartFrame: true, hasEndFrame: true,
    }),
    scenario('two-references', 'Two reference images', { ...wan, mode: 'ref2v', durationSec: 30, images: 2 }),
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
    scenario('standard-reference', 'One reference image · list prices', {
      ...wan, engineId: 'wan-3', mode: 'ref2v', images: 1, durationSec: 30, aspectRatio: '9:16',
    }),
    scenario('standard-image', 'Start image · list prices', {
      ...wan, engineId: 'wan-3', mode: 'i2v', images: 1, hasStartFrame: true, durationSec: 5,
      resolution: '720p', audioEnabled: false,
    }),
    scenario('standard-text', 'Text to video · list prices', { ...wan, engineId: 'wan-3', durationSec: 30, aspectRatio: '9:16' }),
    scenario('h3-references', 'Three reference images', {
      ...wan, engineId: 'minimax-h3', mode: 'ref2v', images: 3, durationSec: 10, aspectRatio: '21:9', audioEnabled: undefined,
    }),
    scenario('h3-text', 'Text to video', { ...wan, engineId: 'minimax-h3', aspectRatio: '21:9', audioEnabled: undefined }),
    scenario('seedance-reference', 'Image reference · observed usage', {
      ...wan, engineId: 'seedance-2-5', mode: 'ref2v', images: 1, durationSec: 22, resolution: '720p', observedVideoTokens: 476100,
    }),
    scenario('seedance-text', 'Text to video · observed usage', {
      ...wan, engineId: 'seedance-2-5', durationSec: 7, aspectRatio: 'auto', observedVideoTokens: 67652,
    }),
    scenario('seedance-image', 'Start image · observed usage', {
      ...wan, engineId: 'seedance-2-5', mode: 'i2v', images: 1, hasStartFrame: true, durationSec: 4,
      aspectRatio: '3:4', audioEnabled: false, observedVideoTokens: 39927,
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
