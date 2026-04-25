export type ModelPublicationStage = 'hidden' | 'public_noindex' | 'indexed';

export type ModelPagePublicationConfig = {
  indexable: boolean;
  includeInSitemap: boolean;
};

export type ExamplesPublicationConfig = {
  includeInFamilyResolver: boolean;
  includeInFamilyCopy: boolean;
};

export type ComparePublicationConfig = {
  suggestOpponents: string[];
  publishedPairs: string[];
  includeInHub: boolean;
};

export type AppPublicationConfig = {
  enabled: boolean;
  discoveryRank?: number;
  variantGroup?: string;
  variantLabel?: string;
};

export type PricingPublicationConfig = {
  includeInEstimator: boolean;
  featuredScenario?: string;
};

export type ModelPublicationSurfaces = {
  modelPage: ModelPagePublicationConfig;
  examples: ExamplesPublicationConfig;
  compare: ComparePublicationConfig;
  app: AppPublicationConfig;
  pricing: PricingPublicationConfig;
};

export type PartialModelPublicationSurfaces = Partial<{
  modelPage: Partial<ModelPagePublicationConfig>;
  examples: Partial<ExamplesPublicationConfig>;
  compare: Partial<ComparePublicationConfig>;
  app: Partial<AppPublicationConfig>;
  pricing: Partial<PricingPublicationConfig>;
}>;

export type ModelFamilyExamplesPageConfig = {
  stage: ModelPublicationStage;
  showInNav: boolean;
  publishedModelSlugs: string[];
};

export type ModelSurfaceDefaultsInput = {
  id: string;
  modelSlug: string;
  family?: string;
  category?: string;
};

export const LEGACY_SURFACELESS_MODEL_SLUGS = [
  'kling-2-5-turbo',
  'kling-2-6-pro',
  'kling-3-4k',
  'kling-3-pro',
  'kling-3-standard',
  'ltx-2',
  'ltx-2-3-fast',
  'ltx-2-3-pro',
  'ltx-2-fast',
  'minimax-hailuo-02-text',
  'nano-banana',
  'nano-banana-2',
  'nano-banana-pro',
  'pika-text-to-video',
  'seedance-1-5-pro',
  'seedance-2-0',
  'sora-2',
  'sora-2-pro',
  'veo-3-1',
  'veo-3-1-fast',
  'veo-3-1-lite',
  'wan-2-5',
  'wan-2-6',
] as const;

export const LEGACY_COMPARE_INDEXED_ENGINE_SLUGS = [
  'kling-2-5-turbo',
  'kling-2-6-pro',
  'kling-3-4k',
  'kling-3-pro',
  'kling-3-standard',
  'ltx-2',
  'ltx-2-3-fast',
  'ltx-2-3-pro',
  'ltx-2-fast',
  'luma-ray-2',
  'luma-ray-2-flash',
  'minimax-hailuo-02-text',
  'pika-text-to-video',
  'seedance-1-5-pro',
  'seedance-2-0',
  'sora-2',
  'sora-2-pro',
  'veo-3-1',
  'veo-3-1-fast',
  'veo-3-1-lite',
  'wan-2-5',
  'wan-2-6',
] as const;

export const LEGACY_APP_DISCOVERY_PRIORITY = [
  'sora-2',
  'sora-2-pro',
  'veo-3-1',
  'veo-3-1-fast',
  'veo-3-1-lite',
  'pika-text-to-video',
  'minimax-hailuo-02-text',
  'gpt-image-2',
  'nano-banana-2',
  'nano-banana-pro',
  'nano-banana',
] as const;

const LEGACY_COMPARE_SUGGESTED_OPPONENTS: Record<string, string[]> = {
  'veo-3-1': ['kling-3-pro', 'veo-3-1-fast', 'sora-2'],
  'veo-3-1-lite': ['veo-3-1-fast', 'veo-3-1', 'ltx-2-fast'],
  'kling-3-pro': ['kling-3-standard', 'kling-3-4k', 'veo-3-1'],
  'kling-3-standard': ['kling-3-pro', 'kling-3-4k', 'ltx-2-3-fast'],
  'kling-3-4k': ['kling-3-pro', 'veo-3-1', 'sora-2-pro'],
  'sora-2': ['veo-3-1', 'kling-3-pro', 'seedance-2-0'],
  'pika-text-to-video': ['seedance-2-0', 'minimax-hailuo-02-text', 'ltx-2-fast'],
  'seedance-1-5-pro': ['seedance-2-0', 'kling-3-pro', 'sora-2'],
  'seedance-2-0': ['sora-2', 'pika-text-to-video', 'seedance-1-5-pro'],
  'ltx-2-3-pro': ['ltx-2-3-fast', 'ltx-2-fast', 'sora-2'],
  'ltx-2-3-fast': ['ltx-2-3-pro', 'veo-3-1-fast', 'ltx-2-fast'],
  'wan-2-6': ['sora-2', 'veo-3-1', 'ltx-2-fast'],
  'veo-3-1-fast': ['ltx-2-fast', 'ltx-2-3-fast', 'veo-3-1'],
  'ltx-2-fast': ['veo-3-1-fast', 'wan-2-5', 'ltx-2-3-fast'],
};

