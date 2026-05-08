import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { DEFAULT_MARKETING_SCENARIO, scenarioToPricingInput, type PricingScenario } from '@/lib/pricing-scenarios';
import { FEATURES } from '@/content/feature-flags';
import { getMembershipTiers } from '@/lib/membership';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls, SITE_BASE_URL } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { buildMarketingServiceJsonLd } from '@/lib/seo/marketingServiceJsonLd';
import { listFalEngines } from '@/config/falEngines';
import { computePricingSnapshot, listPricingRules } from '@/lib/pricing';
import type { PricingRuleLite } from '@/lib/pricing-rules';
import { listEnginePricingOverrides } from '@/server/engine-settings';
import { applyEnginePricingOverride } from '@/lib/pricing-definition';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import {
  DEFAULT_EXAMPLE_COSTS,
  DEFAULT_PRICE_FACTORS,
  formatCurrencyForLocale,
  type ExampleCardConfig,
  type ExampleCostsContent,
  type PriceFactorsContent,
} from './_lib/pricingPageContent';
import { PricingEstimatorSection } from './_components/PricingEstimatorSection';
import { PricingExampleCostsSection } from './_components/PricingExampleCostsSection';
import { PricingHeroSection } from './_components/PricingHeroSection';
import { PricingJsonLdScripts } from './_components/PricingJsonLdScripts';
import { PricingMemberTiersSection } from './_components/PricingMemberTiersSection';
import {
  PricingRelatedLinksSection,
  type PricingRelatedLink,
} from './_components/PricingRelatedLinksSection';
import { PricingPreviewSection } from './_components/PricingPreviewSection';
import { PricingPriceFactorsSection } from './_components/PricingPriceFactorsSection';
import { PricingRefundsFaqSection } from './_components/PricingRefundsFaqSection';

const PRICING_SLUG_MAP = buildSlugMap('pricing');

export const revalidate = 600;

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'pricing.meta' });
  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'pricing',
    slugMap: PRICING_SLUG_MAP,
    image: '/og/pricing-hub.png',
    imageAlt: 'Pricing estimator interface.',
  });
}

