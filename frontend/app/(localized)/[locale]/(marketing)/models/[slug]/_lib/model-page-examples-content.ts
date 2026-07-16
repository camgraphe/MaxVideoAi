import { z } from 'zod';

import type { AppLocale } from '@/i18n/locales';

export const DECISION_EXAMPLE_FILTER_IDS = [
  'all', 'cinematic', 'product', 'action', 'vertical', 'audio',
  'campaign', 'typography', 'reference', 'final', 'grounded', 'edit',
  'wide', 'character', 'batch', 'ui', 'mask', 'infographic',
] as const;
export type DecisionExampleFilterId = (typeof DECISION_EXAMPLE_FILTER_IDS)[number];

export const MODEL_EXAMPLE_ICON_IDS = [
  'audio', 'image', 'maximize', 'pen', 'shield', 'sparkles', 'type', 'users', 'zap',
] as const;
export type ModelExampleIconId = (typeof MODEL_EXAMPLE_ICON_IDS)[number];

const nonEmpty = z.string().refine((value) => value.trim().length > 0, 'Expected a non-empty string');
const filterId = z.enum(DECISION_EXAMPLE_FILTER_IDS);
const schema = z.object({
  modelSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  section: z.object({
    title: nonEmpty,
    intro: nonEmpty,
    defaultCtaLabel: nonEmpty.nullable(),
    recreateLabel: nonEmpty.nullable(),
  }).strict(),
  filters: z.array(z.object({ id: filterId, label: nonEmpty }).strict()).min(1),
  proofItems: z.array(z.object({
    id: nonEmpty,
    icon: z.enum(MODEL_EXAMPLE_ICON_IDS),
    title: nonEmpty,
    body: nonEmpty,
  }).strict()).length(5),
  fallbackItems: z.array(z.object({
    id: nonEmpty,
    title: nonEmpty,
    category: nonEmpty,
    aspectRatio: nonEmpty,
    alt: nonEmpty,
    tags: z.array(filterId).min(1),
  }).strict()).nullable(),
}).strict();

export type ModelExamplesContent = z.infer<typeof schema>;
export type ModelExampleFilter = ModelExamplesContent['filters'][number];

export function parseModelExamplesContent(
  input: unknown,
  expectedSlug: string,
  locale: AppLocale,
  source = `content/models/${locale}/${expectedSlug}.json#examples`,
): ModelExamplesContent {
  if (input === undefined) {
    throw new Error(`[model-examples-content] Missing examples content for ${expectedSlug}/${locale} in ${source}`);
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('; ');
    throw new Error(`[model-examples-content] Invalid examples content in ${source}: ${issues}`);
  }
  const value = parsed.data;
  if (value.modelSlug !== expectedSlug) {
    throw new Error(`[model-examples-content] Model identity mismatch in ${source}: expected ${expectedSlug}, received ${value.modelSlug}`);
  }
  if (value.filters[0]?.id !== 'all' || value.filters.filter((item) => item.id === 'all').length !== 1) {
    throw new Error(`[model-examples-content] The first filter must be the only all filter in ${source}`);
  }
  for (const [label, ids] of [
    ['filter', value.filters.map((item) => item.id)],
    ['proof', value.proofItems.map((item) => item.id)],
    ['fallback', value.fallbackItems?.map((item) => item.id) ?? []],
  ] as const) {
    if (new Set(ids).size !== ids.length) throw new Error(`[model-examples-content] Duplicate ${label} id in ${source}`);
  }
  const declared = new Set(value.filters.map((item) => item.id));
  for (const item of value.fallbackItems ?? []) {
    for (const tag of item.tags) {
      if (!declared.has(tag)) throw new Error(`[model-examples-content] Fallback ${item.id} uses undeclared filter ${tag} in ${source}`);
    }
  }
  return value;
}
