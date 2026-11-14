import { z } from 'zod';

const text = z.string().trim().min(1);
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const heroSchema = z.object({
  modelSlug: id,
  variant: z.enum(['image', 'video']),
  heroAssetId: id,
  titleLines: z.array(text).min(1).max(2),
  subtitle: text,
  primaryLabel: text,
  byline: text,
  overviewLabel: text,
  detailsLabel: text,
  promptingLabel: text,
  intro: text,
  caption: text,
  proofLabel: text,
  examplesLabel: text,
  pricingLabel: text,
  facts: z.array(z.object({ label: text, value: text }).strict()).min(3).max(4),
}).strict();

/** Examples copy stays in the existing exact-locale examples block. */
export const cinematicExamplesSchema = z.object({
  title: text.optional(),
  intro: text.optional(),
  assetTitles: z.array(z.object({ id, title: text }).strict()).optional(),
  provenance: text,
  panels: z.array(z.object({
    id,
    layout: z.enum(['edit', 'feature', 'cutout', 'grid', 'shots']),
    eyebrow: text,
    title: text,
    body: text,
    note: text,
    assetIds: z.array(id).min(1).max(6),
  }).strict()).min(1).max(6),
  shotPlans: z.array(z.object({ assetId: id, motion: text, sound: text }).strict()).optional(),
}).strict();

export type ModelCinematicContent = z.infer<typeof heroSchema>;
export type ModelCinematicExamplesContent = z.infer<typeof cinematicExamplesSchema>;

export function parseModelCinematicContent(input: unknown, modelSlug: string): ModelCinematicContent | null {
  if (input === undefined) return null;
  const content = heroSchema.parse(input);
  if (content.modelSlug !== modelSlug) throw new Error('Cinematic model identity mismatch');
  return content;
}
