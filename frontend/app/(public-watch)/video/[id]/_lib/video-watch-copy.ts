import type { AppLocale } from '@/i18n/locales';

export function videoWatchCopy(locale: AppLocale) {
  return locale === 'fr'
    ? { breadcrumb: 'Fil d’Ariane', home: 'Accueil', examples: 'Exemples', models: 'Modèles', related: 'Exemples similaires', allExamples: 'Voir tous les exemples', noPreview: 'Aucun aperçu' }
    : locale === 'es'
      ? { breadcrumb: 'Ruta de navegación', home: 'Inicio', examples: 'Ejemplos', models: 'Modelos', related: 'Ejemplos relacionados', allExamples: 'Ver todos los ejemplos', noPreview: 'Sin vista previa' }
      : { breadcrumb: 'Breadcrumb', home: 'Home', examples: 'Examples', models: 'Models', related: 'Related examples', allExamples: 'View all examples', noPreview: 'No preview' };
}
