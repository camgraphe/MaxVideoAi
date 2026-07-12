import runtimeDocument from './model-runtime.json' with { type: 'json' };
import type { ModelPublicationSurfaces } from './model-publication';
import type { ModelRegistryEntry } from './model-registry-validation';

export type RuntimeModelEntry = Omit<ModelRegistryEntry, 'replacement'> & { publicTargetId?: string };
export type ModelRuntimeDocument = {
  schemaVersion: 1;
  models: RuntimeModelEntry[];
};

export function createRuntimeModelResolver(document: ModelRuntimeDocument) {
  const models = document.models;
  const byId = new Map(models.map((model) => [model.id.toLowerCase(), model]));
  const bySlug = new Map(models.map((model) => [model.slug.toLowerCase(), model]));
  const byEngineInput = new Map<string, RuntimeModelEntry>();
  const byPublicSlug = new Map<string, RuntimeModelEntry>();

  for (const model of models) {
    for (const value of [model.id, model.slug, ...model.aliases.internal]) {
      byEngineInput.set(value.trim().toLowerCase(), model);
    }
    const targetId = model.publicTargetId ?? model.id;
    const target = byId.get(targetId.trim().toLowerCase());
    if (!target) throw new Error(`Model runtime public target is missing "${targetId}"`);
    for (const value of [model.slug, ...model.aliases.publicSlugs]) {
      const key = value.trim().toLowerCase();
      const existing = byPublicSlug.get(key);
      if (existing && existing.id !== target.id) {
        throw new Error(`Model runtime public slug target is ambiguous "${value}"`);
      }
      byPublicSlug.set(key, target);
    }
  }

  return {
    models,
    getById: (id: string) => byId.get(id.trim().toLowerCase()) ?? null,
    getByCanonicalSlug: (slug: string) => bySlug.get(slug.trim().toLowerCase()) ?? null,
    resolveEngineInput: (value: string | null | undefined) => {
      const key = value?.trim().toLowerCase();
      return key ? byEngineInput.get(key) ?? null : null;
    },
    resolvePublicSlug: (slug: string) => byPublicSlug.get(slug.trim().toLowerCase()) ?? null,
  };
}

const runtimeResolver = createRuntimeModelResolver(runtimeDocument as ModelRuntimeDocument);

export function listRuntimeModels(): readonly RuntimeModelEntry[] {
  return runtimeResolver.models;
}

export function getRuntimeModelById(id: string): RuntimeModelEntry | null {
  return runtimeResolver.getById(id);
}

export function getRuntimeModelByCanonicalSlug(slug: string): RuntimeModelEntry | null {
  return runtimeResolver.getByCanonicalSlug(slug);
}

export function resolveRuntimeEngineInput(value: string | null | undefined): RuntimeModelEntry | null {
  return runtimeResolver.resolveEngineInput(value);
}

export function resolveRuntimePublicSlug(slug: string): RuntimeModelEntry | null {
  return runtimeResolver.resolvePublicSlug(slug);
}

export function isRuntimeModelPagePublished(modelOrId: RuntimeModelEntry | string | null | undefined): boolean {
  const model = typeof modelOrId === 'string' ? getRuntimeModelById(modelOrId) : modelOrId;
  return model?.publication.model.published === true;
}

export function toLegacyModelSurfaces(model: RuntimeModelEntry): ModelPublicationSurfaces {
  const slugById = (id: string) => runtimeResolver.getById(id)?.slug ?? id;
  return {
    modelPage: {
      indexable: model.publication.model.indexable,
      includeInSitemap: model.publication.sitemap.published,
    },
    examples: {
      includeInFamilyResolver: model.publication.examples.published,
      includeInFamilyCopy: model.publication.examples.includeInFamilyCopy,
    },
    compare: {
      suggestOpponents: model.publication.compare.suggestedOpponentIds.map(slugById),
      publishedPairs: model.publication.compare.publishedPairIds.map(slugById),
      includeInHub: model.publication.compare.published,
    },
    app: {
      enabled: model.publication.app.published,
      ...(model.publication.app.discoveryRank === undefined
        ? {}
        : { discoveryRank: model.publication.app.discoveryRank }),
      ...(model.publication.app.variantGroup === undefined
        ? {}
        : { variantGroup: model.publication.app.variantGroup }),
      ...(model.publication.app.variantLabel === undefined
        ? {}
        : { variantLabel: model.publication.app.variantLabel }),
    },
    pricing: {
      includeInEstimator: model.publication.pricing.published,
      ...(model.publication.pricing.featuredScenario === undefined
        ? {}
        : { featuredScenario: model.publication.pricing.featuredScenario }),
    },
  };
}
