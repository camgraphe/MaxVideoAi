import type { Metadata } from 'next';

import type { RuntimeModelEntry } from '@/config/model-runtime';
import type { AppLocale } from '@/i18n/locales';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import type { EngineLocalizedContent } from '@/lib/models/i18n';
import { resolveLocalesForEnglishPath } from '@/lib/seo/alternateLocales';
import { buildSeoMetadata } from '@/lib/seo/metadata';

import { MarketingModelPrelaunchPageLayout } from '../_components/MarketingModelPrelaunchPageLayout';
import type { DetailCopy } from './model-page-copy';
import { buildDetailSlugMap, MODELS_BASE_PATH_MAP } from './model-page-links';
import { parseModelPrelaunchContent } from './model-page-prelaunch-content';
import { getModelPageTemplateConfig } from './model-page-template-registry';

export function buildModelPrelaunchMetadata({
  model,
  localizedContent,
  locale,
}: {
  model: RuntimeModelEntry;
  localizedContent: EngineLocalizedContent;
  locale: AppLocale;
}): Metadata {
  const title =
    localizedContent.seo.title ??
    `${localizedContent.marketingName ?? model.slug} — MaxVideo AI`;
  const description =
    localizedContent.seo.description ??
    localizedContent.overview ??
    'Track the announced launch status for this model on MaxVideoAI.';
  const detailSlugMap = buildDetailSlugMap(model.slug);
  const publishableLocales = Array.from(
    resolveLocalesForEnglishPath(`/models/${model.slug}`),
  );

  return buildSeoMetadata({
    locale,
    title,
    description,
    slugMap: detailSlugMap,
    englishPath: `/models/${model.slug}`,
    availableLocales: publishableLocales,
    image: localizedContent.seo.image,
    imageAlt: title,
    ogType: 'website',
    robots: {
      index: false,
      follow: true,
    },
  });
}

export function renderMarketingModelPrelaunchPage({
  model,
  detailCopy,
  localizedContent,
  locale,
}: {
  model: RuntimeModelEntry;
  detailCopy: DetailCopy;
  localizedContent: EngineLocalizedContent;
  locale: AppLocale;
}) {
  const template = getModelPageTemplateConfig(model.slug);
  if (!template || template.intent !== 'prelaunch') {
    throw new Error(
      `Published prelaunch model "${model.id}" requires a prelaunch template`,
    );
  }
  const content = parseModelPrelaunchContent(localizedContent, locale);
  const detailSlugMap = buildDetailSlugMap(model.slug);
  const publishableLocales = Array.from(
    resolveLocalesForEnglishPath(`/models/${model.slug}`),
  );
  const metadataUrls = buildMetadataUrls(locale, detailSlugMap, {
    englishPath: `/models/${model.slug}`,
    availableLocales: publishableLocales,
  });
  const canonicalUrl =
    metadataUrls.canonical.replace(/\/+$/, '') || metadataUrls.canonical;
  const localizedModelsBase = (MODELS_BASE_PATH_MAP[locale] ?? 'models').replace(
    /^\/+|\/+$/g,
    '',
  );
  const localePrefix = locale === 'en' ? '' : `/${locale}`;
  const localizedModelsPath = `${localePrefix}/${localizedModelsBase}`.replace(
    /\/{2,}/g,
    '/',
  );
  const siteOrigin = new URL(canonicalUrl).origin;
  const localizedHomeUrl = localePrefix
    ? `${siteOrigin}${localePrefix}`
    : `${siteOrigin}/`;
  const localizedModelsUrl = `${siteOrigin}${localizedModelsPath}`;

  return (
    <MarketingModelPrelaunchPageLayout
      content={content}
      template={template}
      locale={locale}
      canonicalUrl={canonicalUrl}
      localizedModelsPath={localizedModelsPath}
      localizedModelsUrl={localizedModelsUrl}
      localizedHomeUrl={localizedHomeUrl}
      breadcrumb={detailCopy.breadcrumb}
    />
  );
}
