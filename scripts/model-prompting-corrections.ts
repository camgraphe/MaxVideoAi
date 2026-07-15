import type { AppLocale } from '../frontend/i18n/locales';
import type { ModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content';

type ApprovedPromptingCorrectionPath =
  | 'section.guide.href'
  | 'imageExamples.intro'
  | 'imageExamples.items.0.title'
  | 'imageExamples.items.0.badge'
  | 'imageExamples.items.0.prompt';

type ApprovedPromptingCorrection = {
  slug: string;
  locale: AppLocale;
  path: ApprovedPromptingCorrectionPath;
  oldValue: string;
  newValue: string;
  evidence: string;
};

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
  {
    slug: 'luma-uni-1',
    locale: 'fr',
    path: 'imageExamples.intro',
    oldValue: 'Exemples adaptés aux stills campagne, typographie, retouches et finales 4K.',
    newValue: 'Exemples adaptés aux visuels de campagne, à la typographie, aux retouches et aux rendus finaux 4K.',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing French copy',
  },
  {
    slug: 'luma-uni-1',
    locale: 'fr',
    path: 'imageExamples.items.0.badge',
    oldValue: '2K still',
    newValue: 'Visuel 2K',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing French copy',
  },
  {
    slug: 'luma-uni-1',
    locale: 'fr',
    path: 'imageExamples.items.0.prompt',
    oldValue: 'Still campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.',
    newValue: 'Visuel de campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing French copy',
  },
  {
    slug: 'luma-uni-1-max',
    locale: 'fr',
    path: 'imageExamples.intro',
    oldValue: 'Exemples adaptés aux stills campagne, typographie, retouches et finales 4K.',
    newValue: 'Exemples adaptés aux visuels de campagne, à la typographie, aux retouches et aux rendus finaux 4K.',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing French copy',
  },
  {
    slug: 'luma-uni-1-max',
    locale: 'fr',
    path: 'imageExamples.items.0.badge',
    oldValue: '2K still',
    newValue: 'Visuel 2K',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing French copy',
  },
  {
    slug: 'luma-uni-1-max',
    locale: 'fr',
    path: 'imageExamples.items.0.prompt',
    oldValue: 'Still campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.',
    newValue: 'Visuel de campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing French copy',
  },
  {
    slug: 'luma-uni-1',
    locale: 'es',
    path: 'imageExamples.intro',
    oldValue: 'Ejemplos para stills de campaña, tipografía, ediciones con referencia y finales 4K.',
    newValue: 'Ejemplos para imágenes de campaña, tipografía, ediciones con referencia y finales 4K.',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing Spanish copy',
  },
  {
    slug: 'luma-uni-1',
    locale: 'es',
    path: 'imageExamples.items.0.title',
    oldValue: 'Still de campaña',
    newValue: 'Imagen de campaña',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing Spanish copy',
  },
  {
    slug: 'luma-uni-1',
    locale: 'es',
    path: 'imageExamples.items.0.badge',
    oldValue: 'Still 2K',
    newValue: 'Imagen 2K',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing Spanish copy',
  },
  {
    slug: 'luma-uni-1',
    locale: 'es',
    path: 'imageExamples.items.0.prompt',
    oldValue: 'Still de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.',
    newValue: 'Imagen de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing Spanish copy',
  },
  {
    slug: 'luma-uni-1-max',
    locale: 'es',
    path: 'imageExamples.intro',
    oldValue: 'Ejemplos para stills de campaña, tipografía, ediciones con referencia y finales 4K.',
    newValue: 'Ejemplos para imágenes de campaña, tipografía, ediciones con referencia y finales 4K.',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing Spanish copy',
  },
  {
    slug: 'luma-uni-1-max',
    locale: 'es',
    path: 'imageExamples.items.0.title',
    oldValue: 'Still de campaña',
    newValue: 'Imagen de campaña',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing Spanish copy',
  },
  {
    slug: 'luma-uni-1-max',
    locale: 'es',
    path: 'imageExamples.items.0.badge',
    oldValue: 'Still 2K',
    newValue: 'Imagen 2K',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing Spanish copy',
  },
  {
    slug: 'luma-uni-1-max',
    locale: 'es',
    path: 'imageExamples.items.0.prompt',
    oldValue: 'Still de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.',
    newValue: 'Imagen de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.',
    evidence: 'The localized-content contract forbids English still/stills in customer-facing Spanish copy',
  },
] as const satisfies readonly ApprovedPromptingCorrection[];

function replaceStringAtPath(
  value: unknown,
  pathSegments: readonly string[],
  correction: ApprovedPromptingCorrection,
  slug: string,
  locale: AppLocale,
): unknown {
  if (pathSegments.length === 0) {
    if (value !== correction.oldValue) {
      throw new Error(
        `[model-prompting-corrections] Expected ${slug}/${locale} ${correction.path} to be ${JSON.stringify(correction.oldValue)}, received ${JSON.stringify(value)}`,
      );
    }
    return correction.newValue;
  }

  const [key, ...remaining] = pathSegments;
  if (Array.isArray(value)) {
    const index = Number(key);
    if (!Number.isInteger(index) || !Object.hasOwn(value, index)) {
      throw new Error(`[model-prompting-corrections] Missing ${slug}/${locale} ${correction.path}`);
    }
    return value.map((entry, entryIndex) =>
      entryIndex === index ? replaceStringAtPath(entry, remaining, correction, slug, locale) : entry,
    );
  }
  if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) {
    throw new Error(`[model-prompting-corrections] Missing ${slug}/${locale} ${correction.path}`);
  }
  const record = value as Record<string, unknown>;
  return {
    ...record,
    [key]: replaceStringAtPath(record[key], remaining, correction, slug, locale),
  };
}

export function applyApprovedPromptingCorrections(
  content: ModelPromptingContent,
  slug: string,
  locale: AppLocale,
): ModelPromptingContent {
  const corrections = APPROVED_PROMPTING_CORRECTIONS.filter(
    (candidate) => candidate.slug === slug && candidate.locale === locale,
  );
  let corrected = content;
  for (const correction of corrections) {
    corrected = replaceStringAtPath(
      corrected,
      correction.path.split('.'),
      correction,
      slug,
      locale,
    ) as ModelPromptingContent;
  }
  return corrected;
}
