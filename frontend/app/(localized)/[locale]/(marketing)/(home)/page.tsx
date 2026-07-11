import type { Metadata } from 'next';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { type AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { DeferredMarketingContent } from '@/components/marketing/DeferredMarketingContent';
import {
  AiVideoToolbox,
  ComparisonPreview,
  HomeFaq,
  HomeHero,
  RealExamplesPreview,
  ReferenceWorkflow,
  ShotTypeEngineSelector,
  TransparentPricingBlock,
  WorkflowSeoSummary,
  type WorkflowSeoSummaryCopy,
} from '@/components/marketing/home/HomeRedesignSections';
import {
  BEST_FOR_MAIN_SLUGS,
  buildBestForGuideCards,
  buildComparisonCardsWithExampleMedia,
  buildHeroContent,
  buildProgrammedHeroItems,
  buildProofStats,
  computeEngineStats,
  filterProviderItems,
  filterToolCards,
  loadHomepageExamples,
  loadProgrammedHomepageHeroSlots,
  loadSuccessfulGenerationCount,
  type RedesignContent,
} from './_lib/home-route-data';
import { buildFaqSchema, buildItemListSchema, buildOrganizationSchema, buildSoftwareSchema, serializeJsonLd } from './_lib/home-jsonld';

export const revalidate = 60;

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'home.meta' });

  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'home',
    image: '/og/home-hub.png',
    imageAlt: t('title'),
  });
}

export default async function HomePage(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const content = dictionary.home.redesign as RedesignContent;
  const workflowSeoCopy = dictionary.home.seoContent as WorkflowSeoSummaryCopy | undefined;
  const startupFameLabel = dictionary.home.partners?.startupFameLabel ?? 'Featured on Startup Fame';
  const stats = computeEngineStats();
  const hero = buildHeroContent(locale, content);
  const [examples, programmedHeroSlots, successfulGenerationCount] = await Promise.all([
    loadHomepageExamples(locale, content),
    loadProgrammedHomepageHeroSlots(),
    loadSuccessfulGenerationCount(),
  ]);
  const proofStats = buildProofStats(content, stats, locale, successfulGenerationCount);
  const programmedHeroItems = buildProgrammedHeroItems(locale, content, programmedHeroSlots);
  const primaryBestForCards = buildBestForGuideCards(content, BEST_FOR_MAIN_SLUGS);
  const comparisons = await buildComparisonCardsWithExampleMedia(content, examples);
  const providers = filterProviderItems(content);
  const tools = filterToolCards(content, stats);
  const softwareSchema = buildSoftwareSchema(content);
  const organizationSchema = buildOrganizationSchema();
  const faqSchema = buildFaqSchema(content.faq.items);
  const itemListSchema = buildItemListSchema(content, providers);

  return (
    <div className="home-monochrome">
      <HomeHero copy={hero} proofStats={proofStats} previews={examples.slice(0, 5)} programmedHeroItems={programmedHeroItems} />
      <DeferredMarketingContent>
        <ShotTypeEngineSelector copy={content.shotTypes} cards={primaryBestForCards} startupFameLabel={startupFameLabel} />
      </DeferredMarketingContent>
      <DeferredMarketingContent>
        <RealExamplesPreview copy={content.examples} examples={examples} providers={providers} />
      </DeferredMarketingContent>
      <DeferredMarketingContent>
        <ComparisonPreview copy={content.comparisons} comparisons={comparisons} />
      </DeferredMarketingContent>
      <DeferredMarketingContent>
        <ReferenceWorkflow copy={content.workflow} steps={content.workflow.steps} />
      </DeferredMarketingContent>
      <DeferredMarketingContent>
        <AiVideoToolbox copy={content.toolbox} tools={tools} />
      </DeferredMarketingContent>
      <DeferredMarketingContent>
        <TransparentPricingBlock copy={content.pricingTrust} cards={content.pricingTrust.cards} />
      </DeferredMarketingContent>
      <DeferredMarketingContent>
        {workflowSeoCopy ? <WorkflowSeoSummary copy={workflowSeoCopy} /> : null}
        <HomeFaq copy={content.faq} items={content.faq.items} />
      </DeferredMarketingContent>
      <Script id="home-webapp-jsonld" type="application/ld+json">
        {JSON.stringify(softwareSchema)}
      </Script>
      <Script id="home-organization-jsonld" type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </Script>
      <script id="home-faq-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqSchema) }} />
      <Script id="home-provider-itemlist-jsonld" type="application/ld+json">
        {JSON.stringify(itemListSchema)}
      </Script>
    </div>
  );
}
