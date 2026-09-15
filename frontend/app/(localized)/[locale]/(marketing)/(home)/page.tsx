import '@/styles/marketing-home.css';
import { buildHomeComparisonData, buildHomeComparisonLinks } from './_lib/home-comparison-data';
import { HomePricingSection } from '@/components/marketing/home/HomePricingSection';
import { buildHomePriceDemo } from './_lib/home-price-demo-data';
import { HomeCreativeWorlds } from '@/components/marketing/home/HomeCreativeWorlds';
import { HomeCreationSection } from '@/components/marketing/home/HomeCreationSection';
import { HomeModelChoice } from '@/components/marketing/home/HomeModelChoice';
import { HomeToolsGallery } from '@/components/marketing/home/HomeToolsGallery';
import { loadEngineScores } from '../ai-video-engines/[slug]/_lib/compare-page-data-loaders';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { normalizeAppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { DeferredMarketingContent } from '@/components/marketing/DeferredMarketingContent';
import {
  HomeFaq,
  HomeHero,
  WorkflowSeoSummary,
  type WorkflowSeoSummaryCopy,
} from '@/components/marketing/home/HomeRedesignSections';
import { getMcpInternalLink } from '@/lib/mcp-internal-links';
import {
  BEST_FOR_MAIN_SLUGS,
  buildBestForGuideCards,
  buildHeroContent,
  buildProgrammedHeroItems,
  buildProofStats,
  computeEngineStats,
  filterProviderItems,
  loadHomepageExamples,
  selectHomepageHeroPreviews,
  loadProgrammedHomepageHeroSlots,
  loadSuccessfulGenerationCount,
  type RedesignContent,
} from './_lib/home-route-data';
import { buildFaqSchema, buildItemListSchema, buildSoftwareSchema, serializeJsonLd } from './_lib/home-jsonld';

export const revalidate = 60;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = normalizeAppLocale(params.locale);
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

export default async function HomePage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = normalizeAppLocale(params.locale);
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
  const engineScores = await loadEngineScores();
  const comparisonScores = buildHomeComparisonData(engineScores);
  const providers = filterProviderItems(content);
  const mcpLink = getMcpInternalLink(locale, 'home');
  const softwareSchema = buildSoftwareSchema(content, locale);
  const faqSchema = buildFaqSchema(content.faq.items);
  const itemListSchema = buildItemListSchema(content, providers);

  return (
    <div className="home-monochrome home-cinema">
      <HomeHero
        copy={hero}
        proofStats={proofStats}
        previews={selectHomepageHeroPreviews(examples)}
        programmedHeroItems={programmedHeroItems}
      />
      <DeferredMarketingContent><HomeCreationSection locale={locale} assistantHref={mcpLink?.href} /></DeferredMarketingContent>
      <DeferredMarketingContent><HomeCreativeWorlds locale={locale} cards={primaryBestForCards} examples={examples} providers={providers} examplesCopy={content.examples} /></DeferredMarketingContent>
      <DeferredMarketingContent>
        <HomeModelChoice locale={locale} scores={comparisonScores} startupFameLabel={startupFameLabel} comparisons={buildHomeComparisonLinks()}/>
      </DeferredMarketingContent>
      <DeferredMarketingContent>
        <HomeToolsGallery locale={locale} />
      </DeferredMarketingContent>
      <DeferredMarketingContent>
        <HomePricingSection locale={locale} models={buildHomePriceDemo(locale)} copy={content.pricingTrust} />
      </DeferredMarketingContent>
      <DeferredMarketingContent>
        {workflowSeoCopy ? <WorkflowSeoSummary copy={workflowSeoCopy} locale={locale} /> : null}
        <HomeFaq copy={content.faq} items={content.faq.items} />
      </DeferredMarketingContent>
      <script id="home-webapp-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(softwareSchema) }} />
      <script id="home-faq-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqSchema) }} />
      <script id="home-provider-itemlist-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListSchema) }} />
    </div>
  );
}
