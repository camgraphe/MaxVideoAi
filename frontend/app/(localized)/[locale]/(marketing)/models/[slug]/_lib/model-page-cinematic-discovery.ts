import { getFalEngineBySlug } from '@/config/falEngines';
import { getRuntimeModelByCanonicalSlug, listPublicCurrentRuntimeModels } from '@/config/model-runtime';
import type { AppLocale } from '@/i18n/locales';
import { MODELS_BASE_PATH_MAP } from './model-page-links';

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
