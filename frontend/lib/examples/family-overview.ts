import type { AppLocale } from '@/i18n/locales';

/** Family identity stays stable while the real version links evolve separately. */
export function getEvergreenExampleFamilyCopy(locale: AppLocale, label: string) {
  if (locale === 'fr') return {
    metaTitle: `Exemples vidéo ${label} et prompts | MaxVideoAI`,
    metaDescription: `Explorez les exemples vidéo ${label}, versions récentes et historiques. Retrouvez le modèle exact, le prompt d’origine, les réglages et les tarifs actuels estimés.`,
    heroTitle: `Exemples vidéo ${label} et prompts`,
    subtitle: `Explorez les versions récentes et historiques de ${label}. Ouvrez une vidéo pour lire son prompt et ses réglages.`,
    guideTitle: `Explorer les versions de ${label}`,
    intro: `Chaque vidéo conserve le nom exact du modèle, son prompt d’origine et ses réglages. Retrouvez ci-dessous les versions récentes et historiques de ${label}.`,
  };
  if (locale === 'es') return {
    metaTitle: `Ejemplos de video de ${label} y prompts | MaxVideoAI`,
    metaDescription: `Explora ejemplos de video de ${label}, de versiones actuales y anteriores. Consulta el modelo exacto, el prompt original, los ajustes y los precios actuales estimados.`,
    heroTitle: `Ejemplos de video de ${label} y prompts`,
    subtitle: `Explora las versiones actuales y anteriores de ${label}. Abre un video para leer su prompt y sus ajustes.`,
    guideTitle: `Explora las versiones de ${label}`,
    intro: `Cada video conserva el modelo exacto, su prompt original y sus ajustes. Encuentra abajo ejemplos de las versiones actuales y anteriores de ${label}.`,
  };
  return {
    metaTitle: `${label} AI Video Examples and Prompts | MaxVideoAI`,
    metaDescription: `Explore ${label} video examples from current and earlier versions. Find the exact model, original prompt, settings and current price estimates.`,
    heroTitle: `${label} video examples and prompts`,
    subtitle: `Explore current and earlier ${label} versions. Open a video to read its original prompt and settings.`,
    guideTitle: `Explore ${label} versions`,
    intro: `Each ${label} video keeps its exact model, original prompt and settings. The links below open examples from current and earlier versions.`,
  };
}
