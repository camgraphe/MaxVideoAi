import type { RawFalEngineEntry } from './types';
import { createWan3Engine, WAN_3_MODE_CAPS } from './wan-3-shared';

export const WAN_3_ENDPOINTS = {
  t2v: 'alibaba/wan-3.0/text-to-video',
  i2v: 'alibaba/wan-3.0/image-to-video',
  ref2v: 'alibaba/wan-3.0/reference-to-video',
} as const;

const engine = createWan3Engine({
  id: 'wan-3',
  label: 'Wan 3',
  version: '3.0',
  perSecondCents: { '480p': 5, '720p': 10, '1080p': 20 },
  perSecondUsd: { '480p': 0.05, '720p': 0.1, '1080p': 0.2 },
});

export const WAN_3_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [{
  id: 'wan-3', marketingName: 'Wan 3', cardTitle: 'Wan 3', provider: 'Alibaba', brandId: 'wan',
  versionLabel: '3.0', availability: 'available', logoPolicy: 'textOnly',
  billingNote: 'Fal bills each generated output second at $0.05 (480p), $0.10 (720p), or $0.20 (1080p).',
  engine,
  modes: [
    { mode: 't2v', falModelId: WAN_3_ENDPOINTS.t2v, ui: WAN_3_MODE_CAPS.t2v! },
    { mode: 'i2v', falModelId: WAN_3_ENDPOINTS.i2v, ui: WAN_3_MODE_CAPS.i2v! },
    { mode: 'ref2v', falModelId: WAN_3_ENDPOINTS.ref2v, ui: WAN_3_MODE_CAPS.ref2v! },
  ],
  defaultFalModelId: WAN_3_ENDPOINTS.t2v,
  seo: { title: 'Wan 3 AI Video Generator | MaxVideoAI', description: 'Generate Wan 3 video from text, images, or mixed references with native audio.', canonicalPath: '/models/wan-3' },
  prompts: [
    { title: 'Cinematic scene', prompt: 'A cinematic street at blue hour, natural dialogue and ambient sound, slow camera push.', mode: 't2v' },
    { title: 'Animate a still', prompt: 'Preserve the subject while adding subtle parallax, cloth motion, and a slow dolly move.', mode: 'i2v' },
    { title: 'Mixed references', prompt: 'Use the supplied visual and audio references to create a coherent cinematic sequence.', mode: 'ref2v' },
  ],
}];
