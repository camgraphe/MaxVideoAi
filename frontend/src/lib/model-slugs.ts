import {
  getRuntimeModelByCanonicalSlug,
  getRuntimeModelById,
  listRuntimeModels,
} from '../../config/model-runtime';

export type ModelSlugMap = Record<string, string>;

export const MODEL_SLUGS: ModelSlugMap = Object.fromEntries(
  listRuntimeModels()
    .filter((model) => model.presentationOnly !== true)
    .map((model) => [model.id, model.slug]),
);

export function getCanonicalSlug(engineId: string): string | undefined {
  const model = getRuntimeModelById(engineId);
  return model?.presentationOnly === true ? undefined : model?.slug;
}

export function getEngineIdFromSlug(slug: string): string | undefined {
  const model = getRuntimeModelByCanonicalSlug(slug);
  return model?.presentationOnly === true ? undefined : model?.id;
}
