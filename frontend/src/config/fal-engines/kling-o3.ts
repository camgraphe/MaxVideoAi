import type { EngineCaps, Resolution } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const KLING_O3_DURATION_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
const KLING_O3_ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const;
const KLING_O3_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'] as const;

type KlingO3Tier = {
  id: string;
  label: string;
  version: string;
  versionLabel: string;
  variantLabel: string;
  resolution: Resolution;
  basePerSecondCents: number;
  audioOffDiscountCents?: number;
  referenceImageLimit: number;
  videoInputPerSecondCents?: number;
  defaultModelSlug: string;
  mediaVideoUrl: string;
  mediaImagePath: string;
  bestFor: string;
};

const TIERS: KlingO3Tier[] = [
  {
    id: 'kling-o3-standard',
    label: 'Kling 3.0 Omni Standard',
    version: '3.0 Omni Standard',
    versionLabel: '3.0 Omni Standard',
    variantLabel: 'Standard',
    resolution: '1080p',
    basePerSecondCents: 12.6,
    audioOffDiscountCents: -4.2,
    referenceImageLimit: 4,
    videoInputPerSecondCents: 12.6,
    defaultModelSlug: 'fal-ai/kling-video/o3/standard/text-to-video',
    mediaVideoUrl:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/18fe2229-2610-473c-941f-f0421dae6ece.mp4',
    mediaImagePath:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/d34396ac-194c-4b8e-9b31-9843ea5b257c.jpg',
    bestFor: 'Reference-guided Kling 3.0 Omni storyboard drafts',
  },
  {
    id: 'kling-o3-pro',
    label: 'Kling 3.0 Omni Pro',
    version: '3.0 Omni Pro',
    versionLabel: '3.0 Omni Pro',
    variantLabel: 'Pro',
    resolution: '1080p',
    basePerSecondCents: 16.8,
    audioOffDiscountCents: -5.6,
    referenceImageLimit: 4,
    videoInputPerSecondCents: 16.8,
    defaultModelSlug: 'fal-ai/kling-video/o3/pro/text-to-video',
    mediaVideoUrl:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/764a0333-e1c6-43b5-bfc8-a158acf635bc.mp4',
    mediaImagePath:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/aaa6a0c9-aae0-4a74-9f7a-fcd9f6dffdc8.jpg',
    bestFor: 'Production Kling 3.0 Omni reference and storyboard guidance',
  },
  {
    id: 'kling-o3-4k',
    label: 'Kling 3.0 Omni 4K',
    version: '3.0 Omni 4K',
    versionLabel: '3.0 Omni 4K',
    variantLabel: '4K',
    resolution: '4k',
    basePerSecondCents: 42,
    referenceImageLimit: 7,
    defaultModelSlug: 'fal-ai/kling-video/o3/4k/text-to-video',
    mediaVideoUrl:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/af58f6f1-500e-4ff3-ba7c-409b52344b96.mp4',
    mediaImagePath:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/b8a9019e-e163-4aff-bcf7-f1174cb7ed14.jpg',
    bestFor: 'Native 4K reference-guided Kling 3.0 Omni delivery',
  },
];

function supportsVideoToVideo(tier: KlingO3Tier) {
  return typeof tier.videoInputPerSecondCents === 'number';
}

function endpointFor(
  tier: KlingO3Tier,
  mode: 'text-to-video' | 'image-to-video' | 'reference-to-video' | 'video-to-video/reference'
) {
  const tierPath = tier.id.endsWith('-4k') ? '4k' : tier.id.endsWith('-pro') ? 'pro' : 'standard';
  return `fal-ai/kling-video/o3/${tierPath}/${mode}`;
}

function buildPricingNotes(tier: KlingO3Tier) {
  if (tier.audioOffDiscountCents) {
    const audioOff = ((tier.basePerSecondCents + tier.audioOffDiscountCents) / 100).toFixed(3);
    const audioOn = (tier.basePerSecondCents / 100).toFixed(3);
    return `Provider cost: $${audioOff}/s audio off and $${audioOn}/s audio on for ${tier.label}. MaxVideoAI display prices add platform margin before showing quotes.`;
  }
  return `Provider cost: $${(tier.basePerSecondCents / 100).toFixed(3)}/s for ${tier.label}. MaxVideoAI display prices add platform margin before showing quotes.`;
}

