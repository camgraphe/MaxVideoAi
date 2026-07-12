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

export type ModelFamilyExamplesPageConfig = {
  stage: ModelPublicationStage;
  showInNav: boolean;
  publishedModelSlugs: string[];
  currentModelSlugs: string[];
};

function normalizeStringArray(values: readonly string[] | undefined): string[] {
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

export function getDefaultFamilyExamplesPageConfig(): ModelFamilyExamplesPageConfig {
  return {
    stage: 'hidden',
    showInNav: false,
    publishedModelSlugs: [],
    currentModelSlugs: [],
  };
}

export function normalizeFamilyExamplesPageConfig(
  value?: Partial<ModelFamilyExamplesPageConfig>
): ModelFamilyExamplesPageConfig {
  const defaults = getDefaultFamilyExamplesPageConfig();
  return {
    stage: value?.stage ?? defaults.stage,
    showInNav: value?.showInNav ?? defaults.showInNav,
    publishedModelSlugs: normalizeStringArray(value?.publishedModelSlugs),
    currentModelSlugs: normalizeStringArray(value?.currentModelSlugs),
  };
}
