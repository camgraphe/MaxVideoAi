import { getFalEngineBySlug } from '@/config/falEngines';
import { getRuntimeModelByCanonicalSlug, listPublicCurrentRuntimeModels } from '@/config/model-runtime';
import type { AppLocale } from '@/i18n/locales';
import { isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import flashMedia from '@/config/model-cinematic-create-media.json';
import { buildCanonicalComparePath, CANONICAL_ONLY_COMPARE_SLUGS, COMPARE_BASE_PATH_MAP, MODELS_BASE_PATH_MAP } from './model-page-links';

/** Discoverable siblings come from publication policy, never guessed comparison URLs. */
export function buildCinematicFamilyLinks(slug: string, locale: AppLocale) {
  const model = getRuntimeModelByCanonicalSlug(slug);
  if (!model) return [];
  return listPublicCurrentRuntimeModels()
    .filter(entry => entry.family === model.family && entry.category === model.category && entry.slug !== slug && entry.publication.app.published)
    .sort((a, b) => (a.publication.examples.familyRank ?? 99) - (b.publication.examples.familyRank ?? 99))
    .flatMap(entry => {
      const engine = getFalEngineBySlug(entry.slug);
      return engine ? [{ label: engine.marketingName, href: `/${MODELS_BASE_PATH_MAP[locale]}/${entry.slug}` }] : [];
    }).slice(0, 3);
}

export const cinematicDiscoveryCopy = {
  en: { title: 'Compare your options.', versions: 'Explore other versions', allComparisons: 'All video model comparisons' },
  fr: { title: 'Comparez vos options.', versions: 'Explorer les autres versions', allComparisons: 'Tous les comparatifs de modèles vidéo' },
  es: { title: 'Compara tus opciones.', versions: 'Explorar otras versiones', allComparisons: 'Todas las comparativas de modelos de vídeo' },
};

const alternativesPosters: Readonly<Record<string, string>> = {
  'seedance-2-5-flash': flashMedia.create.poster,
  'seedance-2-5': '/hero/showcase-seedance-2-5-cat-15s.webp',
  // Compartment 9, the published Kling 4.0 Flash hero (job_external_fal_6712f839e8fdd81095934387795fdac464ae58ac).
  'kling-v4-flash': '/assets/model-examples/kling-v4-flash/80010ee9e26bd73f0a921255ebe90621d342c857bfab746cba2a9699c49d212d.webp',
  // Public MiniMax H3 model-page poster, b9aec85c-9114-4bc0-a8e7-2cf990c3490f.jpg.
  'minimax-h3': '/assets/model-examples/minimax-h3/8faa476af43165998ede409240b2c589ca515acb1babdc650c3c4554031c76f2.webp',
  // Public FLUX 3 example 7a4db1b2-bfee-4279-a936-651a6c091995, an illustrated Andalusian courtyard.
  'flux-3': '/assets/model-examples/flux-3/be8b45a6256f9ded1ade7dfe52ab920ff1642b87bb2bf73e61420f42d8a0350f.webp',
  'wan-3': '/hero/showcase-wan-3-city-22s.webp',
  'minimax-h3-max': '/hero/showcase-minimax-h3-max-12s.webp',
};

export function buildCinematicAlternatives(slug: string, locale: AppLocale, choices: { slug: string; reason: string }[]) {
  const published = new Set(listPublicCurrentRuntimeModels().filter(model => model.category === 'video').map(model => model.slug));
  const current = getFalEngineBySlug(slug);
  const prefix = locale === 'en' ? '' : `/${locale}`;
  return choices.flatMap(choice => {
    if (choice.slug === slug || !published.has(choice.slug)) return [];
    const target = getFalEngineBySlug(choice.slug);
    if (!target) return [];
    const pair = [slug, choice.slug].sort().join('-vs-');
    const compareHref = isPublishedComparisonSlug(pair) ? prefix + buildCanonicalComparePath({
      compareBase: COMPARE_BASE_PATH_MAP[locale], pairSlug: pair,
      orderSlug: CANONICAL_ONLY_COMPARE_SLUGS.has(pair) ? undefined : slug,
    }) : null;
    return [{ ...choice, label: target.marketingName, poster: alternativesPosters[choice.slug],
      href: `/${MODELS_BASE_PATH_MAP[locale]}/${choice.slug}`, compareHref,
      comparisonLabel: `${current?.marketingName ?? slug} vs ${target.marketingName}` }];
  });
}
