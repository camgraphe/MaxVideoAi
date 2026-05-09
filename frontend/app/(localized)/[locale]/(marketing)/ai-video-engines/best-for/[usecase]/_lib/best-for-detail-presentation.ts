import type { AppLocale } from '@/i18n/locales';
import {
  DECISION_CRITERIA_FILLERS,
  ENGINE_BY_SLUG,
  USECASE_CHIPS,
  USECASE_CRITERIA,
  USECASE_MISTAKE_FALLBACKS,
  type BestForEntry,
  type RankedPick,
} from './best-for-detail-config';

export function getBestForDisplayTitle(locale: AppLocale, entry?: BestForEntry, fallbackTitle?: string) {
  if (!entry) return fallbackTitle ?? 'Best AI video engines by use case';
  if (locale !== 'en') return fallbackTitle ?? entry.title;
  const intentLabels: Record<string, string> = {
    'image-to-video': 'image-to-video',
    'cinematic-realism': 'cinematic realism',
    'character-reference': 'character reference',
    'reference-to-video': 'reference-to-video',
    'multi-shot-video': 'multi-shot video',
    '4k-video': '4K video',
    ads: 'ads',
    'ugc-ads': 'UGC videos',
    'product-videos': 'product videos',
    'lipsync-dialogue': 'lip sync and dialogue',
    'fast-drafts': 'fast drafts',
    'stylized-anime': 'anime and stylized video',
  };
  return `Best AI video engines for ${intentLabels[entry.slug] ?? entry.title.replace(/^Best\s+/i, '').toLowerCase()}`;
}

export function buildBestForHeroDescription(locale: AppLocale, entry: BestForEntry, fallbackDescription?: string) {
  if (locale !== 'en') return fallbackDescription ?? entry.description ?? 'Editorial guidance for picking the best AI video engines by use case.';
  const names = (entry.topPicks ?? []).slice(0, 3).map((slug) => ENGINE_BY_SLUG.get(slug)?.marketingName ?? slug);
  if (!names.length) return fallbackDescription ?? entry.description ?? 'Compare AI video engines before spending credits.';
  return `Compare ${formatList(names)} for ${entry.title.replace(/^Best\s+/i, '').replace(/\s+AI generator$/i, '').toLowerCase()} before spending credits.`;
}

export function buildBestForMetaDescription(locale: AppLocale, entry: BestForEntry, fallbackDescription?: string) {
  if (locale !== 'en') return fallbackDescription ?? entry.description ?? 'Compare the best AI video engines by use case.';
  const names = (entry.topPicks ?? []).slice(0, 3).map((slug) => ENGINE_BY_SLUG.get(slug)?.marketingName ?? slug);
  const engineText = names.length ? ` Compare ${formatList(names)}` : ' Compare leading AI video engines';
  return `${fallbackDescription ?? entry.description ?? entry.title}.${engineText} by quality, control, consistency, cost, and workflow fit.`;
}

export function buildBestForKeywords(locale: AppLocale, entry: BestForEntry, localizedTitle: string) {
  const engines = (entry.topPicks ?? []).map((slug) => ENGINE_BY_SLUG.get(slug)?.marketingName ?? slug);
  const genericKeyword =
    locale === 'fr'
      ? `${entry.slug.replace(/-/g, ' ')} générateur vidéo IA`
      : locale === 'es'
        ? `${entry.slug.replace(/-/g, ' ')} generador de video con IA`
        : `${entry.slug.replace(/-/g, ' ')} AI video generator`;
  return Array.from(
    new Set([
      localizedTitle,
      genericKeyword,
      ...engines,
      ...getUsecaseChips(locale, entry.slug, []),
    ])
  );
}

export function formatScore(score?: number) {
  return typeof score === 'number' && Number.isFinite(score) ? score.toFixed(1) : '-';
}

