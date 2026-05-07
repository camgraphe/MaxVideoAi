import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { AppLocale } from '@/i18n/locales';
import { defaultLocale, locales } from '@/i18n/locales';
import { getLocalizedUrl } from '@/lib/metadataUrls';
import { canonicalizePublishedCompareSlug, isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import { getContentEntries, getEntryBySlug } from '@/lib/content/markdown';
import { EXAMPLES_HERO_SELECTION_LIMIT, pickFirstPlayableVideo } from '@/lib/examples/heroVideo';
import { listExampleFamilyPage } from '@/server/videos';
import {
  BEST_FOR_PAGES,
  DECISION_CRITERIA_FILLERS,
  ENGINE_BY_SLUG,
  ENGINE_CATALOG,
  USECASE_CHIPS,
  USECASE_CRITERIA,
  USECASE_MISTAKE_FALLBACKS,
  type BestForDetailCopy,
  type BestForEntry,
  type EngineCatalogEntry,
  type EngineScore,
  type EngineScoresFile,
  type ExamplePreviewPick,
  type RankedPick,
  type RelatedGuideEntry,
} from './best-for-detail-config';

export function getEntry(slug: string): BestForEntry | undefined {
  return BEST_FOR_PAGES.find((entry) => entry.slug === slug);
}

export function buildComparisonLabel(slug: string) {
  const [leftSlug, rightSlug] = slug.split('-vs-');
  const left = leftSlug ? ENGINE_BY_SLUG.get(leftSlug)?.marketingName ?? leftSlug : slug;
  const right = rightSlug ? ENGINE_BY_SLUG.get(rightSlug)?.marketingName ?? rightSlug : '';
  return right ? `${left} vs ${right}` : slug;
}

export async function getBestForEntry(locale: AppLocale, slug: string) {
  const localizedRoot = locale === defaultLocale ? 'content/en/best-for' : `content/${locale}/best-for`;
  const localized = await getEntryBySlug(localizedRoot, slug);
  if (localized) return localized;
  return getEntryBySlug('content/en/best-for', slug);
}

export async function getLocalizedBestForEntry(locale: AppLocale, slug: string) {
  const localizedRoot = locale === defaultLocale ? 'content/en/best-for' : `content/${locale}/best-for`;
  return getEntryBySlug(localizedRoot, slug);
}

export async function resolveAvailableLocales(slug: string): Promise<AppLocale[]> {
  const available = await Promise.all(
    locales.map(async (locale) => {
      const localized = await getEntryBySlug(`content/${locale}/best-for`, slug);
      if (localized) {
        return locale;
      }
      if (locale === 'en') {
        const fallback = await getEntryBySlug('content/en/best-for', slug);
        if (fallback) {
          return locale;
        }
      }
      return null;
    })
  );
  const filtered = available.filter((locale): locale is AppLocale => Boolean(locale));
  return filtered.length ? filtered : (['en'] as AppLocale[]);
}

export async function loadEngineScores(): Promise<Map<string, EngineScore>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-scores.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-scores.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineScoresFile;
      const map = new Map<string, EngineScore>();
      (data.scores ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (key) {
          map.set(key, entry);
        }
      });
      return map;
    } catch {
      // keep trying
    }
  }
  return new Map();
}

