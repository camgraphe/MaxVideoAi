import type { RawFalEngineEntry } from './types';
import { createWan3Engine, WAN_3_MODE_CAPS } from './wan-3-shared';

export const WAN_3_PRIME_ENDPOINTS = {
  t2v: 'alibaba/wan-3.0-prime/text-to-video',
  i2v: 'alibaba/wan-3.0-prime/image-to-video',
  ref2v: 'alibaba/wan-3.0-prime/reference-to-video',
} as const;

const engine = createWan3Engine({
  id: 'wan-3-prime',
  label: 'Wan 3 Prime',
  version: '3.0 Prime',
  perSecondCents: { '480p': 6.8, '720p': 14, '1080p': 28 },
  perSecondUsd: { '480p': 0.068, '720p': 0.14, '1080p': 0.28 },
});

export const WAN_3_PRIME_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [{
  id: 'wan-3-prime', marketingName: 'Wan 3 Prime', cardTitle: 'Wan 3 Prime', provider: 'Alibaba', brandId: 'wan',
  versionLabel: '3.0 Prime', availability: 'available', logoPolicy: 'textOnly',
  billingNote: 'Fal bills each generated output second at $0.068 (480p), $0.14 (720p), or $0.28 (1080p).',
  engine,
  modes: [
    { mode: 't2v', falModelId: WAN_3_PRIME_ENDPOINTS.t2v, ui: WAN_3_MODE_CAPS.t2v! },
    { mode: 'i2v', falModelId: WAN_3_PRIME_ENDPOINTS.i2v, ui: WAN_3_MODE_CAPS.i2v! },
    { mode: 'ref2v', falModelId: WAN_3_PRIME_ENDPOINTS.ref2v, ui: WAN_3_MODE_CAPS.ref2v! },
  ],
  defaultFalModelId: WAN_3_PRIME_ENDPOINTS.t2v,
  seo: { title: 'Wan 3 Prime AI Video Generator | MaxVideoAI', description: 'Generate premium Wan 3 Prime video from text, images, or mixed references.', canonicalPath: '/models/wan-3-prime' },
  prompts: [
    { title: 'Premium cinematic scene', prompt: 'A premium cinematic commercial, controlled camera move, realistic motion, synchronized ambience.', mode: 't2v' },
    { title: 'Prime image animation', prompt: 'Animate the composition with precise subject preservation and polished cinematic motion.', mode: 'i2v' },
    { title: 'Prime mixed references', prompt: 'Synthesize the supplied image, video, and audio references into one consistent scene.', mode: 'ref2v' },
  ],
}];