export function getTopPicksTitle(locale: AppLocale, slug: string) {
  const labels: Record<string, Record<AppLocale, string>> = {
    'cinematic-realism': {
      en: 'Top picks for cinematic shots',
      fr: 'Meilleurs choix pour plans cinéma',
      es: 'Mejores opciones para planos cinematográficos',
    },
    'character-reference': {
      en: 'Top picks for character reference',
      fr: 'Meilleurs choix pour character reference',
      es: 'Mejores opciones para character reference',
    },
    'reference-to-video': {
      en: 'Top picks for reference-to-video',
      fr: 'Meilleurs choix pour reference-to-video',
      es: 'Mejores opciones para reference-to-video',
    },
    'multi-shot-video': {
      en: 'Top picks for multi-shot video',
      fr: 'Meilleurs choix pour multi-shot',
      es: 'Mejores opciones para multi-shot',
    },
    '4k-video': {
      en: 'Top picks for 4K delivery',
      fr: 'Meilleurs choix pour livraison 4K',
      es: 'Mejores opciones para entrega 4K',
    },
    ads: {
      en: 'Top picks for ads',
      fr: 'Meilleurs choix pour publicités',
      es: 'Mejores opciones para anuncios',
    },
    'ugc-ads': {
      en: 'Top picks for UGC videos',
      fr: 'Meilleurs choix pour vidéos UGC',
      es: 'Mejores opciones para videos UGC',
    },
    'product-videos': {
      en: 'Top picks for product videos',
      fr: 'Meilleurs choix pour vidéos produit',
      es: 'Mejores opciones para videos de producto',
    },
    'lipsync-dialogue': {
      en: 'Top picks for dialogue',
      fr: 'Meilleurs choix pour dialogue',
      es: 'Mejores opciones para diálogo',
    },
    'fast-drafts': {
      en: 'Top picks for fast drafts',
      fr: 'Meilleurs choix pour tests rapides',
      es: 'Mejores opciones para borradores rápidos',
    },
    'stylized-anime': {
      en: 'Top picks for stylized video',
      fr: 'Meilleurs choix pour vidéo stylisée',
      es: 'Mejores opciones para video estilizado',
    },
    'image-to-video': {
      en: 'Top picks for image-to-video',
      fr: 'Meilleurs choix image vers vidéo',
      es: 'Mejores opciones de imagen a video',
    },
  };
  return labels[slug]?.[locale] ?? labels[slug]?.en ?? (locale === 'fr' ? 'Meilleurs choix' : locale === 'es' ? 'Mejores opciones' : 'Top picks');
}

export function buildReasonSentence(locale: AppLocale, usecaseSlug: string, pick: RankedPick) {
  const usecaseLabel = getUsecaseLabel(locale, usecaseSlug);
  if (locale === 'fr') {
    return `est classé ici car il donne aux utilisateurs MaxVideoAI une route pratique vers ${pick.criterion.toLowerCase()}, tout en gardant le flux adapté à ${usecaseLabel}.`;
  }
  if (locale === 'es') {
    return `está aquí porque da a los usuarios de MaxVideoAI una ruta práctica hacia ${pick.criterion.toLowerCase()}, manteniendo el flujo adecuado para ${usecaseLabel}.`;
  }
  return `ranks here because it gives MaxVideoAI users a practical route to ${pick.criterion.toLowerCase()} while keeping the workflow suitable for ${usecaseLabel}.`;
}

