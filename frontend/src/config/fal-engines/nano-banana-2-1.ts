import { listNano21EditorialImages } from '../../../lib/nano21-editorial-images';
import type { EngineCaps } from '../../../types/engines';
import { NANO21_ASPECT_RATIOS, NANO21_ENGINE_ID, NANO21_MODEL_ID, NANO21_DEFAULT_MAX_OUTPUT_TOKENS } from '../../lib/nano-banana-2-1';
import type { RawFalEngineEntry } from './types';

const editorialHero=listNano21EditorialImages('nano-banana-2-1').find(image=>image.role==='hero');

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
      { id: 'enable_web_search', type: 'boolean', label: 'Web search', default: false },
      { id: 'enable_image_search', type: 'boolean', label: 'Image search', default: false },
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
  billingNote: 'Fixed price per image by output size. Supported reasoning and reference options are included.',
  modes: (['t2i', 'i2i'] as const).map(mode => ({ mode, falModelId: NANO21_MODEL_ID,
    ui: { modes: [mode], resolution: ['1k', '2k', '4k'], aspectRatio: NANO21_ASPECT_RATIOS,
      ...(mode === 'i2i' ? { acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'], maxUploadMB: 7 } : {}) } })),
  ...(editorialHero ? {media:{imagePath:editorialHero.display.url,videoUrl:editorialHero.original.url,altText:editorialHero.title}} : {}),
  defaultFalModelId: NANO21_MODEL_ID, type: 'image',
  seo: { title: 'Nano Banana 2.1 | MaxVideoAI', description: 'Google Vertex image generation and editing with up to 14 references, 1K to 4K output and three reasoning levels.', canonicalPath: '/models/nano-banana-2-1' },
  seoText: 'A distinct Google Vertex AI image model with fixed 1K, 2K and 4K customer prices.', prompts: [],
}];
