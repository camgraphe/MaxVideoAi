import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n/locales';
import { getLocalizedUrl } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveLocalizedFallbackSeo } from '@/lib/seo/localizedFallback';
import {
  BEST_FOR_PAGES,
  DETAIL_COPY,
  type Params,
} from './_lib/best-for-detail-config';
import {
  buildBestForHeroDescription,
  buildBestForItemListJsonLd,
  buildBestForKeywords,
  buildBestForMetaDescription,
  buildBestForWebPageJsonLd,
  buildBreadcrumbJsonLd,
  buildRankedPick,
  getAlsoAvailableModels,
  getBestForDisplayTitle,
  getBestForEntry,
  getEntry,
  getLocalizedBestForEntry,
  getPublishedRelatedComparisons,
  getUsecaseChips,
  getUsecaseCriteria,
  loadEngineScores,
  resolveAvailableLocales,
  resolveExamplePreviewPicks,
  resolveRelatedBestForGuides,
  resolveTopPicks,
  serializeJsonLd,
} from './_lib/best-for-detail-helpers';
import { BestForDetailView } from './_components/BestForDetailView';

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  const params: Params[] = [];
  locales.forEach((locale) => {
    BEST_FOR_PAGES.forEach((entry) => {
      params.push({ locale, usecase: entry.slug });
    });
  });
  return params;
}

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const params = await props.params;
  if (!BEST_FOR_PAGES.length) {
    notFound();
  }
  const locale = params.locale ?? 'en';
  const entry = getEntry(params.usecase);
  const localizedContent = await getLocalizedBestForEntry(locale, params.usecase);
  const content = localizedContent ?? (await getBestForEntry('en', params.usecase));
  const title = getBestForDisplayTitle(locale, entry, content?.title);
  const description = entry
    ? buildBestForMetaDescription(locale, entry, content?.description)
    : 'Editorial guide to pick the best AI video engines by use case.';
  const seo = resolveLocalizedFallbackSeo({
    locale,
    hasLocalizedVersion: locale === 'en' || Boolean(localizedContent),
    englishPath: `/ai-video-engines/best-for/${params.usecase}`,
    availableLocales: await resolveAvailableLocales(params.usecase),
  });
  return buildSeoMetadata({
    locale,
    title,
    description,
    englishPath: `/ai-video-engines/best-for/${params.usecase}`,
    availableLocales: seo.availableLocales,
    canonicalOverride: seo.canonicalOverride,
    robots: seo.robots,
    keywords: entry ? buildBestForKeywords(locale, entry, title) : undefined,
  });
}

export default async function BestForDetailPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const entry = getEntry(params.usecase);
  if (!entry) {
    notFound();
  }
  const locale = params.locale ?? 'en';
  const [content, scores, relatedGuides] = await Promise.all([
    getBestForEntry(locale, entry.slug),
    loadEngineScores(),
    resolveRelatedBestForGuides(locale, entry.slug),
  ]);
  const topPicks = resolveTopPicks(entry, scores);
  const copy = DETAIL_COPY[locale] ?? DETAIL_COPY.en;
  const criteria = getUsecaseCriteria(locale, entry.slug);
  const rankedPicks = topPicks.map((slug, index) =>
    buildRankedPick({
      usecaseSlug: entry.slug,
      modelSlug: slug,
      rank: index + 1,
      scores,
      criteria,
      copy,
      locale,
    })
  );
  const examplePicks = await resolveExamplePreviewPicks(rankedPicks);
  const heroTitle = getBestForDisplayTitle(locale, entry, content?.title);
  const heroDescription = buildBestForHeroDescription(locale, entry, content?.description);
  const chips = getUsecaseChips(locale, entry.slug, criteria);
  const alsoAvailable = getAlsoAvailableModels(entry.slug, topPicks);
  const relatedComparisons = getPublishedRelatedComparisons(entry);
  const canonicalUrl = getLocalizedUrl(locale, `/ai-video-engines/best-for/${entry.slug}`);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(locale, entry, heroTitle, canonicalUrl);
  const itemListJsonLd = buildBestForItemListJsonLd(locale, rankedPicks, canonicalUrl);
  const webPageJsonLd = buildBestForWebPageJsonLd(heroTitle, heroDescription, canonicalUrl);

  return (
    <div id="top" className="container-page max-w-7xl section pt-8 sm:pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPageJsonLd) }} />
      <BestForDetailView
        alsoAvailable={alsoAvailable}
        chips={chips}
        content={content}
        copy={copy}
        criteria={criteria}
        entry={entry}
        examplePicks={examplePicks}
        heroDescription={heroDescription}
        heroTitle={heroTitle}
        locale={locale}
        rankedPicks={rankedPicks}
        relatedComparisons={relatedComparisons}
        relatedGuides={relatedGuides}
      />
    </div>
  );
}
