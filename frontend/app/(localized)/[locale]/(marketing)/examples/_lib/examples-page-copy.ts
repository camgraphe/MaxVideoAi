import type { AppLocale } from '@/i18n/locales';
import { buildCompareHref, buildModelHref } from './examples-route-utils';

type PaginationDictionary = {
  prev?: string;
  next?: string;
  page?: string;
  loadMore?: string;
};

export type ExamplesNextStepLink = {
  href: string;
  label: string;
};

export function getExamplesBrowseByModelLabel(locale: AppLocale) {
  return locale === 'fr' ? 'Parcourir par marque' : locale === 'es' ? 'Explorar por modelo' : 'Browse by brand';
}

export function getExamplesGalleryUiCopy(locale: AppLocale, pagination: PaginationDictionary = {}) {
  const fallback =
    locale === 'fr'
      ? {
          prev: 'Précédent',
          next: 'Suivant',
          page: 'Page',
          loadMore: 'Voir plus d’exemples',
          loading: 'Chargement…',
          noPreview: 'Aucun aperçu',
          audioAvailable: 'Audio disponible à la lecture',
          detailsCta: 'Voir réglages et prix',
        }
      : locale === 'es'
        ? {
            prev: 'Anterior',
            next: 'Siguiente',
            page: 'Página',
            loadMore: 'Ver más ejemplos',
            loading: 'Cargando…',
            noPreview: 'Sin vista previa',
            audioAvailable: 'Audio disponible al reproducir',
            detailsCta: 'Ver ajustes y precio',
          }
        : {
            prev: 'Previous',
            next: 'Next',
            page: 'Page',
            loadMore: 'Load more examples',
            loading: 'Loading…',
            noPreview: 'No preview',
            audioAvailable: 'Audio available on playback',
            detailsCta: 'View settings & price',
          };

  return {
    ...fallback,
    prev: pagination.prev ?? fallback.prev,
    next: pagination.next ?? fallback.next,
    page: pagination.page ?? fallback.page,
    loadMore: pagination.loadMore ?? fallback.loadMore,
  };
}

export function getExamplesLongDescription(locale: AppLocale) {
  if (locale === 'fr') {
    return 'Parcourez des exemples vidéo IA par famille de modèles. Ouvrez un exemple pour consulter son prompt, ses réglages, sa durée et le coût enregistré du rendu, puis recréez-le dans votre studio.';
  }
  if (locale === 'es') {
    return 'Explora ejemplos de video IA por modelo. Abre un ejemplo para consultar su prompt, ajustes, duración y costo registrado de la generación, y después recréalo en tu espacio de trabajo.';
  }
  return 'Browse AI video examples by model. Open any example to inspect its prompt, settings, duration, and recorded render cost, then recreate it in your workspace.';
}

export function getKlingExamplesSectionTitles(locale: AppLocale, isKlingLanding: boolean) {
  if (!isKlingLanding) return null;
  if (locale === 'fr') {
    return ['Prompts Kling AI à réutiliser', 'Schémas image-vers-vidéo', 'Réglages et choix du modèle'];
  }
  if (locale === 'es') {
    return ['Prompts de Kling AI para reutilizar', 'Patrones de imagen a video', 'Ajustes y elección del modelo'];
  }
  return ['Kling AI prompts to reuse', 'Image-to-video prompt patterns', 'Settings and model fit'];
}

export function getExamplesModelPageLabels({
  isKlingLanding,
  isLtxLanding,
  locale,
}: {
  isKlingLanding: boolean;
  isLtxLanding: boolean;
  locale: AppLocale;
}) {
  const modelPagesLabel =
    locale === 'fr'
      ? 'Pages modèles concernées'
      : locale === 'es'
        ? 'Páginas de modelo relacionadas'
        : 'Related model pages';
  const currentModelPagesLabel =
    isKlingLanding
      ? locale === 'fr'
        ? 'Choisissez votre modèle Kling'
        : locale === 'es'
          ? 'Elige tu modelo Kling'
          : 'Choose your Kling model'
      : isLtxLanding
        ? locale === 'fr'
          ? 'Choisissez votre modèle LTX'
          : locale === 'es'
            ? 'Elige tu modelo LTX'
            : 'Choose your LTX model'
      : locale === 'fr'
        ? 'Pages modèles actuelles'
        : locale === 'es'
          ? 'Páginas de modelo actuales'
          : 'Current model pages';
  const supportedOlderVersionLabel =
    isKlingLanding
      ? locale === 'fr'
        ? 'Anciens modèles Kling encore pris en charge'
        : locale === 'es'
          ? 'Modelos Kling anteriores aún compatibles'
          : 'Supported older Kling models'
      : isLtxLanding
        ? locale === 'fr'
          ? 'Modèles LTX plus anciens encore pris en charge'
          : locale === 'es'
            ? 'Modelos LTX anteriores aún compatibles'
            : 'Supported older LTX models'
      : locale === 'fr'
        ? 'Version plus ancienne prise en charge'
        : locale === 'es'
          ? 'Versión anterior compatible'
          : 'Supported older version';
  const pricingLinkLabel =
    locale === 'fr' ? 'Comparer les tarifs' : locale === 'es' ? 'Comparar precios' : 'Compare pricing';

  return {
    currentModelPagesLabel,
    modelPagesLabel,
    pricingLinkLabel,
    supportedOlderVersionLabel,
  };
}

