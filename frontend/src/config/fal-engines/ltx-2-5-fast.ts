import type { RawFalEngineEntry } from './types';
import { createLtx25Engine } from './ltx-2-5-shared';

export const LTX_2_5_FAST_ENDPOINTS = {
  t2v: 'lightricks/ltx-2.5/text-to-video/fast',
  i2v: 'lightricks/ltx-2.5/image-to-video/fast',
  a2v: 'lightricks/ltx-2.5/audio-to-video/fast',
} as const;

const engine = createLtx25Engine({
  id: 'ltx-2-5-fast', label: 'LTX 2.5 Fast', variant: 'Fast',
  durationOptions: ['6', '8', '10', '12', '14', '16', '18', '20', 'auto'],
  providerResolutions: ['720p', '1080p', '1440p', '2160p'], engineResolutions: ['720p', '1080p', '1440p', '4k'],
  fps: [24, 25, 48, 50], maxDurationSec: 20, audioMaxDurationSec: 20,
  perSecondCents: { '720p': 9, '1080p': 13, '1440p': 19, '2160p': 30 },
  perSecondUsd: { '720p': 0.09, '1080p': 0.13, '1440p': 0.19, '2160p': 0.3 },
  audioPerInputSecondUsd: 0.13,
});

export const LTX_2_5_FAST_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [{
  id: 'ltx-2-5-fast', marketingName: 'LTX 2.5 Fast', cardTitle: 'LTX 2.5 Fast', provider: 'Lightricks', brandId: 'lightricks',
  versionLabel: '2.5 Fast', availability: 'available', logoPolicy: 'textOnly',
  billingNote: 'Text/image modes bill output seconds by resolution; audio-to-video bills input-audio seconds at $0.13/s. Task 5 supplies exact audio-duration pricing.',
  engine,
  modes: [
    { mode: 't2v', falModelId: LTX_2_5_FAST_ENDPOINTS.t2v, ui: engine.modeCaps!.t2v! },
    { mode: 'i2v', falModelId: LTX_2_5_FAST_ENDPOINTS.i2v, ui: engine.modeCaps!.i2v! },
    { mode: 'a2v', falModelId: LTX_2_5_FAST_ENDPOINTS.a2v, ui: engine.modeCaps!.a2v! },
  ],
  defaultFalModelId: LTX_2_5_FAST_ENDPOINTS.t2v,
  seo: { title: 'LTX 2.5 Fast AI Video | MaxVideoAI', description: 'Generate fast LTX 2.5 video from text, images, or source audio.', canonicalPath: '/models/ltx-2-5-fast' },
  prompts: [
    { title: 'Fast cinematic clip', prompt: 'A polished product reveal, fluid camera motion, natural synchronized audio.', mode: 't2v' },
    { title: 'Fast still animation', prompt: 'Animate the uploaded frame with realistic motion and a controlled camera move.', mode: 'i2v' },
    { title: 'Audio-driven performance', prompt: 'Build a cinematic performance around the rhythm and emotion of the source audio.', mode: 'a2v' },
  ],
}];