const USECASE_WEIGHTS: Record<string, Partial<Record<keyof EngineScore, number>>> = {
  'ugc-ads': { motion: 0.3, fidelity: 0.25, consistency: 0.2, lipsyncQuality: 0.15, textRendering: 0.1 },
  'product-videos': { fidelity: 0.35, consistency: 0.25, anatomy: 0.2, motion: 0.1, textRendering: 0.1 },
  'lipsync-dialogue': { lipsyncQuality: 0.4, consistency: 0.2, fidelity: 0.2, motion: 0.1, anatomy: 0.1 },
  'cinematic-realism': { fidelity: 0.35, motion: 0.25, consistency: 0.2, anatomy: 0.1, textRendering: 0.1 },
  'fast-drafts': { motion: 0.3, consistency: 0.25, fidelity: 0.2, textRendering: 0.15, anatomy: 0.1 },
  'vertical-shorts': { motion: 0.3, consistency: 0.25, fidelity: 0.2, textRendering: 0.15, anatomy: 0.1 },
  'image-to-video': { consistency: 0.3, fidelity: 0.3, motion: 0.2, anatomy: 0.1, textRendering: 0.1 },
  'stylized-anime': { consistency: 0.3, motion: 0.25, fidelity: 0.2, textRendering: 0.15, anatomy: 0.1 },
  'character-reference': { consistency: 0.4, anatomy: 0.2, fidelity: 0.2, motion: 0.1, textRendering: 0.1 },
  'reference-to-video': { consistency: 0.35, fidelity: 0.3, motion: 0.2, anatomy: 0.1, textRendering: 0.05 },
  'multi-shot-video': { sequencingQuality: 0.35, consistency: 0.25, motion: 0.2, fidelity: 0.15, anatomy: 0.05 },
  '4k-video': { fidelity: 0.45, consistency: 0.25, motion: 0.15, anatomy: 0.1, textRendering: 0.05 },
  ads: { fidelity: 0.3, consistency: 0.25, textRendering: 0.2, motion: 0.15, anatomy: 0.1 },
};

function scoreEngineForUsecase(score: EngineScore, weights: Partial<Record<keyof EngineScore, number>>) {
  let total = 0;
  let weightSum = 0;
  Object.entries(weights).forEach(([key, weight]) => {
    const value = score[key as keyof EngineScore];
    if (typeof value === 'number' && typeof weight === 'number') {
      total += value * weight;
      weightSum += weight;
    }
  });
  if (weightSum === 0) return 0;
  return total / weightSum;
}

export function resolveTopPicks(entry: BestForEntry, scores: Map<string, EngineScore>): string[] {
  if (entry.topPicks?.length) return entry.topPicks;
  const weights = USECASE_WEIGHTS[entry.slug] ?? {};
  const ranked = ENGINE_CATALOG.map((engine) => {
    const score = scores.get(engine.modelSlug) ?? (engine.engineId ? scores.get(engine.engineId) : null) ?? null;
    const value = score ? scoreEngineForUsecase(score, weights) : 0;
    return { slug: engine.modelSlug, value };
  })
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((entry) => entry.slug);
  return ranked.length ? ranked : ENGINE_CATALOG.slice(0, 3).map((engine) => engine.modelSlug);
}

export function buildRankedPick({
  usecaseSlug,
  modelSlug,
  rank,
  scores,
  criteria,
  copy,
  locale,
}: {
  usecaseSlug: string;
  modelSlug: string;
  rank: number;
  scores: Map<string, EngineScore>;
  criteria: string[];
  copy: BestForDetailCopy;
  locale: AppLocale;
}): RankedPick {
  const engine = ENGINE_BY_SLUG.get(modelSlug);
  const score = getFitScore(usecaseSlug, scores.get(modelSlug) ?? (engine?.engineId ? scores.get(engine.engineId) : undefined));
  const criterion = criteria[(rank - 1) % criteria.length] ?? criteria[0] ?? copy.fit;
  const fallbackScore = Math.max(6.8, 8.6 - rank * 0.22);
  return {
    slug: modelSlug,
    engine,
    rank,
    criterion,
    score: score ?? fallbackScore,
    accent: getEngineAccent(modelSlug),
    reason: buildPickReason(locale, usecaseSlug, criterion, rank),
    bullets: buildPickBullets(locale, criteria, rank),
  };
}

export async function resolveExamplePreviewPicks(picks: RankedPick[]): Promise<ExamplePreviewPick[]> {
  const examplesSlugs = Array.from(new Set(picks.map((pick) => getExamplesSlug(pick))));
  const heroThumbEntries = await Promise.all(
    examplesSlugs.map(async (examplesSlug) => {
      try {
        const result = await listExampleFamilyPage(examplesSlug, {
          sort: 'playlist',
          limit: EXAMPLES_HERO_SELECTION_LIMIT,
          offset: 0,
        });
        const heroVideo = pickFirstPlayableVideo(result.items);
        return [examplesSlug, heroVideo?.thumbUrl ?? null] as const;
      } catch {
        return [examplesSlug, null] as const;
      }
    })
  );
  const heroThumbBySlug = new Map(heroThumbEntries);

  return picks.map((pick) => {
    const examplesSlug = getExamplesSlug(pick);
    return {
      ...pick,
      examplesSlug,
      heroThumbUrl: heroThumbBySlug.get(examplesSlug) ?? null,
    };
  });
}

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

