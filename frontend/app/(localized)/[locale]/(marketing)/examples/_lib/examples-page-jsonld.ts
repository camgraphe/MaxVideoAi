import type { AppLocale } from '@/i18n/locales';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { ENGINE_META, SITE, buildLocalizedExampleLabel, resolveEngineLinkId } from './examples-route-utils';
import type { listExamplesPage } from '@/server/videos';

type ExampleRouteVideo = Awaited<ReturnType<typeof listExamplesPage>>['items'][number];

type ExamplesJsonLdFaqBlock = {
  title: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
};

export function buildExamplesJsonLd({
  canonicalUrl,
  faqBlock,
  galleryBasePath,
  galleryVideos,
  locale,
  localePrefix,
  modelLandingLabel,
}: {
  canonicalUrl: string;
  faqBlock: ExamplesJsonLdFaqBlock;
  galleryBasePath: string;
  galleryVideos: ExampleRouteVideo[];
  locale: AppLocale;
  localePrefix: string;
  modelLandingLabel?: string | null;
}) {
  const itemListElements = buildExamplesItemListElements({
    galleryVideos,
    locale,
  });
  const baseExamplesUrl = `${SITE}${galleryBasePath}`;
  const breadcrumbLabels = getBreadcrumbLabels(locale);
  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      position: 1,
      name: breadcrumbLabels.home,
      item: `${SITE}${localePrefix || ''}`,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: breadcrumbLabels.examples,
      item: baseExamplesUrl,
    },
  ];
  if (modelLandingLabel) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: modelLandingLabel,
      item: canonicalUrl,
    });
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };

  const itemListJson =
    itemListElements.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: modelLandingLabel
            ? `AI video examples for ${modelLandingLabel} on MaxVideoAI`
            : 'AI video examples on MaxVideoAI',
          numberOfItems: itemListElements.length,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          url: canonicalUrl,
          itemListElement: itemListElements,
        }
      : null;
  const faqJsonLd = faqBlock.items.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqBlock.items.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      }
    : null;

  return {
    breadcrumbJsonLd,
    faqJsonLd,
    itemListJson,
  };
}

function buildExamplesItemListElements({
  galleryVideos,
  locale,
}: {
  galleryVideos: ExampleRouteVideo[];
  locale: AppLocale;
}) {
  return galleryVideos.map((video, index) => {
    const canonicalEngineId = resolveEngineLinkId(video.engineId);
    const engineKey = canonicalEngineId?.toLowerCase() ?? video.engineId?.toLowerCase() ?? '';
    const engineMeta = engineKey ? ENGINE_META.get(engineKey) : null;
    const engineLabel = engineMeta?.label ?? video.engineLabel ?? canonicalEngineId ?? 'Engine';
    const detailPath = `/video/${encodeURIComponent(video.id)}`;
    const absoluteUrl = `${SITE}${detailPath}`;
    const fallbackLabel = `MaxVideoAI example ${video.id}`;
    const name =
      locale === 'en'
        ? video.promptExcerpt || video.prompt || `${engineLabel} video example` || fallbackLabel
        : buildLocalizedExampleLabel(locale, engineLabel, video.aspectRatio ?? null, video.durationSec);
    return {
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl,
      name: name || fallbackLabel,
    };
  });
}
