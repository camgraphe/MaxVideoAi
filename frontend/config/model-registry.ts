import rawRegistry from './model-registry.json' with { type: 'json' };
import { validateModelRegistryDocument } from './model-registry-validation';
import type { ModelRegistryDocument, ModelRegistryEntry } from './model-registry-validation';

const registry = validateModelRegistryDocument(rawRegistry) as ModelRegistryDocument;
const byId = new Map(registry.models.map((model) => [model.id.toLowerCase(), model]));
const bySlug = new Map(registry.models.map((model) => [model.slug, model]));
const byEngineInput = new Map<string, ModelRegistryEntry>();
const byPublicSlug = new Map<string, ModelRegistryEntry>();

for (const model of registry.models) {
  for (const value of [model.id, model.slug, ...model.aliases.internal]) {
    byEngineInput.set(value.trim().toLowerCase(), model);
  }
  for (const value of [model.slug, ...model.aliases.publicSlugs]) {
    byPublicSlug.set(value.trim().toLowerCase(), model);
  }
}

export type { ModelRegistryDocument, ModelRegistryEntry } from './model-registry-validation';
export const MODEL_REGISTRY_SCHEMA_VERSION = registry.schemaVersion;

export function getModelRegistryEntries(): readonly ModelRegistryEntry[] {
  return registry.models;
}

export function getModelRegistryEntryById(id: string): ModelRegistryEntry | null {
  return byId.get(id.trim().toLowerCase()) ?? null;
}

export function getModelRegistryEntryByCanonicalSlug(slug: string): ModelRegistryEntry | null {
  return bySlug.get(slug.trim().toLowerCase()) ?? null;
}

export function resolveModelRegistryEngineInput(value: string | null | undefined): ModelRegistryEntry | null {
  const key = value?.trim().toLowerCase();
  return key ? byEngineInput.get(key) ?? null : null;
}

export function resolveModelRegistryPublicSlug(slug: string): ModelRegistryEntry | null {
  return byPublicSlug.get(slug.trim().toLowerCase()) ?? null;
}

export function buildLocalizedModelPath(locale: 'en' | 'fr' | 'es', slug: string): string {
  if (locale === 'fr') return `/fr/modeles/${slug}`;
  if (locale === 'es') return `/es/modelos/${slug}`;
  return `/models/${slug}`;
}
