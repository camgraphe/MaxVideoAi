import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import {
  MODELS_SLUG_MAP,
  getModelsScopeEnglishPath,
  getModelsScopePath,
  getScopeDefaults,
  splitHeroAccentTitle,
  splitModelsHeroTitle,
  type ModelsPageScope,
} from './_lib/models-catalog-utils';
import {
  buildModelsCatalogCards,
  type ModelsCatalogEngineMetaCopy,
  type ModelsCatalogGalleryCopy,
} from './_lib/models-catalog-cards';
import { buildModelsFaqItems } from './_lib/models-catalog-sections';
import { buildModelsCatalogDecisionData } from './_lib/models-catalog-decision-data';
import { ModelsCatalogDecisionFaq } from './_components/ModelsCatalogDecisionFaq';
import { ModelsCatalogGallerySection } from './_components/ModelsCatalogGallerySection';
import { ModelsCatalogHero } from './_components/ModelsCatalogHero';
import { ModelsCatalogJsonLdScripts } from './_components/ModelsCatalogJsonLdScripts';
import { ModelsCatalogPopularComparisons } from './_components/ModelsCatalogPopularComparisons';
import { ModelsCatalogPricingLimitsSection } from './_components/ModelsCatalogPricingLimitsSection';
import { ModelsCatalogRecommendedSection } from './_components/ModelsCatalogRecommendedSection';
import { ModelsCatalogUseCaseStrip } from './_components/ModelsCatalogUseCaseStrip';

type ModelsDecisionCopy = {
  eyebrow?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  primaryCta?: string;
  secondaryCta?: string;
  topPicksTitle?: string;
  topPicksViewAll?: string;
  useCasesTitle?: string;
  useCasesViewAll?: string;
  bestLabel?: string;
  recommendedTitle?: string;
  recommendedSubtitle?: string;
  recommendedSeeAll?: string;
  recommendedFromLabel?: string;
  recommendedDurationLabel?: string;
  recommendedResolutionLabel?: string;
  allModelsTitle?: string;
  allModelsSubtitle?: string;
  popularComparisonsTitle?: string;
  popularComparisonsSubtitle?: string;
  compareHubLabel?: string;
  pricingLimitsTitle?: string;
  pricingLimitsBody?: string;
  faqTitle?: string;
};

type ModelsListingCopy = {
  decision?: ModelsDecisionCopy;
  hero?: {
    title?: string;
    subtitle?: string;
    bullets?: string[];
    compareLabel?: string;
  };
  grid?: {
    srTitle?: string;
    bridgeText?: string;
  };
  reliability?: {
    faq?: { question?: string; answer?: string }[];
  };
};

export async function generateModelsMetadata({
  params,
  scope = 'all',
}: {
  params: { locale: AppLocale };
  scope?: ModelsPageScope;
}): Promise<Metadata> {
  const locale = params.locale;
  const scopeDefaults = getScopeDefaults(scope, locale);
  const t = scope === 'all' ? await getTranslations({ locale, namespace: 'models.meta' }) : null;
  const meta = buildSeoMetadata({
    locale,
    title: scope === 'all' ? t!('title') : scopeDefaults.metaTitle,
    description: scope === 'all' ? t!('description') : scopeDefaults.metaDescription,
    ...(scope === 'all'
      ? {
          hreflangGroup: 'models' as const,
          slugMap: MODELS_SLUG_MAP,
        }
      : {
          englishPath: getModelsScopeEnglishPath(scope),
        }),
    image: '/og/models-hub.png',
    imageAlt: 'Model lineup overview with Price-Before chip.',
  });
  return meta;
}

