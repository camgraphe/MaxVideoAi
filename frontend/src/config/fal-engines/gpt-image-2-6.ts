import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import { listGpt26EditorialImages } from '../../../lib/gpt26-editorial-images';
import { GPT_IMAGE_26_SIZES, GPT_IMAGE_26_QUALITIES, GPT_IMAGE_26_COMPLEXITIES } from '../../../lib/image/gptImage26';
import { GPT_IMAGE_26_SIZE_LIMITS } from '../../../lib/image/gptImage26Dimensions';

function entry(variant: 'flare' | 'sunburst'): RawFalEngineEntry {
  const id = `gpt-image-2-6-${variant}`, modelId = `gpt-image-2.6-${variant}`;
  const variantLabel = variant === 'flare' ? 'Flare' : 'Sunburst';
  const label = `GPT Image 2.6 ${variantLabel}`;
  const hero = listGpt26EditorialImages(id).find(image => image.role === 'hero');
  const modes = ['t2i', 'i2i'] as const;
  const engine: EngineCaps = {
    id, label, provider: 'OpenAI', version: '2.6', variant: variantLabel,
    status: 'live', availability: 'available', latencyTier: variant === 'flare' ? 'fast' : 'standard',
    queueDepth: 0, region: 'global', modes: [...modes], maxDurationSec: 10, resolutions: [...GPT_IMAGE_26_SIZES],
    aspectRatios: [], fps: [], audio: false, upscale4k: false, extend: false, motionControls: false, keyframes: false, params: {},
    inputLimits: { promptMaxChars: 32000, promptMaxCharsSource: 'official', imageMaxMB: 25 },
    inputSchema: {
      required: [{ id: 'prompt', type: 'text', label: 'Prompt', modes: [...modes], requiredInModes: [...modes] }],
      optional: [
        { id: 'num_images', type: 'number', label: 'Number of images', min: 1, max: 10, step: 1, default: 1 },
        { id: 'image_urls', type: 'image', label: 'Reference images', modes: ['i2i'], requiredInModes: ['i2i'], minCount: 1, maxCount: 16, maxSizeMB: 25, source: 'either' },
        { id: 'resolution', engineParam: 'size', type: 'enum', label: 'Image size', values: [...GPT_IMAGE_26_SIZES], default: '1024x1024', description: 'Auto size uses the largest output size for the fixed quote, which may exceed the cost of the generated result.' },
        { id: 'image_width', type: 'number', label: 'Custom width', min: 16, max: 3840, step: 16, default: 1024, description: 'Use with custom size. Dimensions must contain 655360–8294400 pixels, with an aspect ratio from 1:3 to 3:1.' },
        { id: 'image_height', type: 'number', label: 'Custom height', min: 16, max: 3840, step: 16, default: 1024 },
        { id: 'quality', type: 'enum', label: 'Quality', values: [...GPT_IMAGE_26_QUALITIES], default: 'high', description: 'Auto quality uses Max quality for the fixed quote, which may exceed the cost of the generated result.' },
        { id: 'complexity', type: 'enum', label: 'Complexity', values: [...GPT_IMAGE_26_COMPLEXITIES], default: 'high', description: 'Planning effort before rendering, independent of quality.' },
        { id: 'background', type: 'enum', label: 'Background', values: ['auto', 'opaque', 'transparent'], default: 'auto' },
        { id: 'output_compression', type: 'number', label: 'Output compression', min: 0, max: 100, step: 1, description: 'JPEG or WebP only. Optional; omitted uses the provider default. Controls encoding, not generation price.' },
        { id: 'output_format', type: 'enum', label: 'Output format', values: ['png', 'jpeg', 'webp'], default: 'png' },
      ],
      constraints: { supportedFormats: ['png', 'jpg', 'jpeg', 'webp'], maxImageSizeMB: 25, imageSize: GPT_IMAGE_26_SIZE_LIMITS },
    },
    updatedAt: '2026-11-05T00:00:00Z', ttlSec: 600,
    providerMeta: { provider: 'openai_images', modelSlug: modelId }, brandId: 'openai',
  };
  return { id, marketingName: label, cardTitle: label, provider: 'OpenAI', brandId: 'openai', versionLabel: '2.6',
    availability: 'available', logoPolicy: 'logoAllowed', engine,
    // The shared catalog's historical property name is retained; this is an
    // OpenAI model ID dispatched by providerMeta, never a fabricated fal route.
    defaultFalModelId: modelId,
    modes: modes.map(mode => ({ mode, falModelId: modelId, ui: { modes: [mode], resolution: [...GPT_IMAGE_26_SIZES], aspectRatio: [], acceptsImageFormats: ['png', 'jpg', 'jpeg', 'webp'] } })),
    seo: { title: `${label} — image generation and editing | MaxVideoAI`, description: `Generate and edit raster images with ${label}, five quality levels and explicit planning complexity.`, canonicalPath: `/models/${id}` },
    ...(hero ? { media: { imagePath: hero.display.url, videoUrl: hero.original.url, altText: label } } : {}),
    prompts: [],
  };
}
export const GPT_IMAGE_2_6_ENGINE_REGISTRY = [entry('flare'), entry('sunburst')];