function formatList(items: string[]) {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function formatScore(score?: number) {
  return typeof score === 'number' && Number.isFinite(score) ? score.toFixed(1) : '-';
}

function buildPickReason(locale: AppLocale, usecaseSlug: string, criterion: string, rank: number) {
  const prefixes: Record<AppLocale, string[]> = {
    en: ['Best balance of', 'Strong option for', 'Useful when you need'],
    fr: ['Meilleur équilibre pour', 'Option forte pour', 'Utile si vous cherchez'],
    es: ['Mejor equilibrio para', 'Opción fuerte para', 'Útil si necesitas'],
  };
  const suffixes: Record<string, Record<AppLocale, string>> = {
    'cinematic-realism': {
      en: 'cinematic camera direction',
      fr: 'une direction caméra cinématique',
      es: 'dirección de cámara cinematográfica',
    },
    'character-reference': {
      en: 'stable identity across shots',
      fr: 'une identité stable entre les plans',
      es: 'identidad estable entre planos',
    },
    'reference-to-video': {
      en: 'controlled reference workflows',
      fr: 'des workflows de référence contrôlés',
      es: 'workflows de referencia controlados',
    },
    'multi-shot-video': {
      en: 'planned sequences',
      fr: 'des séquences planifiées',
      es: 'secuencias planificadas',
    },
    '4k-video': {
      en: 'final delivery detail',
      fr: 'le niveau de détail final',
      es: 'detalle para entrega final',
    },
    ads: {
      en: 'campaign-ready output',
      fr: 'un rendu prêt pour campagne',
      es: 'salidas listas para campaña',
    },
    'ugc-ads': {
      en: 'creator-style social clips',
      fr: 'des clips sociaux style créateur',
      es: 'clips sociales estilo creador',
    },
    'product-videos': {
      en: 'clean product storytelling',
      fr: 'un storytelling produit propre',
      es: 'storytelling de producto limpio',
    },
    'lipsync-dialogue': {
      en: 'speaking character control',
      fr: 'le contrôle de personnages parlants',
      es: 'control de personajes con diálogo',
    },
    'fast-drafts': {
      en: 'fast iteration loops',
      fr: 'des boucles d’itération rapides',
      es: 'ciclos rápidos de iteración',
    },
    'stylized-anime': {
      en: 'stylized motion',
      fr: 'du mouvement stylisé',
      es: 'movimiento estilizado',
    },
    'image-to-video': {
      en: 'motion from approved images',
      fr: 'l’animation depuis images validées',
      es: 'movimiento desde imágenes aprobadas',
    },
  };
  const prefix = prefixes[locale]?.[Math.min(rank - 1, 2)] ?? prefixes.en[Math.min(rank - 1, 2)];
  const suffix = suffixes[usecaseSlug]?.[locale] ?? suffixes[usecaseSlug]?.en ?? (locale === 'fr' ? 'ce cas d’usage' : locale === 'es' ? 'este objetivo' : 'this use case');
  const connector = locale === 'en' ? 'for' : locale === 'es' ? 'en' : 'sur';
  return `${prefix} ${criterion.toLowerCase()} ${connector} ${suffix}.`;
}

function buildPickBullets(locale: AppLocale, criteria: string[], rank: number) {
  const primary = criteria[(rank - 1) % criteria.length] ?? criteria[0] ?? 'Use-case fit';
  const secondary = criteria[rank % criteria.length] ?? criteria[1] ?? 'Reliable output';
  const tertiary = criteria[(rank + 1) % criteria.length] ?? criteria[2] ?? 'Efficient review loop';
  const labels: Record<AppLocale, [string, string, string]> = {
    en: ['Strong', 'Good', 'Practical'],
    fr: ['Fort sur', 'Bon sur', 'Pratique pour'],
    es: ['Fuerte en', 'Bueno en', 'Práctico para'],
  };
  const [first, second, third] = labels[locale] ?? labels.en;
  return [`${first} ${primary.toLowerCase()}`, `${second} ${secondary.toLowerCase()}`, `${third} ${tertiary.toLowerCase()}`];
}

export function getPublishedRelatedComparisons(entry: BestForEntry) {
  return Array.from(
    new Set(
      (entry.relatedComparisons ?? [])
        .filter((slug) => isPublishedComparisonSlug(slug))
        .map((slug) => canonicalizePublishedCompareSlug(slug))
    )
  );
}

export function pickComparisonSlug(picks: RankedPick[], relatedComparisons: string[]) {
  const explicit = relatedComparisons.find((slug) => isPublishedComparisonSlug(slug));
  if (explicit) return canonicalizePublishedCompareSlug(explicit);
  for (let index = 0; index < picks.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < picks.length; nextIndex += 1) {
      const candidate = `${picks[index].slug}-vs-${picks[nextIndex].slug}`;
      if (isPublishedComparisonSlug(candidate)) {
        return canonicalizePublishedCompareSlug(candidate);
      }
    }
  }
  return null;
}