export function buildUsecaseMistakes(locale: AppLocale, usecaseSlug: string, criteria: string[]) {
  const label = getUsecaseLabel(locale, usecaseSlug);
  const primary = criteria[0] ?? USECASE_MISTAKE_FALLBACKS[locale]?.[0] ?? USECASE_MISTAKE_FALLBACKS.en[0];
  const secondary = criteria[1] ?? USECASE_MISTAKE_FALLBACKS[locale]?.[1] ?? USECASE_MISTAKE_FALLBACKS.en[1];
  const tertiary = criteria[2] ?? USECASE_MISTAKE_FALLBACKS[locale]?.[2] ?? USECASE_MISTAKE_FALLBACKS.en[2];

  if (locale === 'fr') {
    return [
      `Choisir un modèle pour ${label} sans vérifier ${primary.toLowerCase()}.`,
      `Multiplier les références alors que ${secondary.toLowerCase()} doit rester prioritaire.`,
      `Passer directement au modèle premium avant d’avoir validé ${tertiary.toLowerCase()}.`,
      'Oublier de contrôler le coût avant de générer.',
      'Comparer seulement les fiches modèles sans ouvrir les exemples réels liés à ce cas d’usage.',
    ];
  }

  if (locale === 'es') {
    return [
      `Elegir un motor para ${label} sin comprobar ${primary.toLowerCase()}.`,
      `Añadir demasiadas referencias cuando ${secondary.toLowerCase()} debería ser la prioridad.`,
      `Pasar directo al modelo premium antes de validar ${tertiary.toLowerCase()}.`,
      'Olvidar revisar el coste antes de generar.',
      'Comparar solo fichas de modelos sin abrir ejemplos reales para este objetivo.',
    ];
  }

  return [
    `Choosing an engine for ${label} without checking ${primary.toLowerCase()}.`,
    `Adding too many references when ${secondary.toLowerCase()} should stay primary.`,
    `Going straight to a premium model before validating ${tertiary.toLowerCase()}.`,
    'Forgetting to check the cost before generation.',
    'Comparing model pages only without opening real examples for this use case.',
  ];
}

export function getUsecaseCriteria(locale: AppLocale, slug: string) {
  return USECASE_CRITERIA[slug]?.[locale] ?? USECASE_CRITERIA[slug]?.en ?? USECASE_CRITERIA['image-to-video'].en;
}

export function getUsecaseChips(locale: AppLocale, slug: string, fallback: string[]) {
  return USECASE_CHIPS[slug]?.[locale] ?? USECASE_CHIPS[slug]?.en ?? fallback;
}

export function getFilledCriteria(locale: AppLocale, criteria: string[]) {
  return criteria.concat(DECISION_CRITERIA_FILLERS[locale] ?? DECISION_CRITERIA_FILLERS.en).slice(0, 5);
}

function formatList(items: string[]) {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function getUsecaseLabel(locale: AppLocale, slug: string) {
  const labels: Record<string, Record<AppLocale, string>> = {
    'cinematic-realism': { en: 'cinematic realism', fr: 'un rendu cinématique', es: 'realismo cinematográfico' },
    'character-reference': { en: 'character reference', fr: 'la référence personnage', es: 'referencia de personaje' },
    'reference-to-video': { en: 'reference-to-video', fr: 'la vidéo guidée par référence', es: 'video guiado por referencia' },
    'multi-shot-video': { en: 'multi-shot video', fr: 'la vidéo multi-plan', es: 'video multi-plano' },
    '4k-video': { en: '4K video', fr: 'la vidéo 4K', es: 'video 4K' },
    ads: { en: 'ads', fr: 'les publicités', es: 'anuncios' },
    'ugc-ads': { en: 'UGC videos', fr: 'les vidéos UGC', es: 'videos UGC' },
    'product-videos': { en: 'product videos', fr: 'les vidéos produit', es: 'videos de producto' },
    'lipsync-dialogue': { en: 'lip sync and dialogue', fr: 'la synchronisation labiale et le dialogue', es: 'sincronización labial y diálogo' },
    'fast-drafts': { en: 'fast drafts', fr: 'les tests rapides', es: 'borradores rápidos' },
    'stylized-anime': { en: 'anime and stylized video', fr: 'la vidéo anime et stylisée', es: 'anime y video estilizado' },
    'image-to-video': { en: 'image-to-video', fr: "l'image vers vidéo", es: 'imagen a video' },
  };
  return labels[slug]?.[locale] ?? labels[slug]?.en ?? slug.replace(/-/g, ' ');
}
