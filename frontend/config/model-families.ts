import {
  normalizeFamilyExamplesPageConfig,
  type ModelFamilyExamplesPageConfig,
} from './model-publication';
import {
  MODEL_LAUNCH_READY_MODELS,
  hasModelLaunchReadiness,
  type ModelLaunchReadinessEntry,
} from './model-launch-readiness';
import { listRuntimeModels, type RuntimeModelEntry } from './model-runtime';

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

type ModelFamilySource = Omit<ModelFamilyDefinition, 'defaultModelSlug' | 'examplesPage'> & {
  defaultModelId?: string;
  modelOrderIds?: readonly string[];
  examplesPage?: Pick<ModelFamilyExamplesPageConfig, 'stage' | 'showInNav'>;
};

const ASSET_GATED_LAUNCH_MODEL_IDS = new Set([
  'wan-3',
  'wan-3-prime',
  'ltx-2-5-fast',
  'ltx-2-5-pro',
  'grok-imagine-video-1-5',
  'flux-3',
  'flux-3-draft',
]);

const MODEL_FAMILY_SOURCES = [
  {
    id: 'sora',
    label: 'Sora',
    navLabel: 'Sora 2 Pro',
    brandId: 'openai',
    defaultModelId: 'sora-2-pro',
    routeAliases: ['sora-2', 'sora-2-pro'],
    aliases: ['sora-2', 'sora-2-pro'],
    prefixes: ['sora', 'openai-sora'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
    },
  },
  {
    id: 'kling',
    label: 'Kling',
    navLabel: 'Kling 3.0 Omni',
    brandId: 'kling',
    defaultModelId: 'kling-o3-pro',
    routeAliases: [
      'kling-2-5-turbo',
      'kling-2-6-pro',
      'kling-3-standard',
      'kling-3-pro',
      'kling-3-4k',
      'kling-o3-standard',
      'kling-o3-pro',
      'kling-o3-4k',
    ],
    aliases: ['kling-o3', 'kling-omni', 'kling-v3-omni'],
    prefixes: ['kling', 'fal-ai/kling-video'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
    },
  },
  {
    id: 'veo',
    label: 'Veo',
    navLabel: 'Veo 3.1',
    brandId: 'google-veo',
    defaultModelId: 'veo-3-1',
    routeAliases: ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite', 'gemini-omni-flash'],
    aliases: [
      'veo-3',
      'veo3',
      'veo3.1',
      'veo-3-fast',
      'veo3-fast',
      'veo-3-lite',
      'veo3-lite',
      'veo3.1-lite',
      'google-omni-flash',
      'omni-flash',
      'gemini-omni',
      'gemini-omni-flash-preview',
    ],
    prefixes: ['veo', 'veo-3', 'veo3', 'gemini-omni', 'google-omni'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
    },
  },
  {
    id: 'luma',
    label: 'Luma Ray',
    navLabel: 'Ray 3.2',
    brandId: 'luma',
    defaultModelId: 'luma-ray-3-2',
    routeAliases: ['luma-ray-2', 'luma-ray-2-flash', 'luma-ray-3-2'],
    aliases: ['ray-2', 'ray-2-flash', 'ray-3-2', 'lumaray2', 'lumaray2flash', 'lumaray32'],
    prefixes: ['luma', 'fal-ai/luma-dream-machine'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
    },
  },
  {
    id: 'wan',
    label: 'Wan',
    navLabel: 'Wan 2.6',
    brandId: 'wan',
    defaultModelId: 'wan-3-prime',
    modelOrderIds: ['wan-3-prime', 'wan-3', 'wan-2-6', 'wan-2-5'],
    routeAliases: ['wan-2-5', 'wan-2-6'],
    aliases: ['wan-25', 'wan25', 'wan-26', 'wan26'],
    prefixes: ['wan', 'wan/'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
    },
  },
  {
    id: 'seedance',
    label: 'Seedance',
    navLabel: 'Seedance 2.0',
    brandId: 'bytedance',
    defaultModelId: 'seedance-2-0',
    routeAliases: ['seedance-1-5-pro', 'seedance-2-0', 'seedance-2-0-fast', 'dreamina-seedance-2-0-mini'],
    aliases: [
      'seedance-1-5',
      'seedance-v1-5-pro',
      'seedance-v1.5-pro',
      'seedance-2',
      'seedance-2.0',
      'seedance-2-fast',
      'seedance-2.0-fast',
      'seedance-v2-fast',
      'seedance-v2.0-fast',
      'seedance mini',
      'seedance 2 mini',
      'seedance 2.0 mini',
      'dreamina seedance 2.0 mini',
    ],
    prefixes: ['seedance', 'fal-ai/bytedance/seedance', 'bytedance/seedance', 'bytedance/seedance-2.0'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
    },
  },
  {
    id: 'happy-horse',
    label: 'Happy Horse',
    navLabel: 'Happy Horse 1.1',
    brandId: 'alibaba',
    defaultModelId: 'happy-horse-1-1',
    routeAliases: ['happy-horse-1-1', 'happy-horse-1-0'],
    aliases: [
      'happyhorse',
      'happy-horse',
      'happyhorse-1-1',
      'happy-horse-1.1',
      'alibaba-happy-horse',
      'happyhorse-1-0',
      'happy-horse-1.0',
    ],
    prefixes: ['happy-horse', 'happyhorse', 'alibaba/happy-horse'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
    },
  },
  {
    id: 'ltx',
    label: 'LTX',
    navLabel: 'LTX',
    brandId: 'lightricks',
    defaultModelId: 'ltx-2-5-pro',
    modelOrderIds: ['ltx-2-5-pro', 'ltx-2-5-fast', 'ltx-2-3', 'ltx-2-3-fast', 'ltx-2', 'ltx-2-fast'],
    routeAliases: ['ltx-2-3', 'ltx-2-3-pro', 'ltx-2-3-fast', 'ltx-2', 'ltx-2-fast'],
    aliases: ['ltx-23', 'ltx23', 'ltx-23-fast', 'ltx23-fast'],
    prefixes: ['ltx', 'fal-ai/ltx'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
    },
  },
  {
    id: 'grok',
    label: 'Grok Imagine Video',
    navLabel: 'Grok Imagine Video 1.5',
    brandId: 'xai',
    defaultModelId: 'grok-imagine-video-1-5',
    modelOrderIds: ['grok-imagine-video-1-5'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
    },
  },
  {
    id: 'flux',
    label: 'FLUX',
    navLabel: 'FLUX 3',
    brandId: 'black-forest-labs',
    defaultModelId: 'flux-3',
    modelOrderIds: ['flux-3', 'flux-3-draft'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
    },
  },
  {
    id: 'pika',
    label: 'Pika',
    navLabel: 'Pika 2.2',
    brandId: 'pika',
    defaultModelId: 'pika-text-to-video',
    routeAliases: ['pika-text-to-video', 'pika-image-to-video', 'pika-2-2'],
    aliases: ['pika-22', 'pika22'],
    prefixes: ['pika'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
    },
  },
  {
    id: 'hailuo',
    label: 'MiniMax',
    navLabel: 'MiniMax H3',
    brandId: 'minimax',
    defaultModelId: 'minimax-h3',
    routeAliases: ['minimax-h3', 'minimax-hailuo-02-text', 'minimax-hailuo-02-image'],
    aliases: ['minimax-h3', 'hailuo-h3', 'hailuo-03', 'minimax-hailuo-02'],
    prefixes: ['minimax/h3', 'minimax-h3', 'hailuo-h3', 'minimax-hailuo-02'],
    contains: ['minimax', 'hailuo'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
    },
  },
] as const satisfies readonly ModelFamilySource[];