export function findComparisonForPick(slug: string, relatedComparisons: string[]) {
  return relatedComparisons.find((comparison) => comparison.split('-vs-').includes(slug)) ?? null;
}

export function getExamplesSlug(pick: RankedPick) {
  return pick.engine?.family ?? pick.slug;
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

function getRelatedBestForGuides(slug: string) {
  const relatedBySlug: Record<string, string[]> = {
    'cinematic-realism': ['fast-drafts', 'multi-shot-video', 'product-videos', 'character-reference', '4k-video'],
    'image-to-video': ['reference-to-video', 'product-videos', 'character-reference', 'ads'],
    'character-reference': ['reference-to-video', 'ugc-ads', 'multi-shot-video', 'product-videos'],
    'reference-to-video': ['image-to-video', 'character-reference', 'product-videos', 'ads'],
    'multi-shot-video': ['cinematic-realism', 'character-reference', 'ads', 'fast-drafts'],
    '4k-video': ['cinematic-realism', 'product-videos', 'ads', 'fast-drafts'],
    ads: ['ugc-ads', 'product-videos', 'cinematic-realism', 'reference-to-video'],
    'ugc-ads': ['ads', 'lipsync-dialogue', 'character-reference', 'fast-drafts'],
    'product-videos': ['ads', 'image-to-video', 'reference-to-video', '4k-video'],
    'lipsync-dialogue': ['ugc-ads', 'character-reference', 'cinematic-realism', 'fast-drafts'],
    'fast-drafts': ['cinematic-realism', 'ads', 'multi-shot-video', '4k-video'],
    'stylized-anime': ['fast-drafts', 'image-to-video', 'multi-shot-video', 'character-reference'],
  };
  const targets = relatedBySlug[slug] ?? BEST_FOR_PAGES.filter((entry) => entry.slug !== slug).slice(0, 4).map((entry) => entry.slug);
  return targets.map((target) => getEntry(target)).filter((entry): entry is BestForEntry => Boolean(entry)).slice(0, 5);
}

export async function resolveRelatedBestForGuides(locale: AppLocale, slug: string): Promise<RelatedGuideEntry[]> {
  const guides = getRelatedBestForGuides(slug);
  const localizedRoot = locale === defaultLocale ? 'content/en/best-for' : `content/${locale}/best-for`;
  const [localizedEntries, englishEntries] = await Promise.all([
    getContentEntries(localizedRoot),
    locale === defaultLocale ? Promise.resolve([]) : getContentEntries('content/en/best-for'),
  ]);
  const localizedBySlug = new Map(localizedEntries.map((entry) => [entry.slug, entry]));
  const englishBySlug = new Map(englishEntries.map((entry) => [entry.slug, entry]));

  return guides.map((guide) => {
    const content = localizedBySlug.get(guide.slug) ?? englishBySlug.get(guide.slug);
    return {
      ...guide,
      displayTitle: content?.title ?? guide.title,
    };
  });
}

export function getAlsoAvailableModels(slug: string, topPicks: string[]) {
  const preferred: Record<string, string[]> = {
    'cinematic-realism': ['ltx-2-3-fast', 'wan-2-6', 'pika-text-to-video', 'happy-horse-1-0'],
    'image-to-video': ['sora-2-pro', 'veo-3-1-fast', 'pika-text-to-video', 'happy-horse-1-0'],
    'character-reference': ['seedance-2-0', 'sora-2-pro', 'veo-3-1', 'happy-horse-1-0'],
    'reference-to-video': ['sora-2-pro', 'veo-3-1-fast', 'wan-2-6', 'happy-horse-1-0'],
    'multi-shot-video': ['ltx-2-3-pro', 'wan-2-6', 'pika-text-to-video', 'happy-horse-1-0'],
    '4k-video': ['kling-3-pro', 'veo-3-1', 'sora-2-pro'],
    ads: ['veo-3-1-fast', 'sora-2-pro', 'pika-text-to-video', 'happy-horse-1-0'],
    'ugc-ads': ['ltx-2-3-pro', 'veo-3-1-fast', 'pika-text-to-video', 'happy-horse-1-0'],
    'product-videos': ['kling-3-4k', 'veo-3-1-fast', 'pika-text-to-video', 'happy-horse-1-0'],
    'lipsync-dialogue': ['ltx-2-3-pro', 'sora-2', 'pika-text-to-video', 'happy-horse-1-0'],
    'fast-drafts': ['pika-text-to-video', 'minimax-hailuo-02-text', 'wan-2-6'],
    'stylized-anime': ['seedance-2-0', 'wan-2-6', 'ltx-2-3-fast'],
  };
  return (preferred[slug] ?? [])
    .filter((modelSlug) => !topPicks.includes(modelSlug))
    .map((modelSlug) => ENGINE_BY_SLUG.get(modelSlug))
    .filter((engine): engine is EngineCatalogEntry => Boolean(engine))
    .slice(0, 3);
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

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function buildBreadcrumbJsonLd(locale: AppLocale, entry: BestForEntry, title: string, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Best for',
        item: getLocalizedUrl(locale, '/ai-video-engines/best-for'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: title || entry.title,
        item: canonicalUrl,
      },
    ],
  };
}

