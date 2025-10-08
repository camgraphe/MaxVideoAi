import slugs from '../../config/model-slugs.json' assert { type: 'json' };

export type ModelSlugMap = Record<string, string>;

export const MODEL_SLUGS = slugs as ModelSlugMap;

const slugToEngine = Object.entries(MODEL_SLUGS).reduce<Record<string, string>>((acc, [engineId, slug]) => {
  acc[slug] = engineId;
  return acc;
}, {});

export function getCanonicalSlug(engineId: string): string | undefined {
  return MODEL_SLUGS[engineId];
}

export function getEngineIdFromSlug(slug: string): string | undefined {
  return slugToEngine[slug];
}