function materializeFamily(
  source: ModelFamilySource,
  models: readonly RuntimeModelEntry[],
  readiness: readonly ModelLaunchReadinessEntry[],
): ModelFamilyDefinition {
  const presentationOrder = new Map(source.modelOrderIds?.map((id, index) => [id, index]) ?? []);
  const members = models
    .filter((model) => model.family === source.id)
    .sort(
      (left, right) =>
        (presentationOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (presentationOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
        (left.publication.examples.familyRank ?? Number.MAX_SAFE_INTEGER) -
          (right.publication.examples.familyRank ?? Number.MAX_SAFE_INTEGER)
    );
  const eligibleMembers = members.filter(
    (model) =>
      model.publication.examples.published &&
      (!ASSET_GATED_LAUNCH_MODEL_IDS.has(model.id) ||
        (model.publication.model.published && hasModelLaunchReadiness(model.id, readiness))),
  );
  const defaultModel = members.find((model) => model.id === source.defaultModelId) ?? eligibleMembers[0];
  const published = eligibleMembers.map((model) => model.slug);
  const current = eligibleMembers
    .filter((model) => model.publication.examples.current)
    .map((model) => model.slug);
  const { defaultModelId: _defaultModelId, modelOrderIds: _modelOrderIds, ...presentation } = source;
  const isVisible = published.length > 0 && source.examplesPage?.stage !== 'hidden';

  return {
    ...presentation,
    defaultModelSlug: defaultModel?.slug,
    examplesPage: {
      stage: isVisible ? source.examplesPage?.stage ?? 'hidden' : 'hidden',
      showInNav: isVisible && (source.examplesPage?.showInNav ?? false),
      publishedModelSlugs: published,
      currentModelSlugs: current.length ? current : published,
    },
  };
}

export function buildModelFamilyDefinitions(
  models: readonly RuntimeModelEntry[],
  readiness: readonly ModelLaunchReadinessEntry[] = MODEL_LAUNCH_READY_MODELS,
): ModelFamilyDefinition[] {
  return MODEL_FAMILY_SOURCES.map((source) => materializeFamily(source, models, readiness));
}

export type ModelFamilyId = (typeof MODEL_FAMILY_SOURCES)[number]['id'];
export const MODEL_FAMILIES: readonly ModelFamilyDefinition[] = buildModelFamilyDefinitions(
  listRuntimeModels(),
  MODEL_LAUNCH_READY_MODELS,
);

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
