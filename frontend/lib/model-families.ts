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
import type { FalEngineEntry } from '@/config/falEngines';
import { normalizeFamilyExamplesPageConfig } from '@/config/model-publication';
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
}, families: readonly ModelFamilyDefinition[] = MODEL_FAMILY_LIST): ModelFamilyId | null {
  if (typeof entry.family === 'string' && entry.family.trim().length > 0) {
    const normalized = entry.family.trim().toLowerCase();
    const byFamily = families.find((family) => family.id === normalized);
    if (byFamily) return byFamily.id as ModelFamilyId;
  }

  if (typeof entry.brandId === 'string' && entry.brandId.trim().length > 0) {
    const brandId = entry.brandId.trim().toLowerCase();
    const byBrand = families.find((family) => family.brandId === brandId);
    if (byBrand) return byBrand.id as ModelFamilyId;
  }

  return null;
}

export function createExampleFamilyResolver({
  families,
  engines = listFalEngines(),
}: {
  families: readonly ModelFamilyDefinition[];
  engines?: readonly FalEngineEntry[];
}) {
  const aliasToFamily = new Map<string, ModelFamilyId>();
  const routeSlugs = new Set<string>();
  const publicFamilyIds: ModelFamilyId[] = [];
  const indexedFamilyIds: ModelFamilyId[] = [];
  const navFamilyIds: ModelFamilyId[] = [];
  const publishedModelSlugsByFamily = new Map<ModelFamilyId, string[]>();
  const currentModelSlugsByFamily = new Map<ModelFamilyId, string[]>();
  const variantLabelsByFamily = new Map<ModelFamilyId, string[]>();
  const engineAliasesByFamily = new Map<ModelFamilyId, string[]>();

  const register = (key: string | null | undefined, familyId: ModelFamilyId) => {
    if (!key) return;
    const normalized = key.trim().toLowerCase();
    if (!normalized || aliasToFamily.has(normalized)) return;
    aliasToFamily.set(normalized, familyId);
  };

  const familyById = new Map(families.map((family) => [family.id, family]));

  families.forEach((family) => {
    const familyId = family.id as ModelFamilyId;
    const examplesPage = normalizeFamilyExamplesPageConfig(family.examplesPage);
    if (examplesPage.stage === 'hidden') {
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

  engines.forEach((entry) => {
    const familyId = resolveEntryFamilyId(entry, families);
    if (!familyId) return;

    const family = familyById.get(familyId);
    const examplesPage = normalizeFamilyExamplesPageConfig(family?.examplesPage);
    if (examplesPage.stage === 'hidden' || !examplesPage.publishedModelSlugs.includes(entry.modelSlug)) {
      return;
    }

    register(entry.id, familyId);
    register(entry.modelSlug, familyId);
    register(entry.defaultFalModelId, familyId);
    entry.modes.forEach((mode) => register(mode.falModelId, familyId));
  });

  publicFamilyIds.forEach((familyId) => {
    const family = familyById.get(familyId);
    if (!family) {
      return;
    }
    const examplesPage = normalizeFamilyExamplesPageConfig(family.examplesPage);

    const publishedModelSlugs = examplesPage.publishedModelSlugs;
    const currentModelSlugs = examplesPage.currentModelSlugs.filter((slug) => publishedModelSlugs.includes(slug));

    publishedModelSlugsByFamily.set(familyId, publishedModelSlugs);
    currentModelSlugsByFamily.set(familyId, currentModelSlugs);
    variantLabelsByFamily.set(
      familyId,
      unique(
        publishedModelSlugs
          .map((slug) => EXAMPLE_VARIANT_LABEL_OVERRIDES[familyId]?.[slug] ?? ENGINE_LABEL_BY_MODEL_SLUG.get(slug) ?? null)
          .filter((value): value is string => Boolean(value))
      )
    );

    const aliasSet = new Set<string>();
    engines.forEach((entry) => {
      if (resolveEntryFamilyId(entry, families) !== familyId || !publishedModelSlugs.includes(entry.modelSlug)) {
        return;
      }
      const addAlias = (value: string | null | undefined) => {
        if (!value) return;
        const normalized = value.trim().toLowerCase();
        if (!normalized) return;
        aliasSet.add(normalized);
        const canonical = normalizeEngineId(value)?.trim().toLowerCase();
        if (canonical) {
          aliasSet.add(canonical);
        }
      };

      addAlias(entry.id);
      addAlias(entry.modelSlug);
      addAlias(entry.defaultFalModelId);
      entry.modes.forEach((mode) => addAlias(mode.falModelId));
    });
    engineAliasesByFamily.set(familyId, Array.from(aliasSet));
  });

  const resolveFamilyId = (raw: string | null | undefined): ModelFamilyId | null => {
    if (!raw) return null;
    const normalizedRaw = raw.trim().toLowerCase();
    if (!normalizedRaw) return null;
    const normalized = normalizeEngineId(raw)?.trim().toLowerCase() ?? normalizedRaw;
    const direct = aliasToFamily.get(normalized) ?? aliasToFamily.get(normalizedRaw);
    if (direct) return direct;

    for (const family of families) {
      const examplesPage = normalizeFamilyExamplesPageConfig(family.examplesPage);
      if (examplesPage.stage === 'hidden') continue;
      if (family.prefixes?.some((prefix) => normalized.startsWith(prefix) || normalizedRaw.startsWith(prefix))) {
        return family.id as ModelFamilyId;
      }
      if (family.contains?.some((token) => normalized.includes(token) || normalizedRaw.includes(token))) {
        return family.id as ModelFamilyId;
      }
    }
    return null;
  };

  return {
    aliasToFamily,
    routeSlugs: Array.from(routeSlugs),
    publicFamilyIds,
    indexedFamilyIds,
    navFamilyIds,
    publishedModelSlugsByFamily,
    currentModelSlugsByFamily,
    variantLabelsByFamily,
    engineAliasesByFamily,
    resolveFamilyId,
    getModelSlugs: (familyId: string) => [
      ...(publishedModelSlugsByFamily.get(familyId as ModelFamilyId) ?? []),
    ],
    getCurrentModelSlugs: (familyId: string) => [
      ...(currentModelSlugsByFamily.get(familyId as ModelFamilyId) ?? []),
    ],
    getNavFamilyIds: () => [...navFamilyIds],
  };
}

const FAMILY_STATE = createExampleFamilyResolver({
  families: MODEL_FAMILY_LIST,
  engines: FAL_ENGINES,
});

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
  return published.slice();
}

export function getExampleFamilyCurrentModelSlugs(familyId: string): string[] {
  const family = getModelFamilyDefinition(familyId);
  if (!family) return [];
  return [...(FAMILY_STATE.currentModelSlugsByFamily.get(family.id as ModelFamilyId) ?? [])];
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

export function getExampleFamilyEngineAliases(familyId: string): string[] {
  const family = getModelFamilyDefinition(familyId);
  if (!family) return [];
  return [...(FAMILY_STATE.engineAliasesByFamily.get(family.id as ModelFamilyId) ?? [])];
}

export function getExampleModelEngineAliases(modelSlug: string): string[] {
  const normalizedModelSlug = modelSlug.trim().toLowerCase();
  if (!normalizedModelSlug) return [];

  const entry = FAL_ENGINES.find((candidate) => candidate.modelSlug === normalizedModelSlug || candidate.id === normalizedModelSlug);
  if (!entry) {
    return [normalizedModelSlug];
  }

  const aliases = new Set<string>();
  const addAlias = (value: string | null | undefined) => {
    if (!value) return;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    aliases.add(normalized);
    const canonical = normalizeEngineId(value)?.trim().toLowerCase();
    if (canonical) {
      aliases.add(canonical);
    }
  };

  addAlias(entry.id);
  addAlias(entry.modelSlug);
  addAlias(entry.defaultFalModelId);
  entry.modes.forEach((mode) => addAlias(mode.falModelId));

  return Array.from(aliases);
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
  return FAMILY_STATE.resolveFamilyId(raw);
}
