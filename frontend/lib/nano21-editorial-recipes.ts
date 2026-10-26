import { z } from 'zod';
import records from '../config/nano21-editorial-recipes.json';
import { getRuntimeModelById } from '../config/model-runtime';

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const publicImageUrl = z.string().url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 'media.maxvideoai.com'
    && !url.username && !url.password && !url.search && !url.hash
    && /\.(png|jpe?g|webp)$/i.test(url.pathname);
});
const image = z.object({
  url: publicImageUrl, sha256, width: z.number().int().positive(), height: z.number().int().positive(),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
}).strict();

/** Accepted public projection only. Native response, account IDs and billing never enter this owner. */
export const nano21EditorialRecipeFields = z.object({
  id: z.string().regex(/^nano21-[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.literal('accepted'), engineId: z.literal('nano-banana-2-1'),
  modelId: z.literal('gemini-nano-banana-2.1'), version: z.literal('2.1'), mode: z.literal('t2i'),
  promptLanguage: z.literal('en'), prompt: z.string().min(1).max(12000).refine(value => value.trim() === value),
  settings: z.object({ resolution: z.literal('1k'), aspectRatio: z.literal('16:9'), thinkingLevel: z.literal('medium'),
    candidateCount: z.literal(1), numImages: z.literal(1), maxOutputTokens: z.union([z.literal(4096), z.literal(32768)]),
    enableWebSearch: z.literal(false), enableImageSearch: z.literal(false),
  }).strict(),
  references: z.tuple([]),
  provenance: z.object({ kind: z.literal('external_vertex'), location: z.literal('global'),
    generatedAt: z.string().datetime(), acceptedAt: z.string().datetime(), promptSha256: sha256, responseSha256: sha256,
  }).strict(),
  media: z.object({ original: image, display: image.extend({ sourceSha256: sha256 }).strict() }).strict(),
  placement: z.enum(['hero', 'example']),
}).strict();

export const nano21EditorialRecipeSchema = nano21EditorialRecipeFields
  .refine(value => value.media.display.sourceSha256 === value.media.original.sha256, 'Display derivative must name its original hash')
  .refine(value => Date.parse(value.provenance.acceptedAt) >= Date.parse(value.provenance.generatedAt), 'Acceptance cannot precede generation');

export type Nano21EditorialRecipe = z.infer<typeof nano21EditorialRecipeSchema>;

export function resolveNano21EditorialRecipe(id: string, source: readonly unknown[], available: boolean): Nano21EditorialRecipe {
  if (!available) throw new Error('This image recipe model is unavailable.');
  if (!/^nano21-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Invalid image recipe ID.');
  const matches = source.filter(value => value && typeof value === 'object' && (value as { id?: unknown }).id === id);
  if (matches.length !== 1) throw new Error('This image recipe is unavailable.');
  const parsed = nano21EditorialRecipeSchema.safeParse(matches[0]);
  if (!parsed.success) throw new Error('This image recipe is not an accepted supported Nano Banana 2.1 recipe.');
  return parsed.data;
}

export function getPublicNano21EditorialRecipe(id: string): Nano21EditorialRecipe {
  const model = getRuntimeModelById('nano-banana-2-1');
  return resolveNano21EditorialRecipe(id, records, Boolean(model?.publication.model.published && model.publication.app.published));
}

export function listPublicNano21EditorialRecipes(): Nano21EditorialRecipe[] {
  const model = getRuntimeModelById('nano-banana-2-1');
  if (!model?.publication.model.published || !model.publication.app.published) return [];
  const accepted = records.map(record => getPublicNano21EditorialRecipe((record as { id: string }).id));
  if (accepted.filter(recipe => recipe.placement === 'hero').length > 1) throw new Error('Conflicting Nano21 editorial heroes.');
  return accepted;
}

/** No provider job is invented: only the existing image settings projection is reused. */
export function buildNano21EditorialSnapshot(recipe: Nano21EditorialRecipe) {
  const accepted = nano21EditorialRecipeSchema.parse(recipe);
  return { schemaVersion: 1, surface: 'image', engineId: accepted.engineId, inputMode: accepted.mode,
    prompt: accepted.prompt, core: { numImages: 1, resolution: '1k', aspectRatio: '16:9', thinkingLevel: 'medium',
      maxOutputTokens: accepted.settings.maxOutputTokens, enableWebSearch: false }, refs: { imageUrls: [], characterReferences: [] } };
}

export function nano21EditorialRecipeHref(id: string): string {
  return `/app/image?recipe=${encodeURIComponent(id)}`;
}
