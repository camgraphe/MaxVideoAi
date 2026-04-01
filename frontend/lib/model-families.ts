import {
  getModelFamilyDefinition,
  getModelFamilyExamplesPageConfig,
  INDEXED_MARKETING_EXAMPLE_CANONICAL_SLUGS,
  MODEL_FAMILIES,
  PUBLIC_MARKETING_EXAMPLE_CANONICAL_SLUGS,
  type ModelFamilyDefinition,
  type ModelFamilyId,
} from '@/config/model-families';
import { listFalEngines } from '@/config/falEngines';
import { normalizeEngineId } from '@/lib/engine-alias';

type ExampleFamilyDescriptor = {
  id: ModelFamilyId;
  label: string;
  navLabel: string;
  brandId?: string;
  defaultModelSlug?: string;
};

type FamilyPageConfig = NonNullable<ReturnType<typeof getModelFamilyExamplesPageConfig>>;

const FAL_ENGINES = listFalEngines();
const ENGINE_LABEL_BY_MODEL_SLUG = new Map(FAL_ENGINES.map((entry) => [entry.modelSlug, entry.marketingName]));
const MODEL_FAMILY_LIST: readonly ModelFamilyDefinition[] = MODEL_FAMILIES;
const EXAMPLE_VARIANT_LABEL_OVERRIDES: Partial<Record<ModelFamilyId, Partial<Record<string, string>>>> = {};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function resolveEntryFamilyId(entry: {
  family?: string;
  brandId?: string;
}): ModelFamilyId | null {
  if (typeof entry.family === 'string' && entry.family.trim().length > 0) {
    const byFamily = getModelFamilyDefinition(entry.family);
    if (byFamily) return byFamily.id as ModelFamilyId;
  }

  if (typeof entry.brandId === 'string' && entry.brandId.trim().length > 0) {
    const brandId = entry.brandId.trim().toLowerCase();
    const byBrand = MODEL_FAMILY_LIST.find((family) => family.brandId === brandId);
    if (byBrand) return byBrand.id as ModelFamilyId;
  }

  return null;
}

function sortFamilyModelSlugs(family: ModelFamilyDefinition, modelSlugs: string[]): string[] {
  const uniqueSlugs = unique(modelSlugs);
  if (!family.defaultModelSlug || !uniqueSlugs.includes(family.defaultModelSlug)) {
    return uniqueSlugs;
  }

  return [family.defaultModelSlug, ...uniqueSlugs.filter((slug) => slug !== family.defaultModelSlug)];
}

const FAMILY_STATE = (() => {
  const aliasToFamily = new Map<string, ModelFamilyId>();
  const routeSlugs = new Set<string>();
  const publicFamilyIds: ModelFamilyId[] = [];
  const indexedFamilyIds: ModelFamilyId[] = [];
  const navFamilyIds: ModelFamilyId[] = [];
  const resolverModelSlugsByFamily = new Map<ModelFamilyId, string[]>();
  const copyCandidateSlugsByFamily = new Map<ModelFamilyId, string[]>();
  const publishedModelSlugsByFamily = new Map<ModelFamilyId, string[]>();
  const variantLabelsByFamily = new Map<ModelFamilyId, string[]>();

  const register = (key: string | null | undefined, familyId: ModelFamilyId) => {
    if (!key) return;
    const normalized = key.trim().toLowerCase();
    if (!normalized || aliasToFamily.has(normalized)) return;
    aliasToFamily.set(normalized, familyId);
  };

  MODEL_FAMILY_LIST.forEach((family) => {
    const familyId = family.id as ModelFamilyId;
    const examplesPage = getModelFamilyExamplesPageConfig(familyId);
    if (!examplesPage || examplesPage.stage === 'hidden') {
      return;
    }

    publicFamilyIds.push(familyId);
    if (examplesPage.stage === 'indexed') {
      indexedFamilyIds.push(familyId);
    }
    if (examplesPage.showInNav) {
      navFamilyIds.push(familyId);
    }

    register(family.id, familyId);
    routeSlugs.add(family.id);
    family.routeAliases?.forEach((alias) => {
      register(alias, familyId);
      routeSlugs.add(alias);
    });
    family.aliases?.forEach((alias) => register(alias, familyId));
  });

  FAL_ENGINES.forEach((entry) => {
    const familyId = resolveEntryFamilyId(entry);
    if (!familyId || !entry.surfaces.examples.includeInFamilyResolver) return;

    const examplesPage = getModelFamilyExamplesPageConfig(familyId);
    if (!examplesPage || examplesPage.stage === 'hidden') {
      return;
    }

    register(entry.id, familyId);
    register(entry.modelSlug, familyId);
    register(entry.defaultFalModelId, familyId);
    entry.modes.forEach((mode) => register(mode.falModelId, familyId));

    const resolverModelSlugs = resolverModelSlugsByFamily.get(familyId) ?? [];
    if (!resolverModelSlugs.includes(entry.modelSlug)) {
      resolverModelSlugs.push(entry.modelSlug);
      resolverModelSlugsByFamily.set(familyId, resolverModelSlugs);
    }

    if (entry.surfaces.examples.includeInFamilyCopy) {
      const copyCandidateSlugs = copyCandidateSlugsByFamily.get(familyId) ?? [];
      if (!copyCandidateSlugs.includes(entry.modelSlug)) {
        copyCandidateSlugs.push(entry.modelSlug);
        copyCandidateSlugsByFamily.set(familyId, copyCandidateSlugs);
      }
    }
  });

  publicFamilyIds.forEach((familyId) => {
    const family = getModelFamilyDefinition(familyId);
    const examplesPage = getModelFamilyExamplesPageConfig(familyId);
    if (!family || !examplesPage) {
      return;
    }

    const copyCandidateSlugs = copyCandidateSlugsByFamily.get(familyId) ?? [];
    const publishedFromConfig = examplesPage.publishedModelSlugs.filter((slug) => copyCandidateSlugs.includes(slug));
    const publishedModelSlugs = publishedFromConfig.length
      ? publishedFromConfig
      : sortFamilyModelSlugs(family, copyCandidateSlugs);

    publishedModelSlugsByFamily.set(familyId, publishedModelSlugs);
    variantLabelsByFamily.set(
      familyId,
      unique(
        publishedModelSlugs
          .map((slug) => EXAMPLE_VARIANT_LABEL_OVERRIDES[familyId]?.[slug] ?? ENGINE_LABEL_BY_MODEL_SLUG.get(slug) ?? null)
          .filter((value): value is string => Boolean(value))
      )
    );
  });

  return {
    aliasToFamily,
    routeSlugs: Array.from(routeSlugs),
    publicFamilyIds,
    indexedFamilyIds,
    navFamilyIds,
    resolverModelSlugsByFamily,
    publishedModelSlugsByFamily,
    variantLabelsByFamily,
  };
})();

