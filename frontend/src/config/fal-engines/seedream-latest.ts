import type { EngineCaps } from '../../../types/engines';
import { SEEDREAM_ASPECT_RATIO_VALUES, SEEDREAM_SINGLE_IMAGE_RESOLUTION_VALUES } from '../../../lib/image/seedream';
import type { RawFalEngineEntry } from './types';

type SeedreamLatestDefinition = {
  id: 'seedream-5-5' | 'seedream-5-0-flash';
  label: string;
  version: string;
  providerModel: string;
  description: string;
  supplierOutputUsd: number;
  launchOutputCents: number;
};

function buildSeedreamLatestEntry(definition: SeedreamLatestDefinition): RawFalEngineEntry {
  const transparent = definition.id === 'seedream-5-5';
  const formats = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'gif'];
  const engine: EngineCaps = {
    id: definition.id,
    label: definition.label,
    provider: 'ByteDance',
    version: definition.version,
    status: 'live',
    latencyTier: definition.id === 'seedream-5-0-flash' ? 'fast' : 'standard',
    queueDepth: 0,
    region: 'global',
    modes: ['t2i', 'i2i'],
    maxDurationSec: 1,
    resolutions: [...SEEDREAM_SINGLE_IMAGE_RESOLUTION_VALUES],
    aspectRatios: [...SEEDREAM_ASPECT_RATIO_VALUES],
    fps: [1],
    audio: false,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: { imageMaxMB: 10 },
    inputSchema: {
      required: [{
        id: 'prompt', type: 'text', label: 'Prompt',
        description: 'Describe the image to create or the precise changes to make to your references.',
      }],
      optional: [
        { id: 'num_images', type: 'number', label: 'Images', min: 1, max: 1, step: 1, default: 1,
          description: `${definition.label} returns one image per request.` },
        { id: 'aspect_ratio', type: 'enum', label: 'Ratio', values: [...SEEDREAM_ASPECT_RATIO_VALUES], default: 'auto',
          description: 'Use automatic framing or select a supported ratio at the chosen resolution.' },
        { id: 'image_urls', type: 'image', label: 'Reference images', modes: ['i2i'], requiredInModes: ['i2i'],
          minCount: 1, maxCount: 10, source: 'either', description: 'Edit or combine up to ten source images.' },
        { id: 'resolution', engineParam: 'size', type: 'enum', label: 'Image size',
          values: [...SEEDREAM_SINGLE_IMAGE_RESOLUTION_VALUES], default: '2K',
          description: 'Choose 1K, 1.5K or 2K output. This direct model does not offer 3K or 4K.' },
        { id: 'output_format', engineParam: 'output_format', type: 'enum', label: 'Output format',
          values: ['jpeg', 'png'], default: transparent ? 'png' : 'jpeg',
          description: transparent ? 'PNG preserves a transparent background; JPEG is available for opaque images.'
            : 'Choose JPEG or PNG output.' },
        ...(transparent ? [{ id: 'background', type: 'enum' as const, label: 'Background',
          values: ['auto', 'opaque', 'transparent'], default: 'auto',
          description: 'Create native transparent assets with PNG, or keep an opaque background.' }] : []),
      ],
      constraints: { supportedFormats: formats, maxImageSizeMB: 10 },
    },
    // Catalogue hints are not customer quote authority; canonical launch tariffs own retail.
    pricingDetails: { currency: 'USD', flatCents: { default: definition.launchOutputCents },
      perSecondCents: { default: definition.launchOutputCents } },
    pricing: { unit: 'image', base: definition.supplierOutputUsd, currency: 'USD',
      notes: transparent ? 'Supplier output and every source image are billed separately. A current MaxVideoAI quote determines the customer total.'
        : 'Supplier inputs are free; customer pricing is determined by the current MaxVideoAI quote.' },
    updatedAt: '2026-11-13T00:00:00Z',
    ttlSec: 600,
    providerMeta: { provider: 'byteplus_modelark', modelSlug: definition.providerModel },
    availability: 'available',
    brandId: 'bytedance',
  };

  return {
    id: definition.id,
    marketingName: definition.label,
    cardTitle: definition.label,
    provider: 'ByteDance',
    brandId: 'bytedance',
    versionLabel: definition.version,
    availability: 'available',
    logoPolicy: 'textOnly',
    billingNote: 'One image per request. Review the current quote before generation.',
    engine,
    modes: (['t2i', 'i2i'] as const).map(mode => ({
      mode, falModelId: definition.providerModel,
      ui: { modes: [mode], resolution: [...SEEDREAM_SINGLE_IMAGE_RESOLUTION_VALUES],
        aspectRatio: [...SEEDREAM_ASPECT_RATIO_VALUES],
        ...(mode === 'i2i' ? { acceptsImageFormats: formats, maxUploadMB: 10 } : {}),
        notes: definition.description },
    })),
    defaultFalModelId: definition.providerModel,
    seo: { title: `${definition.label} AI Image Generator | MaxVideoAI`,
      description: definition.description, canonicalPath: `/models/${definition.id}` },
    type: 'image',
    seoText: definition.description,
    media: { videoUrl: '/assets/models/seedream-hero.webp', imagePath: '/assets/models/seedream-hero.webp',
      altText: 'Illustration of a camera lens reflecting a dream landscape; not an output from this model.' },
    prompts: [{ title: transparent ? 'Transparent product asset' : 'Product reference image', mode: 't2i',
      prompt: transparent ? 'A clear glass skincare bottle with a white label, isolated, precise edges, soft studio light, transparent background.'
        : 'A clean skincare product photograph on pale stone, soft daylight, realistic label, uncluttered composition.',
      notes: transparent ? 'Select PNG and a transparent background for a compositing asset.'
        : 'Use one output per request to explore a visual direction.' }],
    faqs: [{ question: `How many images can ${definition.label} return?`,
      answer: 'One image per request, with up to ten reference images for image-to-image editing.' }],
  };
}

export const SEEDREAM_LATEST_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  buildSeedreamLatestEntry({ id: 'seedream-5-5', label: 'Seedream 5.5', version: '5.5',
    providerModel: 'dola-seedream-5-5-261028', supplierOutputUsd: 0.035, launchOutputCents: 6,
    description: 'Create and edit images with ByteDance Seedream 5.5 in MaxVideoAI: up to ten references, 1K to 2K output and native transparent PNG assets.' }),
  buildSeedreamLatestEntry({ id: 'seedream-5-0-flash', label: 'Seedream 5.0 Flash', version: '5.0 Flash',
    providerModel: 'dola-seedream-5-0-flash-260915', supplierOutputUsd: 0.018, launchOutputCents: 3,
    description: 'Generate and edit images with ByteDance Seedream 5.0 Flash in MaxVideoAI: one output, up to ten references and 1K, 1.5K or 2K resolution.' }),
];
