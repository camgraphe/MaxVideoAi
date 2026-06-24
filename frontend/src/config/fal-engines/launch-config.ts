import type { EngineAvailability, EnginePricingDetails } from '../../../types/engines';
import {
  LEGACY_COMPARE_INDEXED_ENGINE_SLUGS,
  type PartialModelPublicationSurfaces,
} from '../../../config/model-publication';

// single confirmation pass when Fal publishes the final stable IDs.
export const SEEDANCE_2_ENDPOINTS = {
  standard: {
    t2v: 'bytedance/seedance-2.0/text-to-video',
    i2v: 'bytedance/seedance-2.0/image-to-video',
    ref2v: 'bytedance/seedance-2.0/reference-to-video',
  },
  fast: {
    t2v: 'bytedance/seedance-2.0/fast/text-to-video',
    i2v: 'bytedance/seedance-2.0/fast/image-to-video',
    ref2v: 'bytedance/seedance-2.0/fast/reference-to-video',
  },
} as const;

export const BYTEPLUS_SEEDANCE_2_FAST_MODEL_ID = 'dreamina-seedance-2-0-fast-260128';
export const BYTEPLUS_SEEDANCE_2_FAST_CAPS_ID = 'byteplus/dreamina-seedance-2.0-fast/text-to-video';

export const HAPPY_HORSE_ENDPOINTS = {
  t2v: 'alibaba/happy-horse/text-to-video',
  i2v: 'alibaba/happy-horse/image-to-video',
  ref2v: 'alibaba/happy-horse/reference-to-video',
  v2v: 'alibaba/happy-horse/video-edit',
} as const;

export const HAPPY_HORSE_1_1_ENDPOINTS = {
  t2v: 'alibaba/happy-horse/v1.1/text-to-video',
  i2v: 'alibaba/happy-horse/v1.1/image-to-video',
  ref2v: 'alibaba/happy-horse/v1.1/reference-to-video',
} as const;

export const HAPPY_HORSE_DURATION_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
export const HAPPY_HORSE_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const;
export const HAPPY_HORSE_1_1_ASPECT_RATIOS = [
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '3:4',
  '21:9',
  '9:21',
  '5:4',
  '4:5',
] as const;

export const SEEDANCE_2_TOKEN_DIMENSIONS = {
  '480p': {
    auto: { width: 854, height: 480 },
    '21:9': { width: 1120, height: 480 },
    '16:9': { width: 854, height: 480 },
    '4:3': { width: 640, height: 480 },
    '1:1': { width: 480, height: 480 },
    '3:4': { width: 480, height: 640 },
    '9:16': { width: 480, height: 854 },
  },
  '720p': {
    auto: { width: 1280, height: 720 },
    '21:9': { width: 1680, height: 720 },
    '16:9': { width: 1280, height: 720 },
    '4:3': { width: 960, height: 720 },
    '1:1': { width: 720, height: 720 },
    '3:4': { width: 720, height: 960 },
    '9:16': { width: 720, height: 1280 },
  },
  '1080p': {
    auto: { width: 1920, height: 1080 },
    '21:9': { width: 2520, height: 1080 },
    '16:9': { width: 1920, height: 1080 },
    '4:3': { width: 1440, height: 1080 },
    '1:1': { width: 1080, height: 1080 },
    '3:4': { width: 1080, height: 1440 },
    '9:16': { width: 1080, height: 1920 },
  },
} as const;

export function buildSeedance2PricingDetails(unitPriceUsdPer1kTokens: number): EnginePricingDetails {
  return {
    currency: 'USD',
    tokenPricing: {
      model: 'fal_tokens',
      unitPriceUsdPer1kTokens,
      framesPerSecond: 24,
      defaultAspectRatio: '16:9',
      dimensions: SEEDANCE_2_TOKEN_DIMENSIONS,
      rounding: 'ceil_cent',
    },
  };
}

export const SEEDANCE_2_LAUNCH_CONFIG = {
  isLive: true,
  availability: 'available' as EngineAvailability,
  modelPage: {
    indexable: true,
    includeInSitemap: true,
  },
  examples: {
    includeInFamilyResolver: true,
    includeInFamilyCopy: true,
  },
  pricing: {
    includeInEstimator: true,
    featuredScenario: 'seedance-2-family',
  },
  app: {
    variantGroup: 'seedance-2-0',
    standardRank: -2,
    fastRank: -1,
  },
  standard: {
    suggestOpponents: ['veo-3-1', 'kling-3-pro', 'sora-2'],
    publishedPairs: ['veo-3-1', 'kling-3-pro', 'sora-2'],
  },
  fast: {
    suggestOpponents: ['veo-3-1-fast', 'ltx-2-3-fast', 'sora-2'],
    publishedPairs: ['veo-3-1-fast', 'ltx-2-3-fast'],
  },
} as const;

export const SEEDANCE_COMPARE_PUBLISHED_SLUGS = Array.from(
  new Set([...LEGACY_COMPARE_INDEXED_ENGINE_SLUGS, 'seedance-2-0-fast'])
);

export function getSeedancePublishedPairs(modelSlug: string): string[] {
  return SEEDANCE_COMPARE_PUBLISHED_SLUGS.filter((slug) => slug !== modelSlug);
}

export function buildSeedance2Surfaces(
  variant: 'standard' | 'fast',
  variantLabel: 'Standard' | 'Fast'
): PartialModelPublicationSurfaces {
  const variantConfig = variant === 'standard' ? SEEDANCE_2_LAUNCH_CONFIG.standard : SEEDANCE_2_LAUNCH_CONFIG.fast;
  const modelSlug = variant === 'standard' ? 'seedance-2-0' : 'seedance-2-0-fast';
  const discoveryRank =
    variant === 'standard' ? SEEDANCE_2_LAUNCH_CONFIG.app.standardRank : SEEDANCE_2_LAUNCH_CONFIG.app.fastRank;

  return {
    modelPage: {
      indexable: SEEDANCE_2_LAUNCH_CONFIG.modelPage.indexable,
      includeInSitemap: SEEDANCE_2_LAUNCH_CONFIG.modelPage.includeInSitemap,
    },
    examples: {
      includeInFamilyResolver: SEEDANCE_2_LAUNCH_CONFIG.examples.includeInFamilyResolver,
      includeInFamilyCopy: SEEDANCE_2_LAUNCH_CONFIG.examples.includeInFamilyCopy,
    },
    compare: {
      suggestOpponents: [...variantConfig.suggestOpponents],
      publishedPairs: getSeedancePublishedPairs(modelSlug),
      includeInHub: SEEDANCE_2_LAUNCH_CONFIG.isLive,
    },
    app: {
      enabled: SEEDANCE_2_LAUNCH_CONFIG.isLive,
      discoveryRank,
      variantGroup: SEEDANCE_2_LAUNCH_CONFIG.app.variantGroup,
      variantLabel,
    },
    pricing: {
      includeInEstimator: SEEDANCE_2_LAUNCH_CONFIG.pricing.includeInEstimator,
      featuredScenario: SEEDANCE_2_LAUNCH_CONFIG.pricing.featuredScenario,
    },
  };
}
