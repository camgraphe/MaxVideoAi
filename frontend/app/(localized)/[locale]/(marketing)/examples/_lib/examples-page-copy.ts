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
  return locale === 'fr' ? 'Parcourir par marque' : locale === 'es' ? 'Explorar por marca' : 'Browse by brand';
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
          }
        : {
            prev: 'Previous',
            next: 'Next',
            page: 'Page',
            loadMore: 'Load more examples',
            loading: 'Loading…',
            noPreview: 'No preview',
            audioAvailable: 'Audio available on playback',
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
    return "Parcourez des exemples de vidéo IA par marque, avec prompt, réglages, durée et prix par clip. Utilisez cette page pour comparer des schémas texte-vers-vidéo IA, image-vers-vidéo IA et certains flux vidéo-vers-vidéo IA, puis ouvrez les pages modèles pour les caractéristiques, limites et détails de mode.";
  }
  if (locale === 'es') {
    return 'Explora ejemplos de video con IA por marca, con prompt, ajustes, duración y precio por clip. Usa esta página para comparar patrones de text-to-video AI, image-to-video AI y algunos workflows de video-to-video AI, y abre las páginas de modelos para ver especificaciones, límites y detalles por modo.';
  }
  return 'Browse AI video examples by model, including prompt, settings, duration, and price per clip. Use this hub to compare text-to-video AI, image-to-video AI, and selected video-to-video AI patterns across brands, then open model pages for specs, limits, and mode details.';
}