export function buildBestForItemListJsonLd(locale: AppLocale, picks: RankedPick[], canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Ranked AI video engines for ${canonicalUrl.split('/').pop()?.replace(/-/g, ' ') ?? 'this use case'}`,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: picks.map((pick) => ({
      '@type': 'ListItem',
      position: pick.rank,
      name: pick.engine?.marketingName ?? pick.slug,
      url: getLocalizedUrl(locale, `/models/${pick.slug}`),
    })),
  };
}

export function buildBestForWebPageJsonLd(title: string, description: string, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    url: canonicalUrl,
    description,
  };
}

function getFitScore(slug: string, score?: EngineScore) {
  if (!score) return undefined;
  const weights = USECASE_WEIGHTS[slug] ?? {};
  const value = scoreEngineForUsecase(score, weights);
  return value > 0 ? value : undefined;
}

export function getUsecaseCriteria(locale: AppLocale, slug: string) {
  return USECASE_CRITERIA[slug]?.[locale] ?? USECASE_CRITERIA[slug]?.en ?? USECASE_CRITERIA['image-to-video'].en;
}

export function getUsecaseChips(locale: AppLocale, slug: string, fallback: string[]) {
  return USECASE_CHIPS[slug]?.[locale] ?? USECASE_CHIPS[slug]?.en ?? fallback;
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

export function getFilledCriteria(locale: AppLocale, criteria: string[]) {
  return criteria.concat(DECISION_CRITERIA_FILLERS[locale] ?? DECISION_CRITERIA_FILLERS.en).slice(0, 5);
}

function getEngineAccent(slug: string) {
  if (slug.includes('kling')) return '#7c3aed';
  if (slug.includes('seedance')) return '#0ea5e9';
  if (slug.includes('veo')) return '#22c55e';
  if (slug.includes('sora')) return '#111827';
  if (slug.includes('ltx')) return '#f59e0b';
  if (slug.includes('pika')) return '#ec4899';
  if (slug.includes('minimax')) return '#f97316';
  if (slug.includes('wan')) return '#6366f1';
  return '#6366f1';
}
