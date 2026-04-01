import {
  normalizeFamilyExamplesPageConfig,
  type ModelFamilyExamplesPageConfig,
} from './model-publication';

export type ModelFamilyDefinition = {
  id: string;
  label: string;
  navLabel: string;
  brandId?: string;
  defaultModelSlug?: string;
  routeAliases?: string[];
  aliases?: string[];
  prefixes?: string[];
  contains?: string[];
  examplesPage?: Partial<ModelFamilyExamplesPageConfig>;
};

export const MODEL_FAMILIES = [
  {
    id: 'sora',
    label: 'Sora',
    navLabel: 'Sora 2 Pro',
    brandId: 'openai',
    defaultModelSlug: 'sora-2-pro',
    routeAliases: ['sora-2', 'sora-2-pro'],
    aliases: ['sora-2', 'sora-2-pro'],
    prefixes: ['sora', 'openai-sora'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
      publishedModelSlugs: ['sora-2-pro', 'sora-2'],
    },
  },
  {
    id: 'kling',
    label: 'Kling',
    navLabel: 'Kling 3 Pro',
    brandId: 'kling',
    defaultModelSlug: 'kling-3-pro',
    routeAliases: ['kling-2-5-turbo', 'kling-2-6-pro', 'kling-3-standard', 'kling-3-pro'],
    prefixes: ['kling', 'fal-ai/kling-video'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
      publishedModelSlugs: ['kling-3-pro', 'kling-3-standard', 'kling-2-6-pro', 'kling-2-5-turbo'],
    },
  },
  {
    id: 'veo',
    label: 'Veo',
    navLabel: 'Veo 3.1',
    brandId: 'google-veo',
    defaultModelSlug: 'veo-3-1',
    routeAliases: ['veo-3-1', 'veo-3-1-fast'],
    aliases: ['veo-3', 'veo3', 'veo3.1', 'veo-3-fast', 'veo3-fast'],
    prefixes: ['veo', 'veo-3', 'veo3'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
      publishedModelSlugs: ['veo-3-1', 'veo-3-1-fast'],
    },
  },
  {
    id: 'wan',
    label: 'Wan',
    navLabel: 'Wan 2.6',
    brandId: 'wan',
    defaultModelSlug: 'wan-2-6',
    routeAliases: ['wan-2-5', 'wan-2-6'],
    aliases: ['wan-25', 'wan25', 'wan-26', 'wan26'],
    prefixes: ['wan', 'wan/'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
      publishedModelSlugs: ['wan-2-6', 'wan-2-5'],
    },
  },
  {
    id: 'seedance',
    label: 'Seedance',
    navLabel: 'Seedance 1.5 Pro',
    brandId: 'bytedance',
    defaultModelSlug: 'seedance-1-5-pro',
    routeAliases: ['seedance-1-5-pro', 'seedance-2-0'],
    aliases: ['seedance-1-5', 'seedance-v1-5-pro', 'seedance-v1.5-pro', 'seedance-2', 'seedance-2.0'],
    prefixes: ['seedance', 'fal-ai/bytedance/seedance'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
      publishedModelSlugs: ['seedance-1-5-pro'],
    },
  },
  {
    id: 'ltx',
    label: 'LTX',
    navLabel: 'LTX',
    brandId: 'lightricks',
    defaultModelSlug: 'ltx-2-3-pro',
    routeAliases: ['ltx-2-3', 'ltx-2-3-pro', 'ltx-2-3-fast', 'ltx-2', 'ltx-2-fast'],
    aliases: ['ltx-23', 'ltx23', 'ltx-23-fast', 'ltx23-fast'],
    prefixes: ['ltx', 'fal-ai/ltx'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
      publishedModelSlugs: ['ltx-2-3-pro', 'ltx-2-3-fast', 'ltx-2', 'ltx-2-fast'],
    },
  },
  {
    id: 'pika',
    label: 'Pika',
    navLabel: 'Pika 2.2',
    brandId: 'pika',
    defaultModelSlug: 'pika-text-to-video',
    routeAliases: ['pika-text-to-video', 'pika-image-to-video', 'pika-2-2'],
    aliases: ['pika-22', 'pika22'],
    prefixes: ['pika'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
      publishedModelSlugs: ['pika-text-to-video'],
    },
  },
  {
    id: 'hailuo',
    label: 'Hailuo',
    navLabel: 'MiniMax Hailuo 02',
    brandId: 'minimax',
    defaultModelSlug: 'minimax-hailuo-02-text',
    routeAliases: ['minimax-hailuo-02-text', 'minimax-hailuo-02-image'],
    aliases: ['minimax-hailuo-02'],
    prefixes: ['minimax-hailuo-02'],
    contains: ['hailuo'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
      publishedModelSlugs: ['minimax-hailuo-02-text'],
    },
  },
] as const satisfies readonly ModelFamilyDefinition[];

export type ModelFamilyId = (typeof MODEL_FAMILIES)[number]['id'];

export const PUBLIC_MARKETING_EXAMPLE_CANONICAL_SLUGS = MODEL_FAMILIES.filter((family) => {
  const examplesPage = normalizeFamilyExamplesPageConfig(family.examplesPage);
  return examplesPage.stage !== 'hidden';
}).map((family) => family.id) as ModelFamilyId[];

export const INDEXED_MARKETING_EXAMPLE_CANONICAL_SLUGS = MODEL_FAMILIES.filter((family) => {
  const examplesPage = normalizeFamilyExamplesPageConfig(family.examplesPage);
  return examplesPage.stage === 'indexed';
}).map((family) => family.id) as ModelFamilyId[];

export function getModelFamilyDefinition(id: string): ModelFamilyDefinition | null {
  const normalized = id.trim().toLowerCase();
  return MODEL_FAMILIES.find((family) => family.id === normalized) ?? null;
}

export function getModelFamilyExamplesPageConfig(id: string): ModelFamilyExamplesPageConfig | null {
  const family = getModelFamilyDefinition(id);
  if (!family) return null;
  return normalizeFamilyExamplesPageConfig(family.examplesPage);
}