export default async function PricingPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const content = dictionary.pricing;
  const liveLabel = content.liveLabel ?? (locale === 'fr' ? 'En ligne' : locale === 'es' ? 'En vivo' : 'Live');
  const comingSoonLabel =
    content.comingSoonLabel ?? (locale === 'fr' ? 'À venir' : locale === 'es' ? 'Próximamente' : 'Coming soon');
  const member = content.member;
  const refunds = content.refunds;
  const faq = content.faq;
  const supplementalFaq = Array.isArray(content.supplementalFaq)
    ? content.supplementalFaq.filter(
        (item): item is { question: string; answer: string } =>
          Boolean(item?.question) && Boolean(item?.answer)
      )
    : [];
  const faqEntries = [...(faq.entries ?? []), ...supplementalFaq].slice(0, 10);
  const heroLink = content.hero.link ?? null;
  const compareBlogHref = localizePathFromEnglish(locale, '/blog/compare-ai-video-engines');
  const canonical = buildMetadataUrls(locale as AppLocale, PRICING_SLUG_MAP, { englishPath: '/pricing' }).canonical;
  const breadcrumbLabels = getBreadcrumbLabels(locale as AppLocale);
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const homeUrl = `${SITE_BASE_URL}${localePrefix || ''}`;
  const exploreTitle =
    locale === 'fr' ? 'Pages liées' : locale === 'es' ? 'Páginas relacionadas' : 'Related pages';
  const exploreModelsLabel =
    locale === 'fr' ? 'Profil Seedance 2.0 Fast' : locale === 'es' ? 'Perfil Seedance 2.0 Fast' : 'Seedance 2.0 Fast profile';
  const exploreEnginesLabel =
    locale === 'fr' ? 'Seedance 2.0 vs Veo 3.1' : locale === 'es' ? 'Seedance 2.0 vs Veo 3.1' : 'Seedance 2.0 vs Veo 3.1';
  const exploreSeedanceModelLabel =
    locale === 'fr' ? 'Profil Seedance 2.0' : locale === 'es' ? 'Perfil Seedance 2.0' : 'Seedance 2.0 profile';
  const exploreVeoModelLabel =
    locale === 'fr' ? 'Profil Veo 3.1' : locale === 'es' ? 'Perfil Veo 3.1' : 'Veo 3.1 profile';
  const exploreLinks: PricingRelatedLink[] = [
    { href: { pathname: '/models/[slug]', params: { slug: 'seedance-2-0-fast' } }, label: exploreModelsLabel },
    {
      href: { pathname: '/ai-video-engines/[slug]', params: { slug: 'seedance-2-0-vs-veo-3-1' } },
      label: exploreEnginesLabel,
    },
    { href: { pathname: '/models/[slug]', params: { slug: 'seedance-2-0' } }, label: exploreSeedanceModelLabel },
    { href: { pathname: '/models/[slug]', params: { slug: 'veo-3-1' } }, label: exploreVeoModelLabel },
  ];
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: breadcrumbLabels.home,
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: breadcrumbLabels.pricing,
        item: canonical,
      },
    ],
  };
  const pricingRules = await listPricingRules();
  const pricingRulesLite: PricingRuleLite[] = pricingRules.map((rule) => ({
    id: rule.id,
    engineId: rule.engineId ?? null,
    resolution: rule.resolution ?? null,
    marginPercent: rule.marginPercent,
    marginFlatCents: rule.marginFlatCents,
    currency: rule.currency ?? 'USD',
  }));
  const enginePricingOverrides = await listEnginePricingOverrides();
  const engineIndex = new Map(
    listFalEngines().map((entry) => {
      const override = enginePricingOverrides[entry.engine.id];
      const engine = override ? applyEnginePricingOverride(entry.engine, override) : entry.engine;
      return [engine.id, engine];
    })
  );
  const resolveScenarioQuote = async (scenario: PricingScenario) => {
    const input = scenarioToPricingInput(scenario);
    const engineCaps = engineIndex.get(input.engineId);
    if (!engineCaps) return null;
    try {
      return await computePricingSnapshot({
        engine: engineCaps,
        durationSec: input.durationSec,
        resolution: input.resolution,
        aspectRatio: input.aspectRatio,
        membershipTier: input.memberTier,
        addons: input.addons,
      });
    } catch {
      return null;
    }
  };
  const starterSnapshot = await resolveScenarioQuote(DEFAULT_MARKETING_SCENARIO);
  const starterCurrency = starterSnapshot?.currency ?? 'USD';
  const refundFeatureItems = [
    { text: refunds.points[0], live: FEATURES.pricing.refundsAuto },
    { text: refunds.points[1], live: FEATURES.pricing.itemisedReceipts },
    { text: refunds.points[2], live: FEATURES.pricing.multiApproverTopups },
  ] as const;

  const pricingSchemaName =
    locale === 'fr' ? 'Tarifs MaxVideoAI' : locale === 'es' ? 'Precios de MaxVideoAI' : 'MaxVideoAI pricing';
  const pricingSchemaDescription =
    locale === 'fr'
      ? 'Estimez les coûts vidéo IA avec visibilité par clip, limites par modèle et workflows réutilisables.'
      : locale === 'es'
        ? 'Estima costes de video con IA con visibilidad por clip, límites por modelo y flujos reutilizables.'
        : 'Estimate AI video pricing with per-clip cost visibility, model-level limits, and reusable workflows.';
  const pricingServiceType =
    locale === 'fr'
      ? 'Tarification et estimation des coûts vidéo IA'
      : locale === 'es'
        ? 'Tarificación y estimación de costes de video con IA'
        : 'AI video pricing and cost estimation';
  const serviceSchema = buildMarketingServiceJsonLd({
    name: pricingSchemaName,
    description: pricingSchemaDescription,
    serviceType: pricingServiceType,
    category: locale === 'fr' ? 'Tarification' : locale === 'es' ? 'Precios' : 'Pricing',
    url: canonical,
    offers: {
      priceCurrency: starterCurrency,
      price: '10.00',
      availability: 'https://schema.org/InStock',
      url: canonical,
    },
  });

  type TierCopy = {
    name?: string;
    requirement?: string;
    requirementThreshold?: string;
    benefit?: string;
    benefitDiscount?: string;
  };
  const membershipTiers = await getMembershipTiers();
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: starterCurrency,
    maximumFractionDigits: 0,
  });
  const memberCopy = {
    requirementDefault:
      member.requirementDefault ??
      (locale === 'fr'
        ? 'Statut par défaut — appliqué automatiquement'
        : locale === 'es'
          ? 'Estado predefinido — se aplica automáticamente'
          : 'Default status — applies automatically'),
    requirementThreshold:
      member.requirementThreshold ??
      (locale === 'fr'
        ? 'Seuil défini par l’admin : {amount} (30 jours glissants)'
        : locale === 'es'
          ? 'Umbral definido por el admin: {amount} (últimos 30 días)'
          : 'Admin threshold: {amount} (rolling 30 days)'),
    benefitBase:
      member.benefitBase ??
      (locale === 'fr' ? 'Tarif de base' : locale === 'es' ? 'Tarifa base' : 'Baseline rate'),
    benefitDiscount:
      member.benefitDiscount ??
      (locale === 'fr'
        ? 'Économisez {percent}% sur chaque rendu'
        : locale === 'es'
          ? 'Ahorra {percent}% en cada render'
          : 'Save {percent}% on every render'),
  };
  const exampleCosts: ExampleCostsContent = (content.examples ?? DEFAULT_EXAMPLE_COSTS[locale]) as ExampleCostsContent;
  const exampleCards: ExampleCardConfig[] =
    Array.isArray(exampleCosts.cards) && exampleCosts.cards.length
      ? (exampleCosts.cards as ExampleCardConfig[])
      : DEFAULT_EXAMPLE_COSTS[locale].cards;
  const priceFactors: PriceFactorsContent = (content.priceFactors ?? DEFAULT_PRICE_FACTORS[locale]) as PriceFactorsContent;
  const generatorHref = '/app';

  const resolvedExampleCards: ExampleCardConfig[] = await Promise.all(
    exampleCards.map(async (card) => {
      if ((typeof card.price === 'string' && card.price.trim().length > 0) || !card.pricingScenario) {
        return card;
      }
      const snapshot = await resolveScenarioQuote(card.pricingScenario);
      if (!snapshot) {
        return card;
      }
      const priceLabel = formatCurrencyForLocale(
        locale as AppLocale,
        snapshot.currency ?? starterCurrency,
        snapshot.totalCents / 100
      );
      return {
        ...card,
        price: `≈ ${priceLabel}`,
      };
    })
  );

  const formattedTiers = membershipTiers.map((tier, index) => {
    const tierCopy = Array.isArray(member.tiers) ? ((member.tiers[index] ?? null) as TierCopy | null) : null;
    const name = tierCopy?.name ?? tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1);
    const requirement =
      tier.spendThresholdCents <= 0
        ? tierCopy?.requirement ?? memberCopy.requirementDefault
        : (tierCopy?.requirementThreshold ?? memberCopy.requirementThreshold).replace(
            '{amount}',
            currencyFormatter.format(tier.spendThresholdCents / 100)
          );
    const discountPct = tier.discountPercent * 100;
    const pctLabel = discountPct % 1 === 0 ? discountPct.toFixed(0) : discountPct.toFixed(1);
    const benefit =
      discountPct > 0
        ? (tierCopy?.benefitDiscount ?? memberCopy.benefitDiscount).replace('{percent}', pctLabel)
        : tierCopy?.benefit ?? memberCopy.benefitBase;
    return { name, requirement, benefit };
  });

  const faqJsonLdEntries = faqEntries.slice(0, 6);

  const heroTitleLines = (content.hero.title ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  const heroSubtitleLines = (content.hero.subtitle ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  const heroTitle = heroTitleLines[0] ?? content.hero.title;
  const heroTitleSeparatorIndex = heroTitle.indexOf(':');
  const heroHeadline = heroTitleSeparatorIndex >= 0 ? heroTitle.slice(0, heroTitleSeparatorIndex + 1) : heroTitle;
  const heroAccentLine = heroTitleSeparatorIndex >= 0 ? heroTitle.slice(heroTitleSeparatorIndex + 1).trim() : null;
  const heroEyebrow =
    locale === 'fr' ? 'Prix transparents' : locale === 'es' ? 'Precios transparentes' : 'Transparent pricing';
  const starterCreditLine =
    locale === 'fr'
      ? 'Commencez avec les Starter Credits (10 $).'
      : locale === 'es'
        ? 'Empieza con Starter Credits (10 $).'
        : 'Start with Starter Credits ($10).';
  const noSubscriptionLine =
    locale === 'fr'
      ? 'Pas d’abonnement. Pas d’engagement.'
      : locale === 'es'
        ? 'Sin suscripción. Sin permanencia.'
        : 'No subscription. No lock-in.';
  const heroBodyLines = heroSubtitleLines.length ? heroSubtitleLines : [starterCreditLine, noSubscriptionLine];
  const livePricingLine =
    locale === 'fr'
      ? 'Envie de voir les prix en temps réel avant génération ?'
      : locale === 'es'
        ? '¿Quieres ver precios en tiempo real antes de generar?'
        : 'Want to see real-time prices before you generate?';
  const openGeneratorLabel =
    content.calculator?.cta ??
    (locale === 'fr' ? 'Ouvrir le studio' : locale === 'es' ? 'Abrir workspace' : 'Open workspace');
  const previewTitle = content.calculator?.title ?? 'Preview prices in the app';
  const previewDescription =
    content.calculator?.description ??
    (locale === 'fr'
      ? 'Ouvrez le générateur pour voir le prix exact avant de lancer une vidéo.'
      : locale === 'es'
        ? 'Abre el workspace para ver el precio exacto antes de crear el video.'
        : 'Open the workspace to see the exact price before you create a video.');
  return (
    <main className="bg-bg">
      <PricingHeroSection
        compareBlogHref={compareBlogHref}
        heroAccentLine={heroAccentLine}
        heroBodyLines={heroBodyLines}
        heroEyebrow={heroEyebrow}
        heroHeadline={heroHeadline}
        heroLink={heroLink}
      />

      <div className="container-page relative z-10 -mt-14 max-w-[1220px] pb-14">
        <div className="stack-gap-lg">
          <PricingEstimatorSection
            comingSoonLabel={comingSoonLabel}
            enginePricingOverrides={enginePricingOverrides}
            generatorHref={generatorHref}
            liveLabel={liveLabel}
            livePricingLine={livePricingLine}
            openGeneratorLabel={openGeneratorLabel}
            pricingRules={pricingRulesLite}
          />
          <PricingExampleCostsSection
            cards={resolvedExampleCards}
            exampleCosts={exampleCosts}
            locale={locale}
          />
          <PricingMemberTiersSection
            comingSoonLabel={comingSoonLabel}
            liveLabel={liveLabel}
            member={member}
            tiers={formattedTiers}
          />
          <PricingRelatedLinksSection links={exploreLinks} title={exploreTitle} />
          <PricingPreviewSection
            description={previewDescription}
            generatorHref={generatorHref}
            openGeneratorLabel={openGeneratorLabel}
            title={previewTitle}
          />
          <PricingPriceFactorsSection locale={locale} priceFactors={priceFactors} />
          <PricingRefundsFaqSection
            comingSoonLabel={comingSoonLabel}
            faq={faq}
            faqEntries={faqEntries}
            liveLabel={liveLabel}
            refundFeatureItems={refundFeatureItems}
            refunds={refunds}
          />
        </div>
      </div>

      <PricingJsonLdScripts breadcrumbJsonLd={breadcrumbJsonLd} serviceSchema={serviceSchema} />
      <FAQSchema questions={faqJsonLdEntries} />
    </main>
  );
}
