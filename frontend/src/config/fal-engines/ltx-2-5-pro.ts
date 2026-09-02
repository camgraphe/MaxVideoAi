import type { RawFalEngineEntry } from './types';
import { createLtx25Engine } from './ltx-2-5-shared';

export const LTX_2_5_PRO_ENDPOINTS = {
  t2v: 'lightricks/ltx-2.5/text-to-video/pro',
  i2v: 'lightricks/ltx-2.5/image-to-video/pro',
  a2v: 'lightricks/ltx-2.5/audio-to-video/pro',
} as const;

const engine = createLtx25Engine({
  id: 'ltx-2-5-pro', label: 'LTX 2.5 Pro', variant: 'Pro',
  durationOptions: ['6', '8', '10', 'auto'], providerResolutions: ['720p', '1080p'], engineResolutions: ['720p', '1080p'],
  fps: [24, 25, 50], maxDurationSec: 10, audioMaxDurationSec: 10,
  perSecondCents: { '720p': 12, '1080p': 17 }, perSecondUsd: { '720p': 0.12, '1080p': 0.17 },
  audioPerInputSecondUsd: 0.17,
});

export const LTX_2_5_PRO_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [{
  id: 'ltx-2-5-pro', marketingName: 'LTX 2.5 Pro', cardTitle: 'LTX 2.5 Pro', provider: 'Lightricks', brandId: 'lightricks',
  versionLabel: '2.5 Pro', availability: 'available', logoPolicy: 'textOnly',
  billingNote: 'Text/image modes bill output seconds by resolution; audio-to-video bills input-audio seconds at $0.17/s. Task 5 supplies exact audio-duration pricing.',
  engine,
  modes: [
    { mode: 't2v', falModelId: LTX_2_5_PRO_ENDPOINTS.t2v, ui: engine.modeCaps!.t2v! },
    { mode: 'i2v', falModelId: LTX_2_5_PRO_ENDPOINTS.i2v, ui: engine.modeCaps!.i2v! },
    { mode: 'a2v', falModelId: LTX_2_5_PRO_ENDPOINTS.a2v, ui: engine.modeCaps!.a2v! },
  ],
  defaultFalModelId: LTX_2_5_PRO_ENDPOINTS.t2v,
  seo: { title: 'LTX 2.5 Pro AI Video | MaxVideoAI', description: 'Generate high-quality LTX 2.5 Pro video from text, images, or source audio.', canonicalPath: '/models/ltx-2-5-pro' },
  prompts: [
    { title: 'Pro cinematic clip', prompt: 'A premium cinematic sequence with precise motion, detailed lighting, and synchronized audio.', mode: 't2v' },
    { title: 'Pro still animation', prompt: 'Preserve the uploaded subject while adding polished motion and camera choreography.', mode: 'i2v' },
    { title: 'Pro audio performance', prompt: 'Create a detailed visual performance driven by the pacing and emotion of the source audio.', mode: 'a2v' },
  ],
}];