function buildKlingO3Engine(tier: KlingO3Tier): EngineCaps {
  const hasVideoToVideo = supportsVideoToVideo(tier);
  return {
    id: tier.id,
    label: tier.label,
    provider: 'Kling by Kuaishou',
    version: tier.version,
    status: 'live',
    latencyTier: 'standard',
    queueDepth: 0,
    region: 'global',
    modes: hasVideoToVideo ? ['t2v', 'i2v', 'ref2v', 'v2v'] : ['t2v', 'i2v', 'ref2v'],
    maxDurationSec: 15,
    resolutions: [tier.resolution],
    aspectRatios: [...KLING_O3_ASPECT_RATIOS],
    fps: [24],
    audio: true,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: {
      imageMaxMB: 10,
      ...(hasVideoToVideo
        ? {
            videoMaxMB: 200,
            videoMaxDurationSec: 10,
            videoCodecs: ['mp4', 'mov'],
          }
        : {}),
      promptMaxChars: 2500,
      promptMaxCharsSource: 'observed',
    },
    inputSchema: {
      required: [
        {
          id: 'prompt',
          type: 'text',
          label: 'Prompt',
        },
        {
          id: 'image_url',
          type: 'image',
          label: 'Start frame',
          description: 'Used as the first frame for image-to-video generation.',
          modes: ['i2v'],
          requiredInModes: ['i2v'],
          minCount: 1,
          maxCount: 1,
          source: 'either',
        },
        ...(hasVideoToVideo
          ? [
              {
                id: 'video_url',
                type: 'video' as const,
                label: 'Source video',
                description:
                  'Reference video for video-to-video. Use @Video1 in the prompt to guide motion, camera language, or scene continuity.',
                modes: ['v2v' as const],
                requiredInModes: ['v2v' as const],
                minCount: 1,
                maxCount: 1,
                source: 'either' as const,
                minDurationSec: 3,
                maxDurationSec: 10,
              },
            ]
          : []),
      ],
      optional: [
        {
          id: 'image_urls',
          type: 'image',
          label: 'Reference / storyboard images',
          description:
            'Reference images guide style, appearance, storyboard direction, or video-edit styling without forcing the first image to appear as the opening frame. Refer to them as @Image1, @Image2, etc.',
          modes: hasVideoToVideo ? ['ref2v', 'v2v'] : ['ref2v'],
          minCount: 0,
          maxCount: tier.referenceImageLimit,
          source: 'either',
          slotLabelPattern: '@Image{n}',
        },
        {
          id: 'start_image_url',
          type: 'image',
          label: 'Optional start frame',
          description:
            'Optional opening frame for reference-to-video. Leave empty when reference images or elements should guide the shot without opening it.',
          modes: ['ref2v'],
          minCount: 0,
          maxCount: 1,
          source: 'either',
        },
        {
          id: 'duration',
          type: 'enum',
          label: 'Duration (seconds)',
          values: KLING_O3_DURATION_OPTIONS.map(String),
          default: '5',
          min: 3,
          max: 15,
        },
        {
          id: 'aspect_ratio',
          type: 'enum',
          label: 'Aspect ratio',
          values: [...KLING_O3_ASPECT_RATIOS],
          default: '16:9',
          modes: hasVideoToVideo ? ['t2v', 'ref2v', 'v2v'] : ['t2v', 'ref2v'],
        },
        {
          id: 'resolution',
          type: 'enum',
          label: 'Resolution',
          values: [tier.resolution],
          default: tier.resolution,
        },
        {
          id: 'generate_audio',
          type: 'enum',
          label: 'Audio',
          values: ['true', 'false'],
          default: 'true',
          modes: ['t2v', 'i2v', 'ref2v'],
        },
        ...(hasVideoToVideo
          ? [
              {
                id: 'keep_audio',
                type: 'boolean' as const,
                label: 'Keep source audio',
                description: 'Preserve the original source-video audio when the provider supports it.',
                modes: ['v2v' as const],
                default: true,
              },
            ]
          : []),
        {
          id: 'end_image_url',
          type: 'image',
          label: 'End frame (optional)',
          modes: ['i2v', 'ref2v'],
          minCount: 0,
          maxCount: 1,
          source: 'either',
        },
      ],
      constraints: {
        supportedFormats: [...KLING_O3_IMAGE_FORMATS],
        maxImageSizeMB: 10,
        minImageSidePx: 300,
        imageAspectRatioRange: '1:2.5 to 2.5:1',
      },
    },
    pricingDetails: {
      currency: 'USD',
      perSecondCents: {
        default: tier.basePerSecondCents,
        byResolution: {
          [tier.resolution]: tier.basePerSecondCents,
        },
      },
      addons: tier.audioOffDiscountCents
        ? {
            audio_off: {
              perSecondCents: tier.audioOffDiscountCents,
            },
          }
        : undefined,
    },
    pricing: {
      unit: 'USD/s',
      base: Number((tier.basePerSecondCents / 100).toFixed(3)),
      byResolution: {
        [tier.resolution]: Number((tier.basePerSecondCents / 100).toFixed(3)),
      },
      currency: 'USD',
      notes: buildPricingNotes(tier),
    },
    updatedAt: '2026-06-01T00:00:00Z',
    ttlSec: 600,
    providerMeta: {
      provider: 'kling',
      modelSlug: tier.defaultModelSlug,
    },
    availability: 'available',
    brandId: 'kling',
    modeCaps: {
      t2v: {
        modes: ['t2v'],
        duration: { options: [...KLING_O3_DURATION_OPTIONS], default: 5 },
        resolution: [tier.resolution],
        resolutionLocked: true,
        aspectRatio: [...KLING_O3_ASPECT_RATIOS],
        audioToggle: true,
        notes: 'Prompt-only Kling 3.0 Omni generation with native audio support.',
      },
      i2v: {
        modes: ['i2v'],
        duration: { options: [...KLING_O3_DURATION_OPTIONS], default: 5 },
        resolution: [tier.resolution],
        resolutionLocked: true,
        acceptsImageFormats: [...KLING_O3_IMAGE_FORMATS],
        maxUploadMB: 10,
        audioToggle: true,
        notes: 'Animate one start frame. The uploaded image is intended to appear as the opening frame.',
      },
      ref2v: {
        modes: ['ref2v'],
        duration: { options: [...KLING_O3_DURATION_OPTIONS], default: 5 },
        resolution: [tier.resolution],
        resolutionLocked: true,
        aspectRatio: [...KLING_O3_ASPECT_RATIOS],
        acceptsImageFormats: [...KLING_O3_IMAGE_FORMATS],
        maxUploadMB: 10,
        audioToggle: true,
        notes:
          'Reference-to-video for storyboard, visual reference images, elements, and optional start/end frames. Use @Image1, @Image2, and @Element1 anchors in the prompt.',
      },
      ...(hasVideoToVideo
        ? {
            v2v: {
              modes: ['v2v'] as const,
              duration: { options: [...KLING_O3_DURATION_OPTIONS], default: 5 },
              resolution: [tier.resolution],
              resolutionLocked: true,
              aspectRatio: [...KLING_O3_ASPECT_RATIOS],
              maxUploadMB: 200,
              audioToggle: false,
              notes:
                'Video-to-video reference/edit workflow from one 3-10s source clip, optional @Image references, Kling Elements, and keep-audio control.',
            },
          }
        : {}),
    },
  };
}

