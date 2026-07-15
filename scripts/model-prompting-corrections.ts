import type { AppLocale } from '../frontend/i18n/locales';
import type { ModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content';

export const APPROVED_PROMPTING_CORRECTIONS = [
  {
    slug: 'dreamina-seedance-2-0-mini',
    locale: 'fr',
    path: 'section.guide.href',
    oldValue: '/models/dreamina-seedance-2-0-mini',
    newValue: '/fr/modeles/dreamina-seedance-2-0-mini',
    evidence: 'MODELS_BASE_PATH_MAP.fr is /fr/modeles',
  },
  {
    slug: 'dreamina-seedance-2-0-mini',
    locale: 'es',
    path: 'section.guide.href',
    oldValue: '/models/dreamina-seedance-2-0-mini',
    newValue: '/es/modelos/dreamina-seedance-2-0-mini',
    evidence: 'MODELS_BASE_PATH_MAP.es is /es/modelos',
  },
  {
    slug: 'seedance-2-0-fast',
    locale: 'fr',
    path: 'section.guide.href',
    oldValue: '/models/seedance-2-0',
    newValue: '/fr/modeles/seedance-2-0',
    evidence: 'MODELS_BASE_PATH_MAP.fr is /fr/modeles',
  },
  {
    slug: 'seedance-2-0-fast',
    locale: 'es',
    path: 'section.guide.href',
    oldValue: '/models/seedance-2-0',
    newValue: '/es/modelos/seedance-2-0',
    evidence: 'MODELS_BASE_PATH_MAP.es is /es/modelos',
  },
] as const;

export function applyApprovedPromptingCorrections(
  content: ModelPromptingContent,
  slug: string,
  locale: AppLocale,
): ModelPromptingContent {
  const correction = APPROVED_PROMPTING_CORRECTIONS.find(
    (candidate) => candidate.slug === slug && candidate.locale === locale,
  );
  if (!correction) return content;

  const currentValue = content.section.guide?.href;
  if (currentValue !== correction.oldValue) {
    throw new Error(
      `[model-prompting-corrections] Expected ${slug}/${locale} ${correction.path} to be ${JSON.stringify(correction.oldValue)}, received ${JSON.stringify(currentValue)}`,
    );
  }

  return {
    ...content,
    section: {
      ...content.section,
      guide: {
        ...content.section.guide,
        href: correction.newValue,
      },
    },
  };
}
