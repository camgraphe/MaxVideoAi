import runtimeDocument from './model-runtime.json' with { type: 'json' };
import type { ModelPublicationSurfaces } from './model-publication';
import type { ModelRegistryEntry } from './model-registry-validation';

export type RuntimeModelEntry = Omit<ModelRegistryEntry, 'replacement'>;

const models = runtimeDocument.models as RuntimeModelEntry[];
const byId = new Map(models.map((model) => [model.id.toLowerCase(), model]));
const bySlug = new Map(models.map((model) => [model.slug, model]));
const byEngineInput = new Map<string, RuntimeModelEntry>();
const byPublicSlug = new Map<string, RuntimeModelEntry>();

for (const model of models) {
  for (const value of [model.id, model.slug, ...model.aliases.internal]) {
    byEngineInput.set(value.trim().toLowerCase(), model);
  }
  for (const value of [model.slug, ...model.aliases.publicSlugs]) {
    byPublicSlug.set(value.trim().toLowerCase(), model);
  }
}

export function listRuntimeModels(): readonly RuntimeModelEntry[] {
  return models;
}

export function getRuntimeModelById(id: string): RuntimeModelEntry | null {
  return byId.get(id.trim().toLowerCase()) ?? null;
}

export function getRuntimeModelByCanonicalSlug(slug: string): RuntimeModelEntry | null {
  return bySlug.get(slug.trim().toLowerCase()) ?? null;
}

export function resolveRuntimeEngineInput(value: string | null | undefined): RuntimeModelEntry | null {
  const key = value?.trim().toLowerCase();
  return key ? byEngineInput.get(key) ?? null : null;
}

export function resolveRuntimePublicSlug(slug: string): RuntimeModelEntry | null {
  return byPublicSlug.get(slug.trim().toLowerCase()) ?? null;
}

export function isRuntimeModelPagePublished(modelOrId: RuntimeModelEntry | string | null | undefined): boolean {
  const model = typeof modelOrId === 'string' ? getRuntimeModelById(modelOrId) : modelOrId;
  return model?.publication.model.published === true;
}

export function toLegacyModelSurfaces(model: RuntimeModelEntry): ModelPublicationSurfaces {
  const slugById = (id: string) => byId.get(id.toLowerCase())?.slug ?? id;
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