function buildKlingO3RegistryEntry(tier: KlingO3Tier): RawFalEngineEntry {
  const engine = buildKlingO3Engine(tier);
  return {
    id: tier.id,
    marketingName: tier.label,
    cardTitle: `${tier.label} - Reference-guided Kling video`,
    provider: 'Kling by Kuaishou',
    brandId: 'kling',
    versionLabel: tier.versionLabel,
    availability: 'available',
    logoPolicy: 'textOnly',
    engine,
    modes: [
      {
        mode: 't2v',
        falModelId: endpointFor(tier, 'text-to-video'),
        ui: engine.modeCaps?.t2v ?? { modes: ['t2v'] },
      },
      {
        mode: 'i2v',
        falModelId: endpointFor(tier, 'image-to-video'),
        ui: engine.modeCaps?.i2v ?? { modes: ['i2v'] },
      },
      {
        mode: 'ref2v',
        falModelId: endpointFor(tier, 'reference-to-video'),
        ui: engine.modeCaps?.ref2v ?? { modes: ['ref2v'] },
      },
      ...(supportsVideoToVideo(tier)
        ? [
            {
              mode: 'v2v' as const,
              falModelId: endpointFor(tier, 'video-to-video/reference'),
              ui: engine.modeCaps?.v2v ?? { modes: ['v2v' as const] },
            },
          ]
        : []),
    ],
    defaultFalModelId: tier.defaultModelSlug,
    seo: {
      title: supportsVideoToVideo(tier)
        ? `${tier.label} Reference, Storyboard and Video-to-Video Generator | MaxVideoAI`
        : `${tier.label} Reference and Storyboard 4K Generator | MaxVideoAI`,
      description: supportsVideoToVideo(tier)
        ? `Use ${tier.label} for reference-guided Kling video, storyboard images, @Image prompt anchors, optional start/end frames, video-to-video, and native audio.`
        : `Use ${tier.label} for native 4K reference-guided Kling video, storyboard images, @Image prompt anchors, optional start/end frames, and native audio.`,
      canonicalPath: `/models/${tier.id}`,
    },
    type: supportsVideoToVideo(tier) ? 'textImageReferenceVideoEdit' : 'textImageReference',
    seoText:
      `${tier.label} separates first-frame animation from visual reference workflows. Use image-to-video when the source image should open the clip, reference-to-video when storyboard and style images should guide the scene without becoming the first frame${supportsVideoToVideo(tier) ? ', or video-to-video when a source clip should guide motion and camera continuity' : ''}.`,
    media: {
      videoUrl: tier.mediaVideoUrl,
      imagePath: tier.mediaImagePath,
      altText: `${tier.label} reference-guided AI video preview`,
    },
    prompts: [
      {
        title: 'Storyboard reference sequence',
        prompt:
          'Use @Image1 and @Image2 as storyboard references for a 16:9 cinematic product reveal. Keep the character silhouette, color palette, and scene continuity from the references while generating new camera motion and native ambience.',
        mode: 'ref2v',
        notes: 'Use reference-to-video when the images should guide the scene without being forced as the opening frame.',
      },
      {
        title: 'Start-frame animation',
        prompt:
          'Animate the uploaded start frame with a slow dolly push, subtle parallax, stable subject edges, and soft native ambience.',
        mode: 'i2v',
      },
      ...(supportsVideoToVideo(tier)
        ? [
            {
              title: 'Reference video edit',
              prompt:
                'Use @Video1 for motion language and pacing, @Image1 as the visual style reference, and @Element1 as the consistent subject. Preserve the source camera rhythm while generating a polished cinematic variation.',
              mode: 'v2v' as const,
              notes: 'Upload one 3-10s source video, then add optional style images or Kling Elements as references.',
            },
          ]
        : []),
    ],
    faqs: [
      {
        question: `When should I use ${tier.label} instead of Kling 3?`,
        answer:
          'Use Kling 3 when the uploaded image should be the first frame. Use Kling 3.0 Omni reference-to-video when uploaded images should guide style, appearance, or storyboard continuity without being forced into the opening frame.',
      },
      {
        question: 'How do I reference storyboard images in the prompt?',
        answer:
          'Upload the images in Reference mode and mention them as @Image1, @Image2, and so on. Use short shot descriptions to explain what each reference should control.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: Math.round(tier.basePerSecondCents * 5),
      durationSeconds: 5,
      resolution: tier.resolution,
      label: 'Audio on',
    },
    promptExample:
      'Use @Image1 as character style and @Image2 as the storyboard composition. Generate a three-shot cinematic sequence with consistent lighting, clean camera movement, native ambience, and no readable text.',
  };
}

export const KLING_O3_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = TIERS.map(buildKlingO3RegistryEntry);
