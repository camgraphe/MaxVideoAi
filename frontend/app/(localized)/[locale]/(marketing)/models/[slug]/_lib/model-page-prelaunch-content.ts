import { z } from 'zod';

import type { AppLocale } from '@/i18n/locales';
import type { EngineLocalizedContent } from '@/lib/models/i18n';

const nonEmptyString = z.string().refine((value) => value.trim().length > 0, 'Expected a non-empty string');
const linkSchema = z.object({ label: nonEmptyString, href: nonEmptyString }).strict();
const statusItemSchema = z.object({
  label: nonEmptyString,
  value: nonEmptyString,
  detail: nonEmptyString,
  state: z.enum(['announced', 'highlight', 'comingSoon']),
}).strict();
const informationCardSchema = z.object({
  title: nonEmptyString,
  body: nonEmptyString,
}).strict();

const localizedPrelaunchSchema = z.object({
  marketingName: z.literal('Seedance 2.5'),
  versionLabel: z.literal('2.5'),
  overview: nonEmptyString,
  seo: z.object({
    title: nonEmptyString,
    description: nonEmptyString,
    image: z.string().optional(),
  }),
  hero: z.object({
    title: nonEmptyString,
    intro: nonEmptyString,
    badge: nonEmptyString,
    ctaPrimary: linkSchema,
    secondaryLinks: z.array(linkSchema).min(1),
  }),
  faqs: z.array(z.object({
    question: nonEmptyString,
    answer: nonEmptyString,
  }).strict()).min(2),
  custom: z.object({
    prelaunch: z.object({
      modelSlug: z.literal('seedance-2-5'),
      dreaminaLabel: z.literal('coming_soon'),
      checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      productSurface: z.literal('Dreamina'),
      sourceUrl: z.string().url(),
      announcedProductClaims: z.array(z.enum([
        '4k_output',
        'standard_mode_up_to_30_seconds',
        'beta_long_video_mode_up_to_180_seconds',
        'up_to_50_multimodal_inputs',
        'reference_to_video_control',
        'precise_local_video_editing',
      ])).length(6),
      labels: z.object({
        statusEyebrow: nonEmptyString,
        claimsEyebrow: nonEmptyString,
        claimsTitle: nonEmptyString,
        claimsIntro: nonEmptyString,
        alternativesEyebrow: nonEmptyString,
        alternativesTitle: nonEmptyString,
        alternativesIntro: nonEmptyString,
        faqEyebrow: nonEmptyString,
        faqTitle: nonEmptyString,
        sourceLabel: nonEmptyString,
        checkedLabel: nonEmptyString,
      }).strict(),
      statusItems: z.array(statusItemSchema).length(3),
      announcedCapabilities: z.array(informationCardSchema).length(6),
    }).strict(),
  }).strict(),
});

export type ModelPrelaunchContent = z.infer<typeof localizedPrelaunchSchema>;

const LOCALIZED_LINK_PATTERNS: Record<AppLocale, readonly RegExp[]> = {
  en: [/^\/models\/[a-z0-9-]+$/, /^\/examples\/[a-z0-9-]+$/],
  fr: [/^\/fr\/modeles\/[a-z0-9-]+$/, /^\/fr\/galerie\/[a-z0-9-]+$/],
  es: [/^\/es\/modelos\/[a-z0-9-]+$/, /^\/es\/galeria\/[a-z0-9-]+$/],
};

export function parseModelPrelaunchContent(
  input: EngineLocalizedContent,
  locale: AppLocale,
  source = `content/models/${locale}/seedance-2-5.json`,
): ModelPrelaunchContent {
  const result = localizedPrelaunchSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`[model-prelaunch-content] Invalid content in ${source}: ${issues}`);
  }

  const links = [
    result.data.hero.ctaPrimary,
    ...result.data.hero.secondaryLinks,
  ];
  for (const link of links) {
    if (!LOCALIZED_LINK_PATTERNS[locale].some((pattern) => pattern.test(link.href))) {
      throw new Error(
        `[model-prelaunch-content] Invalid ${locale} href in ${source}: ${JSON.stringify(link.href)}`,
      );
    }
    if (/\/app(?:\/|\?|$)|\/(?:pricing|tarifs|precios)(?:\/|#|\?|$)/i.test(link.href)) {
      throw new Error(
        `[model-prelaunch-content] Executable or pricing href forbidden in ${source}: ${JSON.stringify(link.href)}`,
      );
    }
  }

  return result.data;
}
