import type { EngineCaps } from '../../../types/engines';
import { NANO21_ASPECT_RATIOS, NANO21_ENGINE_ID, NANO21_MODEL_ID, NANO21_DEFAULT_MAX_OUTPUT_TOKENS } from '../../lib/nano-banana-2-1';
import type { RawFalEngineEntry } from './types';
import { listPublicNano21EditorialRecipes } from '../../../lib/nano21-editorial-recipes';

const authoredHero = listPublicNano21EditorialRecipes().find(recipe => recipe.placement === 'hero');

const engine: EngineCaps = {
  id: NANO21_ENGINE_ID, label: 'Nano Banana 2.1', provider: 'Google', version: '2.1', status: 'live',
  latencyTier: 'standard', queueDepth: 0, region: 'global', modes: ['t2i', 'i2i'], maxDurationSec: 1,
  resolutions: ['1k', '2k', '4k'], aspectRatios: NANO21_ASPECT_RATIOS, fps: [1], audio: false,
  upscale4k: true, extend: false, motionControls: false, keyframes: false, params: {},
  // Conservative application byte limit. Published transport limits are 7 MB
  // inline / 30 MB GCS; this first lot uses owned originals up to 7,000,000 bytes.
  inputLimits: { imageMaxMB: 7 },
  inputSchema: {
    required: [{ id: 'prompt', type: 'text', label: 'Prompt' }],
    optional: [
      { id: 'num_images', type: 'number', label: 'Number of images', min: 1, max: 1, step: 1, default: 1 },
      { id: 'image_urls', type: 'image', label: 'Reference images', modes: ['i2i'], requiredInModes: ['i2i'], minCount: 1, maxCount: 14, source: 'either' },
      { id: 'resolution', type: 'enum', label: 'Resolution', values: ['1k', '2k', '4k'], default: '1k' },
      { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', values: NANO21_ASPECT_RATIOS, default: '1:1' },
      { id: 'thinking_level', type: 'enum', label: 'Thinking level', values: ['minimal', 'medium', 'high'], default: 'medium' },
      { id: 'max_output_tokens', type: 'number', label: 'Output token limit', min: 1, max: 32768, step: 1, default: NANO21_DEFAULT_MAX_OUTPUT_TOKENS },
      { id: 'system_instruction', type: 'text', label: 'System instruction' },
    ],
    constraints: { supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'], maxImageSizeMB: 7 },
  },
  updatedAt: '2026-10-25T00:00:00Z', ttlSec: 600,
  providerMeta: { provider: 'google_vertex_image', modelSlug: NANO21_MODEL_ID },
  availability: 'available', brandId: 'google',
};

export const NANO_BANANA_2_1_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [{
  id: NANO21_ENGINE_ID, marketingName: 'Nano Banana 2.1', cardTitle: 'Nano Banana 2.1', provider: 'Google', brandId: 'google',
  versionLabel: '2.1', availability: 'available', logoPolicy: 'textOnly', engine,
  billingNote: 'Requires a reviewed current customer tariff. Search is unavailable pending a separate provider budget.',
  modes: (['t2i', 'i2i'] as const).map(mode => ({ mode, falModelId: NANO21_MODEL_ID,
    ui: { modes: [mode], resolution: ['1k', '2k', '4k'], aspectRatio: NANO21_ASPECT_RATIOS,
      ...(mode === 'i2i' ? { acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'], maxUploadMB: 7 } : {}) } })),
  defaultFalModelId: NANO21_MODEL_ID, type: 'image',
  seo: { title: 'Nano Banana 2.1 | MaxVideoAI', description: 'Google Vertex image generation and editing with up to 14 references, 1K to 4K output and three reasoning levels.', canonicalPath: '/models/nano-banana-2-1' },
  seoText: 'A separate Vertex AI image model. Customer pricing and public release require review.', prompts: [],
  ...(authoredHero ? { media: { imagePath: authoredHero.media.display.url, videoUrl: authoredHero.media.original.url, altText: authoredHero.prompt } } : {}),
}];
