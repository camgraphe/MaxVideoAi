import type { UpscaleMediaType, UpscaleToolEngineDefinition, UpscaleToolEngineId } from '@/types/tools-upscale';

export const UPSCALE_TOOL_ENGINES: readonly UpscaleToolEngineDefinition[] = [
  {
    id: 'seedvr-image',
    label: 'SeedVR2 Image Upscale',
    description: 'General-purpose image upscaling with factor or target resolution controls.',
    mediaType: 'image',
    falModelId: 'fal-ai/seedvr/upscale/image',
    billingProductKey: 'upscale-image-seedvr',
    defaultMode: 'factor',
    supportedModes: ['factor', 'target'],
    defaultUpscaleFactor: 2,
    supportedUpscaleFactors: [2, 4],
    defaultTargetResolution: '1080p',
    supportedTargetResolutions: ['720p', '1080p', '1440p', '2160p'],
    defaultOutputFormat: 'jpg',
    supportedOutputFormats: ['jpg', 'png', 'webp'],
    providerPriceUsd: { perMegapixel: 0.001 },
  },
  {
    id: 'topaz-image',
    label: 'Topaz Image Upscale',
    description: 'Premium image enhancement with Topaz models and face enhancement.',
    mediaType: 'image',
    falModelId: 'fal-ai/topaz/upscale/image',
    billingProductKey: 'upscale-image-topaz',
    defaultMode: 'factor',
    supportedModes: ['factor'],
    defaultUpscaleFactor: 2,
    supportedUpscaleFactors: [2, 4],
    defaultOutputFormat: 'jpg',
    supportedOutputFormats: ['jpg', 'png'],
    providerPriceUsd: { perImage: 0.08 },
    premium: true,
  },
  {
    id: 'recraft-crisp',
    label: 'Recraft Crisp Upscale',
    description: 'Crisp raster upscale focused on details and faces.',
    mediaType: 'image',
    falModelId: 'fal-ai/recraft/upscale/crisp',
    billingProductKey: 'upscale-image-recraft-crisp',
    defaultMode: 'factor',
    supportedModes: ['factor'],
    defaultUpscaleFactor: 2,
    supportedUpscaleFactors: [2],
    defaultOutputFormat: 'png',
    supportedOutputFormats: ['png'],
    providerPriceUsd: { perImage: 0.004 },
  },
  {
    id: 'seedvr-video',
    label: 'SeedVR2 Video Upscale',
    description: 'Video upscaling with temporal consistency and target resolution controls.',
    mediaType: 'video',
    falModelId: 'fal-ai/seedvr/upscale/video',
    billingProductKey: 'upscale-video-seedvr',
    defaultMode: 'target',
    supportedModes: ['factor', 'target'],
    defaultUpscaleFactor: 2,
    supportedUpscaleFactors: [2, 4],
    defaultTargetResolution: '1080p',
    supportedTargetResolutions: ['720p', '1080p', '1440p', '2160p'],
    defaultOutputFormat: 'mp4',
    supportedOutputFormats: ['mp4', 'webm', 'mov', 'gif'],
    providerPriceUsd: { perVideoMegapixelFrame: 0.001 / 1_000_000 },
  },
  {
    id: 'flashvsr-video',
    label: 'FlashVSR Video Upscale',
    description: 'Fast video upscaling for lower-cost post-processing passes.',
    mediaType: 'video',
    falModelId: 'fal-ai/flashvsr/upscale/video',
    billingProductKey: 'upscale-video-flashvsr',
    defaultMode: 'factor',
    supportedModes: ['factor'],
    defaultUpscaleFactor: 2,
    supportedUpscaleFactors: [2, 4],
    defaultOutputFormat: 'mp4',
    supportedOutputFormats: ['mp4'],
    providerPriceUsd: { perVideoMegapixelFrame: 0.0005 / 1_000_000 },
  },
  {
    id: 'topaz-video',
    label: 'Topaz Video Upscale',
    description: 'Premium professional-grade video enhancement using Topaz technology.',
    mediaType: 'video',
    falModelId: 'fal-ai/topaz/upscale/video',
    billingProductKey: 'upscale-video-topaz',
    defaultMode: 'target',
    supportedModes: ['target'],
    defaultUpscaleFactor: 2,
    supportedUpscaleFactors: [2],
    defaultTargetResolution: '1080p',
    supportedTargetResolutions: ['720p', '1080p', '1440p', '2160p'],
    defaultOutputFormat: 'mp4',
    supportedOutputFormats: ['mp4'],
    providerPriceUsd: {
      perSecondByResolution: {
        '720p': 0.01,
        '1080p': 0.02,
        '1440p': 0.08,
        '2160p': 0.08,
      },
    },
    premium: true,
  },
] as const;

const UPSCALE_TOOL_ENGINE_MAP = new Map(UPSCALE_TOOL_ENGINES.map((engine) => [engine.id, engine]));

export const DEFAULT_UPSCALE_IMAGE_ENGINE_ID: UpscaleToolEngineId = 'seedvr-image';
export const DEFAULT_UPSCALE_VIDEO_ENGINE_ID: UpscaleToolEngineId = 'seedvr-video';

export function listUpscaleToolEngines(mediaType?: UpscaleMediaType): readonly UpscaleToolEngineDefinition[] {
  return mediaType ? UPSCALE_TOOL_ENGINES.filter((engine) => engine.mediaType === mediaType) : UPSCALE_TOOL_ENGINES;
}

export function getUpscaleToolEngine(
  engineId?: string | null,
  mediaType: UpscaleMediaType = 'image'
): UpscaleToolEngineDefinition {
  const fallbackId = mediaType === 'video' ? DEFAULT_UPSCALE_VIDEO_ENGINE_ID : DEFAULT_UPSCALE_IMAGE_ENGINE_ID;
  const fallback = UPSCALE_TOOL_ENGINE_MAP.get(fallbackId)!;
  if (!engineId) return fallback;
  const engine = UPSCALE_TOOL_ENGINE_MAP.get(engineId as UpscaleToolEngineId);
  return engine?.mediaType === mediaType ? engine : fallback;
}