export function getMarketingExampleRouteSlugs(): string[] {
  return FAMILY_STATE.routeSlugs.slice();
}

export function getExampleFamilyIds(): ModelFamilyId[] {
  return [...FAMILY_STATE.publicFamilyIds];
}

export function getIndexedExampleFamilyIds(): ModelFamilyId[] {
  return [...FAMILY_STATE.indexedFamilyIds];
}

export function getExampleNavFamilyIds(): ModelFamilyId[] {
  return [...FAMILY_STATE.navFamilyIds];
}

export function getExampleFamilyPageConfig(familyId: string): FamilyPageConfig | null {
  return getModelFamilyExamplesPageConfig(familyId);
}

export function getExampleFamilyDescriptor(
  raw: string | null | undefined,
  fallback?: { brandId?: string | undefined }
): ExampleFamilyDescriptor | null {
  const familyId = resolveExampleFamilyId(raw);
  if (!familyId) return null;

  const family = getModelFamilyDefinition(familyId);
  if (!family) return null;

  return {
    id: family.id as ModelFamilyId,
    label: family.label,
    navLabel: family.navLabel,
    brandId: family.brandId ?? fallback?.brandId,
    defaultModelSlug: family.defaultModelSlug,
  };
}

export function getExampleFamilyLabel(familyId: string): string | null {
  return getModelFamilyDefinition(familyId)?.label ?? null;
}

export function getExampleFamilyModelSlugs(familyId: string): string[] {
  const family = getModelFamilyDefinition(familyId);
  if (!family) return [];
  const published = FAMILY_STATE.publishedModelSlugsByFamily.get(family.id as ModelFamilyId) ?? [];
  if (published.length) return published.slice();
  const resolverModelSlugs = FAMILY_STATE.resolverModelSlugsByFamily.get(family.id as ModelFamilyId) ?? [];
  return sortFamilyModelSlugs(family, resolverModelSlugs);
}

export function getExampleFamilyPrimaryModelSlug(familyId: string): string | null {
  const family = getModelFamilyDefinition(familyId);
  if (!family) return null;
  const modelSlugs = getExampleFamilyModelSlugs(familyId);
  if (family.defaultModelSlug && modelSlugs.includes(family.defaultModelSlug)) {
    return family.defaultModelSlug;
  }
  return modelSlugs[0] ?? null;
}

export function getExampleFamilyVariantLabels(familyId: string): string[] {
  const family = getModelFamilyDefinition(familyId);
  if (!family) return [];
  const labels = FAMILY_STATE.variantLabelsByFamily.get(family.id as ModelFamilyId) ?? [];
  return unique(labels);
}

export function isExampleFamilyId(value: string): value is ModelFamilyId {
  return PUBLIC_MARKETING_EXAMPLE_CANONICAL_SLUGS.includes(value as ModelFamilyId);
}

export function isIndexedExampleFamilyId(value: string): value is ModelFamilyId {
  return INDEXED_MARKETING_EXAMPLE_CANONICAL_SLUGS.includes(value as ModelFamilyId);
}

export function resolveExampleFamilyId(raw: string | null | undefined): ModelFamilyId | null {
  if (!raw) return null;

  const normalizedRaw = raw.trim().toLowerCase();
  if (!normalizedRaw) return null;

  const normalized = normalizeEngineId(raw)?.trim().toLowerCase() ?? normalizedRaw;
  const direct = FAMILY_STATE.aliasToFamily.get(normalized) ?? FAMILY_STATE.aliasToFamily.get(normalizedRaw);
  if (direct) return direct;

  for (const family of MODEL_FAMILY_LIST) {
    const examplesPage = getModelFamilyExamplesPageConfig(family.id);
    if (!examplesPage || examplesPage.stage === 'hidden') {
      continue;
    }
    if (family.prefixes?.some((prefix) => normalized.startsWith(prefix) || normalizedRaw.startsWith(prefix))) {
      return family.id as ModelFamilyId;
    }
    if (family.contains?.some((token) => normalized.includes(token) || normalizedRaw.includes(token))) {
      return family.id as ModelFamilyId;
    }
  }

  return null;
}