export default async function ModelsCatalogPage({ scope = 'all' }: { scope?: ModelsPageScope }) {
  const { locale, dictionary } = await resolveDictionary();
  const activeLocale = locale as AppLocale;
  const scopeDefaults = getScopeDefaults(scope, activeLocale);
  const breadcrumbLabels = getBreadcrumbLabels(activeLocale);
  const localePrefix = localePathnames[activeLocale] ? `/${localePathnames[activeLocale]}` : '';
  const modelsBasePath = `${localePrefix}/${MODELS_SLUG_MAP[activeLocale] ?? MODELS_SLUG_MAP.en ?? 'models'}`.replace(
    /\/{2,}/g,
    '/'
  );
  const modelsPath = `${localePrefix}${getModelsScopePath(scope, activeLocale)}`.replace(/\/{2,}/g, '/');
  const homeUrl = `${SITE_BASE_URL}${localePrefix || ''}`;
  const modelsUrl = `${SITE_BASE_URL}${modelsPath}`;
  const modelsBaseUrl = `${SITE_BASE_URL}${modelsBasePath}`;
  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      position: 1,
      name: breadcrumbLabels.home,
      item: homeUrl,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: breadcrumbLabels.models,
      item: modelsBaseUrl,
    },
  ];
  if (scope !== 'all' && scopeDefaults.breadcrumbCurrent) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: scopeDefaults.breadcrumbCurrent,
      item: modelsUrl,
    });
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };

  const content = dictionary.models;
  const galleryCopy = (content.gallery ?? {}) as unknown as ModelsCatalogGalleryCopy;
  const listingCopy = (content.listing ?? {}) as ModelsListingCopy;
  const decisionCopy = listingCopy.decision ?? {};
  const heroTitle =
    scope === 'all'
      ? decisionCopy.heroTitle ?? listingCopy.hero?.title ?? content.hero?.title ?? scopeDefaults.heroTitle
      : scopeDefaults.heroTitle;
  const heroSubhead =
    scope === 'all'
      ? decisionCopy.heroSubtitle ?? listingCopy.hero?.subtitle ?? content.hero?.subtitle ?? scopeDefaults.heroSubhead
      : scopeDefaults.heroSubhead;
  const modelCards = await buildModelsCatalogCards({
    activeLocale,
    engineMetaCopy: (content.meta ?? {}) as ModelsCatalogEngineMetaCopy,
    engineTypeLabelOverrides: content.engineTypeLabels as Record<string, string> | undefined,
    galleryCopy,
    scope,
  });
  const decisionData = buildModelsCatalogDecisionData({
    activeLocale,
    cards: modelCards,
  });

  const heroTitleParts = splitModelsHeroTitle(heroTitle);
  const heroAccentParts = splitHeroAccentTitle(heroTitleParts.accent);
  const galleryVisibleFilters: Array<'sort' | 'mode' | 'format' | 'duration' | 'price' | 'age'> =
    scope === 'all'
      ? ['sort', 'format', 'mode', 'price']
      : scope === 'image'
        ? ['sort', 'format', 'price', 'age']
        : ['sort', 'format', 'mode', 'price', 'duration', 'age'];
  const gallerySrTitle =
    scope === 'all' ? listingCopy.grid?.srTitle ?? scopeDefaults.gridSrTitle : scopeDefaults.gridSrTitle;
  const galleryBridgeText =
    scope === 'all' ? listingCopy.grid?.bridgeText ?? scopeDefaults.bridgeText : scopeDefaults.bridgeText;
  const faqItems =
    scope === 'all'
      ? decisionData.faqItems
      : buildModelsFaqItems({
          listingFaq: listingCopy.reliability?.faq,
          scope,
        });

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: modelCards.map((card, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: card.label,
      url: `${SITE_BASE_URL}${modelsBasePath}/${card.id}`,
    })),
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <main className="bg-bg text-text-primary">
      <ModelsCatalogHero
        badges={decisionData.badges}
        eyebrow={decisionCopy.eyebrow ?? scopeDefaults.breadcrumbCurrent ?? 'AI model directory'}
        heroAccentParts={heroAccentParts}
        heroSubhead={heroSubhead}
        heroTitleParts={heroTitleParts}
        primaryCtaLabel={decisionCopy.primaryCta ?? 'Browse models'}
        secondaryCtaLabel={decisionCopy.secondaryCta ?? 'Compare engines'}
        topPicks={decisionData.topPicks}
        topPicksTitle={decisionCopy.topPicksTitle ?? 'Recommended starting points'}
        topPicksViewAllLabel={decisionCopy.topPicksViewAll ?? 'View all recommendations'}
      />

      {scope === 'all' ? (
        <>
          <ModelsCatalogUseCaseStrip
            bestLabel={decisionCopy.bestLabel ?? 'Best'}
            title={decisionCopy.useCasesTitle ?? scopeDefaults.chooseOutcomeTitle}
            viewAllLabel={decisionCopy.useCasesViewAll ?? scopeDefaults.ctaPrimaryLabel}
            items={decisionData.useCases}
          />
          {decisionData.recommendedCards.length ? (
            <ModelsCatalogRecommendedSection
              title={decisionCopy.recommendedTitle ?? scopeDefaults.chooseOutcomeTitle}
              subtitle={decisionCopy.recommendedSubtitle ?? scopeDefaults.chooseOutcomeSubtitle}
              cards={decisionData.recommendedCards}
              allModelsLabel={decisionCopy.recommendedSeeAll ?? decisionCopy.allModelsTitle ?? gallerySrTitle}
              statsLabels={{
                from: decisionCopy.recommendedFromLabel ?? galleryCopy.stats?.from ?? 'From',
                duration: decisionCopy.recommendedDurationLabel ?? galleryCopy.stats?.maxDurShort ?? 'Max dur.',
                resolution: decisionCopy.recommendedResolutionLabel ?? galleryCopy.stats?.maxResShort ?? 'Max res.',
              }}
            />
          ) : null}
        </>
      ) : null}

      <div className="py-8 sm:py-10">
        <ModelsCatalogGallerySection
          allowCompare={scope !== 'image'}
          bridgeText={galleryBridgeText}
          cards={modelCards}
          copy={content.gallery}
          ctaLabel={content.cardCtaLabel ?? 'View specs'}
          initialEngineType={scope === 'image' ? 'image' : 'video'}
          srTitle={gallerySrTitle}
          showEngineTypeTabs={scope === 'all'}
          title={scope === 'all' ? decisionCopy.allModelsTitle ?? scopeDefaults.gridSrTitle : scopeDefaults.gridSrTitle}
          subtitle={scope === 'all' ? decisionCopy.allModelsSubtitle ?? scopeDefaults.bridgeText : scopeDefaults.bridgeText}
          visibleFilters={galleryVisibleFilters}
        />
      </div>

      <div className="container-page max-w-[1248px] pb-[var(--section-padding-y)]">
        <div className="space-y-6">
          {scope === 'all' ? (
            <>
              <ModelsCatalogPopularComparisons
                title={decisionCopy.popularComparisonsTitle ?? scopeDefaults.reliabilityTitle}
                subtitle={decisionCopy.popularComparisonsSubtitle ?? scopeDefaults.reliabilitySubtitle}
                hubLabel={decisionCopy.compareHubLabel ?? 'Compare hub'}
                comparisons={decisionData.popularComparisons}
              />
              <ModelsCatalogPricingLimitsSection
                title={decisionCopy.pricingLimitsTitle ?? scopeDefaults.reliabilityTitle}
                body={decisionCopy.pricingLimitsBody ?? scopeDefaults.reliabilitySubtitle}
                items={decisionData.pricingLimits}
              />
            </>
          ) : null}
          <ModelsCatalogDecisionFaq
            title={scope === 'all' ? decisionCopy.faqTitle ?? scopeDefaults.reliabilityTitle : scopeDefaults.reliabilityTitle}
            items={faqItems}
          />
        </div>
      </div>

      <ModelsCatalogJsonLdScripts
        breadcrumbJsonLd={breadcrumbJsonLd}
        faqJsonLd={faqJsonLd}
        itemListJsonLd={itemListJsonLd}
      />
    </main>
  );
}