const LEGACY_APP_VARIANTS: Record<string, Pick<AppPublicationConfig, 'variantGroup' | 'variantLabel'>> = {
  'sora-2': { variantGroup: 'sora', variantLabel: 'Standard' },
  'sora-2-pro': { variantGroup: 'sora', variantLabel: 'Pro' },
  'veo-3-1': { variantGroup: 'veo-3-1', variantLabel: 'Standard' },
  'veo-3-1-fast': { variantGroup: 'veo-3-1', variantLabel: 'Fast' },
  'veo-3-1-lite': { variantGroup: 'veo-3-1', variantLabel: 'Lite' },
  'kling-3-standard': { variantGroup: 'kling-3', variantLabel: 'Standard' },
  'kling-3-pro': { variantGroup: 'kling-3', variantLabel: 'Pro' },
  'kling-3-4k': { variantGroup: 'kling-3', variantLabel: '4K' },
  'ltx-2-3-pro': { variantGroup: 'ltx-2-3', variantLabel: 'Pro' },
  'ltx-2-3-fast': { variantGroup: 'ltx-2-3', variantLabel: 'Fast' },
};

const LEGACY_COMPARE_INDEXED_ENGINE_SLUG_SET = new Set<string>(LEGACY_COMPARE_INDEXED_ENGINE_SLUGS);
const LEGACY_APP_DISCOVERY_PRIORITY_INDEX = new Map<string, number>(
  LEGACY_APP_DISCOVERY_PRIORITY.map((id, index) => [id, index])
);
const LEGACY_SURFACELESS_MODEL_SLUG_SET = new Set<string>(LEGACY_SURFACELESS_MODEL_SLUGS);

function normalizeKey(value: string | undefined): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeStringArray(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  values.forEach((value) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    normalized.push(trimmed);
  });
  return normalized;
}

function hasOwn<T extends object>(value: T | undefined, key: keyof T): boolean {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

export function buildDefaultModelPublicationSurfaces(input: ModelSurfaceDefaultsInput): ModelPublicationSurfaces {
  const normalizedId = normalizeKey(input.id || input.modelSlug);
  const normalizedSlug = normalizeKey(input.modelSlug || input.id);
  const normalizedCategory = normalizeKey(input.category) || 'video';
  const includeExamples = normalizedCategory === 'video' && normalizeKey(input.family).length > 0;
  const includeInLegacyCompare = normalizedCategory === 'video' && LEGACY_COMPARE_INDEXED_ENGINE_SLUG_SET.has(normalizedSlug);
  const legacyVariant = LEGACY_APP_VARIANTS[normalizedId] ?? {};
  const discoveryRank = LEGACY_APP_DISCOVERY_PRIORITY_INDEX.get(normalizedId);

  return {
    modelPage: {
      indexable: true,
      includeInSitemap: true,
    },
    examples: {
      includeInFamilyResolver: includeExamples,
      includeInFamilyCopy: includeExamples,
    },
    compare: {
      suggestOpponents: normalizeStringArray(LEGACY_COMPARE_SUGGESTED_OPPONENTS[normalizedSlug]),
      publishedPairs: includeInLegacyCompare
        ? LEGACY_COMPARE_INDEXED_ENGINE_SLUGS.filter((slug) => slug !== normalizedSlug)
        : [],
      includeInHub: includeInLegacyCompare,
    },
    app: {
      enabled: true,
      discoveryRank,
      variantGroup: legacyVariant.variantGroup,
      variantLabel: legacyVariant.variantLabel,
    },
    pricing: {
      includeInEstimator: normalizedCategory !== 'audio',
    },
  };
}

export function mergeModelPublicationSurfaces(
  base: ModelPublicationSurfaces,
  override?: PartialModelPublicationSurfaces
): ModelPublicationSurfaces {
  const modelPage = override?.modelPage;
  const examples = override?.examples;
  const compare = override?.compare;
  const app = override?.app;
  const pricing = override?.pricing;

  return {
    modelPage: {
      indexable: modelPage?.indexable ?? base.modelPage.indexable,
      includeInSitemap: modelPage?.includeInSitemap ?? base.modelPage.includeInSitemap,
    },
    examples: {
      includeInFamilyResolver: examples?.includeInFamilyResolver ?? base.examples.includeInFamilyResolver,
      includeInFamilyCopy: examples?.includeInFamilyCopy ?? base.examples.includeInFamilyCopy,
    },
    compare: {
      suggestOpponents:
        compare && hasOwn(compare, 'suggestOpponents')
          ? normalizeStringArray(compare.suggestOpponents)
          : base.compare.suggestOpponents.slice(),
      publishedPairs:
        compare && hasOwn(compare, 'publishedPairs')
          ? normalizeStringArray(compare.publishedPairs)
          : base.compare.publishedPairs.slice(),
      includeInHub: compare?.includeInHub ?? base.compare.includeInHub,
    },
    app: {
      enabled: app?.enabled ?? base.app.enabled,
      discoveryRank: app?.discoveryRank ?? base.app.discoveryRank,
      variantGroup: app?.variantGroup ?? base.app.variantGroup,
      variantLabel: app?.variantLabel ?? base.app.variantLabel,
    },
    pricing: {
      includeInEstimator: pricing?.includeInEstimator ?? base.pricing.includeInEstimator,
      featuredScenario: pricing?.featuredScenario ?? base.pricing.featuredScenario,
    },
  };
}

export function getDefaultFamilyExamplesPageConfig(): ModelFamilyExamplesPageConfig {
  return {
    stage: 'hidden',
    showInNav: false,
    publishedModelSlugs: [],
  };
}

export function normalizeFamilyExamplesPageConfig(
  value?: Partial<ModelFamilyExamplesPageConfig>
): ModelFamilyExamplesPageConfig {
  const defaults = getDefaultFamilyExamplesPageConfig();
  return {
    stage: value?.stage ?? defaults.stage,
    showInNav: value?.showInNav ?? defaults.showInNav,
    publishedModelSlugs: normalizeStringArray(value?.publishedModelSlugs) ?? defaults.publishedModelSlugs,
  };
}

export function isGrandfatheredDefaultSurfaceModel(modelSlug: string | undefined): boolean {
  return LEGACY_SURFACELESS_MODEL_SLUG_SET.has(normalizeKey(modelSlug));
}