export function getKlingExamplesSectionTitles(locale: AppLocale, isKlingLanding: boolean) {
  if (!isKlingLanding) return null;
  if (locale === 'fr') {
    return ['Prompts Kling AI a reutiliser', 'Schemas image-vers-video', 'Reglages et choix du modele'];
  }
  if (locale === 'es') {
    return ['Prompts de Kling AI para reutilizar', 'Patrones image-to-video', 'Ajustes y eleccion del modelo'];
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
        ? 'Choisissez votre modele Kling'
        : locale === 'es'
          ? 'Elige tu modelo Kling'
          : 'Choose your Kling model'
      : isLtxLanding
        ? locale === 'fr'
          ? 'Choisissez votre modele LTX'
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
        ? 'Anciens modeles Kling encore pris en charge'
        : locale === 'es'
          ? 'Modelos Kling anteriores aun compatibles'
          : 'Supported older Kling models'
      : isLtxLanding
        ? locale === 'fr'
          ? 'Modeles LTX plus anciens encore pris en charge'
          : locale === 'es'
            ? 'Modelos LTX anteriores aun compatibles'
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
  isKlingLanding,
  isLtxLanding,
  isSeedanceLanding,
  isVeoLanding,
  locale,
  pricingPath,
}: {
  appLocale: AppLocale;
  isKlingLanding: boolean;
  isLtxLanding: boolean;
  isSeedanceLanding: boolean;
  isVeoLanding: boolean;
  locale: AppLocale;
  pricingPath: string;
}): ExamplesNextStepLink[] {
  const rawNextStepLinks = isSeedanceLanding
    ? [
        {
          href: buildCompareHref(appLocale, 'seedance-2-0-vs-seedance-2-0-fast'),
          label:
            locale === 'fr'
              ? 'Comparer Seedance 2.0 vs Seedance 2.0 Fast'
              : locale === 'es'
                ? 'Comparar Seedance 2.0 vs Seedance 2.0 Fast'
                : 'Compare Seedance 2.0 vs Seedance 2.0 Fast',
        },
        {
          href: buildCompareHref(appLocale, 'seedance-2-0-vs-veo-3-1'),
          label:
            locale === 'fr'
              ? 'Comparer Seedance 2.0 vs Veo 3.1'
              : locale === 'es'
                ? 'Comparar Seedance 2.0 vs Veo 3.1'
                : 'Compare Seedance 2.0 vs Veo 3.1',
        },
        {
          href: buildCompareHref(appLocale, 'seedance-1-5-pro-vs-seedance-2-0'),
          label:
            locale === 'fr'
              ? 'Comparer Seedance 1.5 Pro vs Seedance 2.0'
              : locale === 'es'
                ? 'Comparar Seedance 1.5 Pro vs Seedance 2.0'
                : 'Compare Seedance 1.5 Pro vs Seedance 2.0',
        },
        {
          href: buildCompareHref(appLocale, 'ltx-2-3-pro-vs-seedance-2-0'),
          label:
            locale === 'fr'
              ? 'Comparer LTX 2.3 Pro vs Seedance 2.0'
              : locale === 'es'
                ? 'Comparar LTX 2.3 Pro vs Seedance 2.0'
                : 'Compare LTX 2.3 Pro vs Seedance 2.0',
        },
      ]
    : isKlingLanding
      ? [
          {
            href: buildModelHref(appLocale, 'kling-3-pro'),
            label:
              locale === 'fr'
                ? 'Ouvrir la page modele Kling 3 Pro'
                : locale === 'es'
                  ? 'Abrir la pagina del modelo Kling 3 Pro'
                  : 'Open Kling 3 Pro model page',
          },
          {
            href: buildModelHref(appLocale, 'kling-3-standard'),
            label:
              locale === 'fr'
                ? 'Ouvrir la page modele Kling 3 Standard'
                : locale === 'es'
                  ? 'Abrir la pagina del modelo Kling 3 Standard'
                  : 'Open Kling 3 Standard model page',
          },
          {
            href: buildCompareHref(appLocale, 'kling-3-pro-vs-kling-3-standard'),
            label:
              locale === 'fr'
                ? 'Comparer Kling 3 Pro vs Kling 3 Standard'
                : locale === 'es'
                  ? 'Comparar Kling 3 Pro vs Kling 3 Standard'
                  : 'Compare Kling 3 Pro vs Kling 3 Standard',
          },
          {
            href: buildCompareHref(appLocale, 'kling-3-pro-vs-veo-3-1'),
            label:
              locale === 'fr'
                ? 'Comparer Kling 3 Pro vs Veo 3.1'
                : locale === 'es'
                  ? 'Comparar Kling 3 Pro vs Veo 3.1'
                  : 'Compare Kling 3 Pro vs Veo 3.1',
          },
          {
            href: buildCompareHref(appLocale, 'kling-3-pro-vs-seedance-2-0'),
            label:
              locale === 'fr'
                ? 'Comparer Kling 3 Pro vs Seedance 2.0'
                : locale === 'es'
                  ? 'Comparar Kling 3 Pro vs Seedance 2.0'
                  : 'Compare Kling 3 Pro vs Seedance 2.0',
          },
        ]
      : isVeoLanding
        ? [
            {
              href: buildCompareHref(appLocale, 'veo-3-1-vs-veo-3-1-fast'),
              label:
                locale === 'fr'
                  ? 'Comparer Veo 3.1 vs Veo 3.1 Fast'
                  : locale === 'es'
                    ? 'Comparar Veo 3.1 vs Veo 3.1 Fast'
                    : 'Compare Veo 3.1 vs Veo 3.1 Fast',
            },
            {
              href: buildCompareHref(appLocale, 'veo-3-1-fast-vs-veo-3-1-lite'),
              label:
                locale === 'fr'
                  ? 'Comparer Veo 3.1 Fast vs Veo 3.1 Lite'
                  : locale === 'es'
                    ? 'Comparar Veo 3.1 Fast vs Veo 3.1 Lite'
                    : 'Compare Veo 3.1 Fast vs Veo 3.1 Lite',
            },
            {
              href: buildCompareHref(appLocale, 'seedance-2-0-vs-veo-3-1'),
              label:
                locale === 'fr'
                  ? 'Comparer Seedance 2.0 vs Veo 3.1'
                  : locale === 'es'
                    ? 'Comparar Seedance 2.0 vs Veo 3.1'
                    : 'Compare Seedance 2.0 vs Veo 3.1',
            },
            {
              href: buildCompareHref(appLocale, 'kling-3-pro-vs-veo-3-1'),
              label:
                locale === 'fr'
                  ? 'Comparer Kling 3 Pro vs Veo 3.1'
                  : locale === 'es'
                    ? 'Comparar Kling 3 Pro vs Veo 3.1'
                    : 'Compare Kling 3 Pro vs Veo 3.1',
            },
            {
              href: buildCompareHref(appLocale, 'ltx-2-3-pro-vs-veo-3-1'),
              label:
                locale === 'fr'
                  ? 'Comparer LTX 2.3 Pro vs Veo 3.1'
                  : locale === 'es'
                    ? 'Comparar LTX 2.3 Pro vs Veo 3.1'
                    : 'Compare LTX 2.3 Pro vs Veo 3.1',
            },
          ]
        : isLtxLanding
          ? [
              {
                href: buildCompareHref(appLocale, 'ltx-2-3-fast-vs-ltx-2-3-pro'),
                label:
                  locale === 'fr'
                    ? 'Comparer LTX 2.3 Fast vs LTX 2.3 Pro'
                    : locale === 'es'
                      ? 'Comparar LTX 2.3 Fast vs LTX 2.3 Pro'
                      : 'Compare LTX 2.3 Fast vs LTX 2.3 Pro',
              },
              {
                href: buildCompareHref(appLocale, 'ltx-2-3-pro-vs-seedance-2-0'),
                label:
                  locale === 'fr'
                    ? 'Comparer LTX 2.3 Pro vs Seedance 2.0'
                    : locale === 'es'
                      ? 'Comparar LTX 2.3 Pro vs Seedance 2.0'
                      : 'Compare LTX 2.3 Pro vs Seedance 2.0',
              },
              {
                href: buildCompareHref(appLocale, 'ltx-2-3-pro-vs-veo-3-1'),
                label:
                  locale === 'fr'
                    ? 'Comparer LTX 2.3 Pro vs Veo 3.1'
                    : locale === 'es'
                      ? 'Comparar LTX 2.3 Pro vs Veo 3.1'
                      : 'Compare LTX 2.3 Pro vs Veo 3.1',
              },
              {
                href: buildCompareHref(appLocale, 'ltx-2-3-fast-vs-seedance-2-0-fast'),
                label:
                  locale === 'fr'
                    ? 'Comparer LTX 2.3 Fast vs Seedance 2.0 Fast'
                    : locale === 'es'
                      ? 'Comparar LTX 2.3 Fast vs Seedance 2.0 Fast'
                      : 'Compare LTX 2.3 Fast vs Seedance 2.0 Fast',
              },
            ]
          : [
              {
                href: buildModelHref(appLocale, 'veo-3-1-fast'),
                label:
                  locale === 'fr'
                    ? 'Voir le profil Veo 3.1 Fast'
                    : locale === 'es'
                      ? 'Ver el perfil de Veo 3.1 Fast'
                      : 'View Veo 3.1 Fast profile',
              },
              {
                href: buildModelHref(appLocale, 'seedance-2-0'),
                label:
                  locale === 'fr'
                    ? 'Voir le profil Seedance 2.0'
                    : locale === 'es'
                      ? 'Ver el perfil de Seedance 2.0'
                      : 'View Seedance 2.0 profile',
              },
              {
                href: buildCompareHref(appLocale, 'kling-3-pro-vs-veo-3-1'),
                label:
                  locale === 'fr'
                    ? 'Comparer Kling 3 Pro vs Veo 3.1'
                    : locale === 'es'
                      ? 'Comparar Kling 3 Pro vs Veo 3.1'
                      : 'Compare Kling 3 Pro vs Veo 3.1',
              },
              {
                href: buildCompareHref(appLocale, 'seedance-2-0-vs-sora-2'),
                label:
                  locale === 'fr'
                    ? 'Comparer Seedance 2.0 vs Sora 2'
                    : locale === 'es'
                      ? 'Comparar Seedance 2.0 vs Sora 2'
                      : 'Compare Seedance 2.0 vs Sora 2',
              },
            ];
  const repeatedModelStepHrefs = new Set<string>([pricingPath]);
  return rawNextStepLinks.filter(
    (item, index, items) =>
      !repeatedModelStepHrefs.has(item.href) &&
      items.findIndex((candidate) => candidate.href === item.href) === index
  );
}

export function getExamplesMainVideoCopy(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      preview: 'Aperçu',
      openExample: "Ouvrir l'exemple",
      openWatchPage: 'Ouvrir la page vidéo',
      audioOn: 'Audio activé',
      fullPrompt: 'Prompt complet',
    };
  }
  if (locale === 'es') {
    return {
      preview: 'Vista previa',
      openExample: 'Abrir ejemplo',
      openWatchPage: 'Abrir la página del video',
      audioOn: 'Audio activado',
      fullPrompt: 'Prompt completo',
    };
  }
  return {
    preview: 'Preview',
    openExample: 'Open example',
    openWatchPage: 'Open watch page',
    audioOn: 'Audio on',
    fullPrompt: 'Full prompt',
  };
}
