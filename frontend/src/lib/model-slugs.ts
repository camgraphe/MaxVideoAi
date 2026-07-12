import {
  getRuntimeModelByCanonicalSlug,
  getRuntimeModelById,
  listRuntimeModels,
} from '../../config/model-runtime';

export type ModelSlugMap = Record<string, string>;

export const MODEL_SLUGS: ModelSlugMap = Object.fromEntries(
  listRuntimeModels().map((model) => [model.id, model.slug]),
);

export function getCanonicalSlug(engineId: string): string | undefined {
  return getRuntimeModelById(engineId)?.slug;
}

export function getEngineIdFromSlug(slug: string): string | undefined {
  return getRuntimeModelByCanonicalSlug(slug)?.id;
}
