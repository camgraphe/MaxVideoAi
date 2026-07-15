import { z } from 'zod';

import type { AppLocale } from '@/i18n/locales';

const MODEL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const nonEmptyString = z.string().refine((value) => value.trim().length > 0, 'Expected a non-empty string');
const modelSlugSchema = z.string().regex(MODEL_SLUG_PATTERN, 'Expected a canonical model slug');
const linkSchema = z.object({ label: nonEmptyString, href: nonEmptyString }).strict();

const decisionSchema = z.object({
  modelSlug: modelSlugSchema,
  hero: z.object({
    eyebrow: nonEmptyString,
    title: nonEmptyString,
    subtitle: nonEmptyString,
    subtitleHighlights: z.array(nonEmptyString).min(1),
    paragraph: nonEmptyString,
    primaryCta: linkSchema,
    secondaryCta: linkSchema,
    quickLinks: z.array(linkSchema).min(1),
  }).strict(),
  media: z.object({
    caption: nonEmptyString,
    description: nonEmptyString,
    renderLabel: nonEmptyString,
    badges: z.array(nonEmptyString).min(1),
    altContext: nonEmptyString,
  }).strict(),
  features: z.array(z.object({
    title: nonEmptyString,
    body: nonEmptyString,
    tone: z.enum(['audio', 'continuity', 'reference', 'quality', 'duration', 'price']),
  }).strict()).min(1),
  decisionCards: z.array(z.object({ title: nonEmptyString, body: nonEmptyString, cta: linkSchema }).strict()).min(1),
  referenceWorkflows: z.array(z.object({ title: nonEmptyString, body: nonEmptyString }).strict()).min(1),
  pricingCopy: z.object({
    title: nonEmptyString,
    subtitle: nonEmptyString,
    footnote: nonEmptyString,
    ctaLabel: nonEmptyString,
    ctaHref: nonEmptyString,
    maxDurationNote: nonEmptyString.optional(),
  }).strict(),
  meta: z.object({ title: nonEmptyString, description: nonEmptyString }).strict(),
}).strict();

export type ModelDecisionContent = z.infer<typeof decisionSchema>;

const SHARED_HREFS = [/^#(?:prompting|specs)$/, /^\/app(?:\/image)?\?engine=[A-Za-z0-9_-]+$/];
const LOCALIZED_HREFS: Record<AppLocale, readonly RegExp[]> = {
  en: [/^\/(?:(?:models|examples)(?:\/[^\s?#]+)?|ai-video-engines\/[^\s?#]+(?:\?order=[a-z0-9-]+)?|pricing(?:#[^\s]+)?)$/],
  fr: [/^\/fr\/(?:(?:modeles|galerie)(?:\/[^\s?#]+)?|comparatif\/[^\s?#]+(?:\?order=[a-z0-9-]+)?|tarifs(?:#[^\s]+)?)$/],
  es: [/^\/es\/(?:(?:modelos|galeria)(?:\/[^\s?#]+)?|comparativa\/[^\s?#]+(?:\?order=[a-z0-9-]+)?|precios(?:#[^\s]+)?)$/],
};

function links(content: ModelDecisionContent) {
  return [
    ['hero.primaryCta.href', content.hero.primaryCta.href],
    ['hero.secondaryCta.href', content.hero.secondaryCta.href],
    ...content.hero.quickLinks.map((link, index) => [`hero.quickLinks.${index}.href`, link.href] as const),
    ...content.decisionCards.map((card, index) => [`decisionCards.${index}.cta.href`, card.cta.href] as const),
    ['pricingCopy.ctaHref', content.pricingCopy.ctaHref],
  ] as const;
}

export function parseModelDecisionContent(
  input: unknown,
  expectedSlug: string,
  locale: AppLocale,
  source = `${locale}/${expectedSlug}.json#decision`,
): ModelDecisionContent {
  if (input === undefined) throw new Error(`[model-decision-content] Missing decision content for ${expectedSlug}/${locale} in ${source}`);
  const result = decisionSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('; ');
    throw new Error(`[model-decision-content] Invalid decision content in ${source}: ${issues}`);
  }
  if (result.data.modelSlug !== expectedSlug) {
    throw new Error(`[model-decision-content] Model identity mismatch in ${source}: expected ${expectedSlug}, received ${result.data.modelSlug}`);
  }
  for (const [field, href] of links(result.data)) {
    if (![...SHARED_HREFS, ...LOCALIZED_HREFS[locale]].some((pattern) => pattern.test(href))) {
      throw new Error(`[model-decision-content] Invalid ${locale} href in ${source} at ${field}: ${JSON.stringify(href)}`);
    }
  }
  return result.data;
}
