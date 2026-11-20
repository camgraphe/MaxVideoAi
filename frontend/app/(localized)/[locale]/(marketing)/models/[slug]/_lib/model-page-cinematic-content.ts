import { z } from 'zod';
import { cinematicCapabilitiesSchema } from './model-page-capabilities';

const text = z.string().trim().min(1);
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const heroSchema = z.object({
  modelSlug: id,
  variant: z.enum(['image', 'video']),
  heroAssetId: id.nullable(),
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
  highlights: z.array(z.object({ target: id, title: text, body: text }).strict()).length(3).optional(),
  capabilities: cinematicCapabilitiesSchema.optional(),
  benchmarkSource: z.object({ label: text, href: z.string().url() }).strict().optional(),
  alternatives: z.object({
    title: text,
    models: z.array(z.object({ slug: id, reason: text }).strict()).min(1).max(3),
  }).strict().optional(),
  specsReviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  specialty: z.object({
    kind: z.enum(['draft', 'keyframes']), eyebrow: text, title: text, intro: text,
    steps: z.array(z.object({ label: text, body: text }).strict()).length(3),
    note: text, action: text, mode: z.enum(['t2v', 'ref2v']),
    source: z.object({ label: text, href: z.string().url() }).strict(),
    workspacePreview: z.object({ alt: text, caption: text }).strict(),
    draftPreview: z.object({
      draftLabel: text, draftLocation: text, draftHint: text,
      finalLabel: text, finalLocation: text, finalHint: text,
      resolutionLabel: text, continuity: text, illustration: text, imageAlt: text,
      detailsLabel: text, quoteNote: text, selectionLabel: text, selectedLabel: text,
      angles: z.array(z.object({ id: text, label: text, description: text }).strict()).length(3),
    }).strict().optional(),
    details: z.array(z.object({ title: text, body: text }).strict()).length(3).optional(),
  }).strict().optional(),
  overview: z.object({
    titleLines: z.array(text).length(2),
    source: z.object({ label: text, href: z.string().url() }).strict(),
    benefits: z.array(z.object({ panelId: id, title: text, body: text }).strict()).length(4),
  }).strict().optional(),
  promptAssistant: z.object({ title: text, body: text, action: text }).strict(),
  workflows: z.object({
    eyebrow: text, title: text, intro: text, note: text, action: text,
    conceptLabel: text, briefLabel: text, limitsLabel: text, inspectLabel: text, promptNote: text, imageDetailsLabel: text,
    source: z.object({ label: text, href: z.string().url() }).strict().optional(),
    items: z.array(z.object({ id: z.enum(['create', 'extend', 'modify']), title: text, body: text,
      input: text, output: text, steps: z.array(text).length(3),
      action: text, prompt: text, inspect: text,
      compactFacts: text.optional(), promptLabel: text.optional(), promptSummary: text.optional(), proofLabel: text.optional(), proofNote: text.optional(),
      createMode: z.enum(['t2v', 'i2v', 'ref2v']).optional(),
      shotBreakdown: z.object({
        title: text,
        caption: text,
        shots: z.array(z.object({ id, title: text, detail: text }).strict()).min(2).max(6),
      }).strict().optional(),
      timeline: z.object({ label: text, source: text, continuation: text, note: text }).strict().optional(),
      focus: z.object({
        id, eyebrow: text, title: text, body: text, assetId: id,
        referenceLabel: text, referenceSteps: z.array(text).length(3),
        imageLabel: text, caption: text, prompt: text, resultLabel: text, promptLabel: text, promptNote: text.optional(),
      }).strict().optional(),
      limits: z.array(z.object({ label: text, value: text }).strict()).length(3),
    }).strict()).min(1).max(3).refine(items => new Set(items.map(item => item.id)).size === items.length, 'Each workflow appears once'),
  }).strict().optional(),
  facts: z.array(z.object({ label: text, value: text }).strict()).min(3).max(4),
}).strict();

/** Examples copy stays in the existing exact-locale examples block. */
export const cinematicExamplesSchema = z.object({
  title: text.optional(),
  intro: text.optional(),
  gallery: z.object({
    navLabel: text, title: text, intro: text, linkLabel: text,
    previewAssetId: id.optional(), previewLabel: text,
  }).strict().optional(),
  assetTitles: z.array(z.object({ id, title: text }).strict()).optional(),
  provenance: text,
  source: z.object({ label: text, href: z.string().url() }).strict().optional(),
  imageBriefs: z.object({
    title: text,
    intro: text,
    items: z.array(z.object({ recipeId: id, use: text, title: text, body: text }).strict()).min(1).max(6),
  }).strict().optional(),
  panels: z.array(z.object({
    id,
    placement: z.enum(['examples', 'prompting', 'details']).optional(),
    layout: z.enum(['edit', 'feature', 'cutout', 'grid', 'shots', 'series']),
    eyebrow: text,
    title: text,
    body: text,
    note: text,
    assetIds: z.array(id).min(1).max(6),
    recipe: z.object({ id, label: text }).strict().optional(),
  }).strict()).max(6),
  shotPlans: z.array(z.object({ assetId: id, motion: text, sound: text, prompt: text.optional(), proofNote: text.optional() }).strict()).optional(),
}).strict().refine(copy => copy.panels.length > 0 || copy.imageBriefs, 'A cinematic examples section needs proofs or image briefs');

export type ModelCinematicContent = z.infer<typeof heroSchema>;
export type ModelCinematicExamplesContent = z.infer<typeof cinematicExamplesSchema>;

export function parseModelCinematicContent(input: unknown, modelSlug: string): ModelCinematicContent | null {
  if (input === undefined) return null;
  const content = heroSchema.parse(input);
  if (content.modelSlug !== modelSlug) throw new Error('Cinematic model identity mismatch');
  return content;
}