export function buildExamplesNextStepLinks({
  appLocale,
  familySlug,
  isKlingLanding,
  isLtxLanding,
  isSeedanceLanding,
  isVeoLanding,
  locale,
  pricingPath,
}: {
  appLocale: AppLocale;
  familySlug?: string;
  isKlingLanding: boolean;
  isLtxLanding: boolean;
  isSeedanceLanding: boolean;
  isVeoLanding: boolean;
  locale: AppLocale;
  pricingPath: string;
}): ExamplesNextStepLink[] {
  const compareLabel = locale === 'fr' ? 'Comparer' : locale === 'es' ? 'Comparar' : 'Compare';
  const family = familySlug ?? (isLtxLanding ? 'ltx' : isKlingLanding ? 'kling' : isSeedanceLanding ? 'seedance' : isVeoLanding ? 'veo' : '');
  // Lead with the current generation; retain selected historical comparisons for
  // visitors evaluating older examples. Published routes remain unchanged.
  const comparisons: Record<string, Array<[string, string]>> = {
    ltx: [
      ['ltx-2-5-fast-vs-ltx-2-5-pro', 'LTX 2.5 Fast vs Pro'],
      ['ltx-2-5-pro-vs-seedance-2-5', 'LTX 2.5 Pro vs Seedance 2.5'],
      ['ltx-2-5-pro-vs-veo-3-1', 'LTX 2.5 Pro vs Veo 3.1'],
      ['ltx-2-3-fast-vs-ltx-2-3-pro', 'LTX 2.3 Fast vs Pro'],
    ],
    kling: [
      ['kling-3-pro-vs-seedance-2-5', 'Kling 3 Pro vs Seedance 2.5'],
      ['kling-3-pro-vs-minimax-h3', 'Kling 3 Pro vs MiniMax H3'],
      ['kling-3-pro-vs-veo-3-1', 'Kling 3 Pro vs Veo 3.1'],
      ['kling-3-pro-vs-kling-3-standard', 'Kling 3 Pro vs Standard'],
    ],
    seedance: [
      ['seedance-2-5-vs-minimax-h3', 'Seedance 2.5 vs MiniMax H3'],
      ['seedance-2-5-vs-kling-3-pro', 'Seedance 2.5 vs Kling 3 Pro'],
      ['seedance-2-5-vs-veo-3-1', 'Seedance 2.5 vs Veo 3.1'],
      ['seedance-2-0-vs-seedance-2-0-fast', 'Seedance 2.0 vs Fast'],
    ],
    veo: [
      ['gemini-omni-flash-vs-veo-3-1', 'Gemini Omni Flash 1.1 vs Veo 3.1'],
      ['veo-3-1-vs-seedance-2-5', 'Veo 3.1 vs Seedance 2.5'],
      ['veo-3-1-vs-minimax-h3', 'Veo 3.1 vs MiniMax H3'],
      ['veo-3-1-vs-veo-3-1-fast', 'Veo 3.1 vs Fast'],
    ],
    hailuo: [
      ['minimax-h3-vs-minimax-h3-max', 'MiniMax H3 vs H3 Max'],
      ['minimax-h3-vs-veo-3-1', 'MiniMax H3 vs Veo 3.1'],
      ['minimax-h3-max-vs-seedance-2-5', 'MiniMax H3 Max vs Seedance 2.5'],
      ['minimax-hailuo-02-text-vs-veo-3-1-fast', 'Hailuo 02 vs Veo 3.1 Fast'],
    ],
    wan: [
      ['wan-3-vs-wan-3-prime', 'Wan 3 vs Wan 3 Prime'],
      ['wan-3-prime-vs-seedance-2-5', 'Wan 3 Prime vs Seedance 2.5'],
      ['wan-3-vs-kling-3-pro', 'Wan 3 vs Kling 3 Pro'],
    ],
  };
  const selected = comparisons[family];
  if (selected) return selected.map(([slug, label]) => ({ href: buildCompareHref(appLocale, slug), label: `${compareLabel} ${label}` }));
  return [
    { href: buildModelHref(appLocale, 'seedance-2-5'), label: 'Seedance 2.5' },
    { href: buildModelHref(appLocale, 'minimax-h3'), label: 'MiniMax H3' },
    { href: buildModelHref(appLocale, 'wan-3'), label: 'Wan 3' },
    { href: buildCompareHref(appLocale, 'kling-3-pro-vs-seedance-2-5'), label: `${compareLabel} Kling 3 Pro vs Seedance 2.5` },
    { href: pricingPath, label: locale === 'fr' ? 'Voir les tarifs' : locale === 'es' ? 'Ver precios' : 'View pricing' },
  ];
}

export function getExamplesMainVideoCopy(locale: AppLocale, familySlug?: string) {
  const showRecreationHint = familySlug === 'veo' || familySlug === 'hailuo';
  if (locale === 'fr') {
    return {
      recreationHint: showRecreationHint
        ? 'Depuis la fiche, reprenez cet exemple dans le studio, ajoutez vos sources et vérifiez le devis avant de générer.'
        : undefined,
      preview: 'Aperçu',
      openExample: 'Voir réglages et prix',
      openWatchPage: 'Ouvrir les détails de la vidéo',
      audioOn: 'Audio activé',
      fullPrompt: 'Prompt complet',
    };
  }
  if (locale === 'es') {
    return {
      recreationHint: showRecreationHint
        ? 'Desde la ficha, recrea este ejemplo en tu espacio de trabajo, añade tus fuentes y revisa el presupuesto antes de generar.'
        : undefined,
      preview: 'Vista previa',
      openExample: 'Ver ajustes y precio',
      openWatchPage: 'Abrir los detalles del video',
      audioOn: 'Audio activado',
      fullPrompt: 'Prompt completo',
    };
  }
  return {
    recreationHint: showRecreationHint
      ? 'From the detail page, recreate this example in your workspace, add your sources and review the quote before generating.'
      : undefined,
    preview: 'Preview',
    openExample: 'View settings & price',
    openWatchPage: 'Open video details',
    audioOn: 'Audio on',
    fullPrompt: 'Full prompt',
  };
}
