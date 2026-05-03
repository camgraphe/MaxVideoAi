import type { Metadata } from 'next';
import {
  BarChart3,
  Calculator,
  CheckCircle2,
  Clock3,
  Crown,
  Film,
  ImageIcon,
  Mic2,
  Monitor,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { DEFAULT_MARKETING_SCENARIO, scenarioToPricingInput, type PricingScenario } from '@/lib/pricing-scenarios';
import { FEATURES } from '@/content/feature-flags';
import { FlagPill } from '@/components/FlagPill';
import { getMembershipTiers } from '@/lib/membership';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { localePathnames, localeRegions, type AppLocale } from '@/i18n/locales';
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
import { TextLink } from '@/components/ui/TextLink';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { LazyPriceEstimator } from '@/components/marketing/LazyPriceEstimator';

const PRICING_SLUG_MAP = buildSlugMap('pricing');

export const revalidate = 600;

type ExampleCardConfig = {
  title: string;
  engine: string;
  duration: string;
  resolution: string;
  audio: string;
  price?: string;
  note?: string;
  pricingScenario?: PricingScenario;
};

type ExampleCostsContent = {
  title: string;
  subtitle: string;
  labels: {
    engine: string;
    duration: string;
    resolution: string;
    audio: string;
  };
  cards: ExampleCardConfig[];
};

function formatCurrencyForLocale(locale: AppLocale, currency: string, amount: number) {
  const region = localeRegions[locale] ?? 'en-US';
  return new Intl.NumberFormat(region, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const DEFAULT_EXAMPLE_COSTS: Record<AppLocale, ExampleCostsContent> = {
  en: {
    title: 'Example costs',
    subtitle: 'Realistic runs to help you plan. Prices update as engines evolve.',
    labels: { engine: 'Engine', duration: 'Duration', resolution: 'Resolution', audio: 'Audio' },
    cards: [
      {
        title: 'Social clip (vertical)',
        engine: 'Pika 2.2',
        duration: '5s',
        resolution: '1080×1920',
        audio: 'Off',
        note: 'Charged only if it succeeds.',
        pricingScenario: { engineId: 'pika-text-to-video', durationSec: 5, resolution: '1080p', memberTier: 'member' },
      },
      {
        title: 'Cinematic test (landscape)',
        engine: 'Veo 3.1',
        duration: '8s',
        resolution: '1920×1080',
        audio: 'On',
        note: 'Price before you generate.',
        pricingScenario: { engineId: 'veo-3-1', durationSec: 8, resolution: '1080p', memberTier: 'member' },
      },
      {
        title: 'Flagship Seedance 2.0 run',
        engine: 'Seedance 2.0',
        duration: '10s',
        resolution: '1280×720',
        audio: 'On',
        note: 'Seedance 2 uses token-based provider pricing. This example assumes 1280×720 at 24 fps, adds the MaxVideoAI margin, then rounds up to the next cent.',
        pricingScenario: {
          engineId: 'seedance-2-0',
          durationSec: 10,
          resolution: '720p',
          aspectRatio: '16:9',
          memberTier: 'member',
        },
      },
    ],
  },
  fr: {
    title: 'Exemples de coûts',
    subtitle: 'Runs réalistes pour planifier. Les prix évoluent avec les moteurs.',
    labels: { engine: 'Moteur', duration: 'Durée', resolution: 'Résolution', audio: 'Audio' },
    cards: [
      {
        title: 'Clip social (vertical)',
        engine: 'Pika 2.2',
        duration: '5 s',
        resolution: '1080×1920',
        audio: 'Silencieux',
        note: 'Débité uniquement si le rendu aboutit.',
        pricingScenario: { engineId: 'pika-text-to-video', durationSec: 5, resolution: '1080p', memberTier: 'member' },
      },
      {
        title: 'Test cinématographique (paysage)',
        engine: 'Veo 3.1',
        duration: '8 s',
        resolution: '1920×1080',
        audio: 'Inclus',
        note: 'Prix affiché avant génération.',
        pricingScenario: { engineId: 'veo-3-1', durationSec: 8, resolution: '1080p', memberTier: 'member' },
      },
      {
        title: 'Séquence premium Seedance 2.0',
        engine: 'Seedance 2.0',
        duration: '10 s',
        resolution: '1280×720',
        audio: 'Inclus',
        note: 'Seedance 2 suit une formule provider basée sur les tokens. Cet exemple part de 1280×720 à 24 fps, ajoute la marge MaxVideoAI, puis arrondit au centime supérieur.',
        pricingScenario: {
          engineId: 'seedance-2-0',
          durationSec: 10,
          resolution: '720p',
          aspectRatio: '16:9',
          memberTier: 'member',
        },
      },
    ],
  },
  es: {
    title: 'Costos de ejemplo',
    subtitle: 'Ejecuciones realistas para planificar. Los precios cambian cuando evolucionan los motores.',
    labels: { engine: 'Motor', duration: 'Duración', resolution: 'Resolución', audio: 'Audio' },
    cards: [
      {
        title: 'Clip social (vertical)',
        engine: 'Pika 2.2',
        duration: '5 s',
        resolution: '1080×1920',
        audio: 'Silencioso',
        note: 'Se cobra solo si termina correctamente.',
        pricingScenario: { engineId: 'pika-text-to-video', durationSec: 5, resolution: '1080p', memberTier: 'member' },
      },
      {
        title: 'Test cinematográfico (horizontal)',
        engine: 'Veo 3.1',
        duration: '8 s',
        resolution: '1920×1080',
        audio: 'Incluido',
        note: 'Precio visible antes de generar.',
        pricingScenario: { engineId: 'veo-3-1', durationSec: 8, resolution: '1080p', memberTier: 'member' },
      },
      {
        title: 'Secuencia premium Seedance 2.0',
        engine: 'Seedance 2.0',
        duration: '10 s',
        resolution: '1280×720',
        audio: 'Incluido',
        note: 'Seedance 2 usa una fórmula de proveedor basada en tokens. Este ejemplo parte de 1280×720 a 24 fps, añade el margen de MaxVideoAI y redondea al céntimo superior.',
        pricingScenario: {
          engineId: 'seedance-2-0',
          durationSec: 10,
          resolution: '720p',
          aspectRatio: '16:9',
          memberTier: 'member',
        },
      },
    ],
  },
};

const DEFAULT_PRICE_FACTORS: Record<AppLocale, { title: string; points: string[] }> = {
  en: {
    title: 'What affects price',
    points: [
      'Duration scales linearly (4s / 8s / 12s).',
      'On token-priced routes like Seedance 2, both resolution and aspect ratio change the pixel count and the cost.',
      'Audio can add a premium on some engines; others, like Seedance 2, price audio on/off the same.',
      'Engine tier (Seedance / Veo / Kling / LTX) sets the base rate.',
      'Generate still shows the final quote before submission.',
    ],
  },
  fr: {
    title: 'Ce qui influence le prix',
    points: [
      'La durée évolue linéairement (4 s / 8 s / 12 s).',
      'Sur les routes à tokens comme Seedance 2, la résolution et le ratio changent le nombre de pixels et donc le coût.',
      'L’audio peut ajouter une prime sur certains moteurs ; d’autres, comme Seedance 2, gardent le même prix avec ou sans audio.',
      'Le niveau du moteur (Seedance / Veo / Kling / LTX) fixe le tarif de base.',
      'Generate affiche quand même le devis final avant validation.',
    ],
  },
  es: {
    title: 'Qué afecta el precio',
    points: [
      'La duración escala de forma lineal (4 s / 8 s / 12 s).',
      'En rutas con tokens como Seedance 2, la resolución y el ratio cambian el número de píxeles y por tanto el costo.',
      'El audio puede añadir un recargo en algunos motores; otros, como Seedance 2, mantienen el mismo precio con o sin audio.',
      'El nivel del motor (Seedance / Veo / Kling / LTX) define la tarifa base.',
      'Generate sigue mostrando el precio final antes de enviar.',
    ],
  },
};

const serializeJsonLd = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');

const EXAMPLE_CARD_VISUALS: Array<{ Icon: LucideIcon; accentClass: string; chartClass: string }> = [
  { Icon: Film, accentClass: 'bg-surface-3 text-text-secondary', chartClass: 'text-text-muted' },
  { Icon: ImageIcon, accentClass: 'bg-state-success/10 text-state-success', chartClass: 'text-state-success' },
  { Icon: Mic2, accentClass: 'bg-state-warning/10 text-state-warning', chartClass: 'text-state-warning' },
];

const MEMBER_TIER_VISUALS: Array<{ Icon: LucideIcon; accentClass: string }> = [
  { Icon: UserRound, accentClass: 'bg-surface-3 text-text-secondary' },
  { Icon: Sparkles, accentClass: 'bg-surface-3 text-text-secondary' },
  { Icon: Crown, accentClass: 'bg-state-warning/10 text-state-warning' },
];

const PRICE_FACTOR_ICONS: LucideIcon[] = [Clock3, Monitor, ImageIcon, Mic2, Sparkles];

function MiniSparkline({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 122 42" className={`h-12 w-32 ${className}`}>
      <path
        d="M3 34 C16 22 24 20 34 26 C45 33 48 13 60 15 C72 17 74 25 85 18 C98 9 104 11 119 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
    </svg>
  );
}

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
  const exploreLinks = [
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
  const exampleCosts = content.examples ?? DEFAULT_EXAMPLE_COSTS[locale];
  const exampleCards: ExampleCardConfig[] =
    Array.isArray(exampleCosts.cards) && exampleCosts.cards.length
      ? (exampleCosts.cards as ExampleCardConfig[])
      : DEFAULT_EXAMPLE_COSTS[locale].cards;
  const priceFactors = content.priceFactors ?? DEFAULT_PRICE_FACTORS[locale];
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
    (locale === 'fr' ? 'Ouvrir le workspace' : locale === 'es' ? 'Abrir workspace' : 'Open workspace');
  const previewTitle = content.calculator?.title ?? 'Preview prices in the app';
  const previewDescription =
    content.calculator?.description ??
    (locale === 'fr'
      ? 'Ouvrez le générateur pour voir le prix exact avant de lancer une vidéo.'
      : locale === 'es'
        ? 'Abre el workspace para ver el precio exacto antes de crear el video.'
        : 'Open the workspace to see the exact price before you create a video.');
  const refundFeatureIcons: LucideIcon[] = [ShieldCheck, WalletCards, CheckCircle2];
  const isNoSubscriptionCopy = (line: string) => {
    const normalized = line.toLowerCase();
    return (
      normalized.includes('no subscription') ||
      normalized.includes('lock-in') ||
      normalized.includes('abonnement') ||
      normalized.includes('engagement') ||
      normalized.includes('suscripción') ||
      normalized.includes('permanencia')
    );
  };

  return (
    <main className="bg-bg">
      <header className="relative min-h-[520px] overflow-hidden border-b border-hairline bg-bg">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[url('/assets/pricing/pricing-hero-reference.webp')] bg-cover bg-center opacity-55 dark:bg-[url('/assets/pricing/pricing-hero-reference-dark.webp')] dark:opacity-70"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.93)_0%,rgba(255,255,255,0.76)_34%,rgba(247,249,253,0.36)_68%,rgba(247,249,253,0.08)_100%)] dark:bg-[radial-gradient(circle_at_50%_38%,rgba(3,7,18,0.24)_0%,rgba(3,7,18,0.16)_42%,rgba(3,7,18,0.05)_76%,rgba(3,7,18,0.00)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-bg to-transparent" />
        <div className="container-page relative flex min-h-[520px] max-w-[1220px] items-center justify-center pb-24 pt-14 text-center">
          <div className="mx-auto flex max-w-[760px] flex-col items-center gap-4">
            <span className="inline-flex items-center rounded-pill border border-hairline bg-white/72 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#356BE8] shadow-sm backdrop-blur dark:bg-white/10">
              {heroEyebrow}
            </span>
            <h1 className="text-4xl font-semibold leading-[1.04] tracking-tight text-text-primary sm:text-6xl">
              {heroHeadline}
              {heroAccentLine ? (
                <>
                  <br />
                  <span className="text-text-secondary">{heroAccentLine}</span>
                </>
              ) : null}
            </h1>
            <div className="flex flex-col items-center gap-3 text-base leading-7 text-text-secondary">
              {heroBodyLines.map((line) =>
                isNoSubscriptionCopy(line) ? (
                  <p
                    key={line}
                    className="rounded-[14px] border border-hairline bg-white/76 px-5 py-3 text-lg font-semibold tracking-tight text-text-primary shadow-card backdrop-blur sm:text-xl dark:bg-white/10"
                  >
                    {line}
                  </p>
                ) : (
                  <p key={line}>{line}</p>
                )
              )}
            </div>
            {heroLink ? (
              <p className="text-sm leading-6 text-text-secondary">
                {heroLink.before}
                <Link
                  href={compareBlogHref}
                  className="font-semibold text-text-primary underline decoration-text-muted/30 underline-offset-4 hover:decoration-text-primary"
                >
                  {heroLink.label ?? 'AI video comparison'}
                </Link>
                {heroLink.after}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="container-page relative z-10 -mt-14 max-w-[1220px] pb-14">
        <div className="stack-gap-lg">
        <section id="estimator" className="scroll-mt-28">
          <div className="mx-auto max-w-5xl">
            <LazyPriceEstimator
              pricingRules={pricingRulesLite}
              enginePricingOverrides={enginePricingOverrides}
              defaultEngineId="veo-3-1-lite"
              defaultDurationSec={4}
            />
          </div>
          <div className="mx-auto mt-5 flex max-w-3xl flex-col items-center gap-2 rounded-[18px] border border-hairline bg-surface px-4 py-3 text-center text-xs text-text-muted shadow-card sm:flex-row sm:justify-center">
            <FlagPill live={FEATURES.pricing.publicCalculator} liveLabel={liveLabel} soonLabel={comingSoonLabel} />
            <span>
              {livePricingLine}{' '}
              <Link href={generatorHref} prefetch={false} className="font-semibold text-text-primary underline decoration-text-muted/30 underline-offset-4 hover:decoration-text-primary">
                {openGeneratorLabel}
              </Link>
            </span>
          </div>
        </section>

        <section aria-labelledby="example-costs" className="scroll-mt-28">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 id="example-costs" className="text-2xl font-semibold text-text-primary">
                {exampleCosts.title ?? DEFAULT_EXAMPLE_COSTS[locale].title}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {exampleCosts.subtitle ?? DEFAULT_EXAMPLE_COSTS[locale].subtitle}
              </p>
            </div>
            <div className="hidden h-px w-28 bg-hairline sm:block" aria-hidden />
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {resolvedExampleCards.map((card, index) => {
              const visual = EXAMPLE_CARD_VISUALS[index % EXAMPLE_CARD_VISUALS.length];
              const Icon = visual.Icon;
              return (
                <article
                  key={card.title}
                  className={`rounded-[8px] border bg-white p-5 shadow-[0_18px_54px_rgba(33,49,78,0.06)] transition hover:-translate-y-1 hover:shadow-float dark:bg-white/[0.055] ${
                    index === 1 ? 'border-[#356BE8]/70' : 'border-hairline'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-[8px] border border-hairline ${visual.accentClass}`}>
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-text-primary">{card.title}</h3>
                        <p className="mt-1 text-xs text-text-muted">
                          {card.duration} · {card.resolution} · {card.audio}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-semibold tracking-tight text-text-primary">{card.price ?? '—'}</p>
                      <p className="mt-2 inline-flex rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-text-secondary">
                        {card.engine}
                      </p>
                    </div>
                    <MiniSparkline className={visual.chartClass} />
                  </div>
                  {card.note ? (
                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-text-muted">{card.note}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-[8px] border border-hairline bg-white p-5 shadow-[0_18px_54px_rgba(33,49,78,0.06)] dark:bg-white/[0.055] sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-3 text-2xl font-semibold text-text-primary">
                {member.title}
                <FlagPill
                  live={FEATURES.pricing.memberTiers}
                  liveLabel={liveLabel}
                  soonLabel={comingSoonLabel}
                />
              </h2>
              <p className="mt-1 text-sm text-text-secondary">{member.subtitle}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {formattedTiers.map((tier, index) => {
              const visual = MEMBER_TIER_VISUALS[index % MEMBER_TIER_VISUALS.length];
              const Icon = visual.Icon;
              return (
                <article key={tier.name} className="rounded-[8px] border border-hairline bg-bg p-5">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-[8px] border border-hairline ${visual.accentClass}`}>
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-text-primary">{tier.name}</h3>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    {tier.requirement}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">{tier.benefit}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-card border border-hairline bg-surface p-4 text-sm text-text-secondary shadow-card">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">{exploreTitle}</span>
            <div className="flex flex-wrap gap-2">
              {exploreLinks.map((link) => {
                const key = `${link.label}-${typeof link.href === 'string' ? link.href : link.href.pathname}`;
                return (
                  <Link
                    key={key}
                    href={link.href}
                    className="inline-flex min-h-8 items-center rounded-full border border-hairline bg-bg px-3 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid items-center gap-6 rounded-card border border-hairline bg-surface p-5 text-sm text-text-secondary shadow-card sm:p-6 lg:grid-cols-[1fr_300px]">
          <div className="flex gap-4">
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-[18px] border border-hairline bg-surface-3 text-text-secondary">
              <Calculator className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-text-primary">{previewTitle}</h2>
              <p className="mt-2 max-w-2xl leading-6">{previewDescription}</p>
              <TextLink href={generatorHref} prefetch={false} className="mt-3 gap-1 text-sm text-text-primary" linkComponent={Link}>
                {openGeneratorLabel}
              </TextLink>
            </div>
          </div>
          <div aria-hidden className="relative hidden h-28 items-center justify-end lg:flex">
            <div className="relative w-48 overflow-hidden rounded-[18px] border border-hairline bg-bg p-4 shadow-card">
              <p className="text-[10px] font-semibold text-text-muted">Price before you generate</p>
              <p className="mt-1 text-xl font-semibold text-text-primary">$4.16</p>
              <span className="mt-3 inline-flex rounded-full bg-text-primary px-4 py-2 text-xs font-semibold text-bg">
                Generate
              </span>
            </div>
          </div>
        </section>

        {priceFactors.points?.length ? (
          <section aria-labelledby="price-factors" className="scroll-mt-28">
            <h2 id="price-factors" className="text-2xl font-semibold text-text-primary">
              {priceFactors.title ?? DEFAULT_PRICE_FACTORS[locale].title}
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-5">
              {priceFactors.points.map((point, index) => {
                const Icon = PRICE_FACTOR_ICONS[index % PRICE_FACTOR_ICONS.length];
                return (
                  <article key={point} className="rounded-[18px] border border-hairline bg-surface p-4 shadow-card">
                    <Icon className="h-5 w-5 text-text-secondary" strokeWidth={1.8} />
                    <p className="mt-3 text-xs leading-5 text-text-secondary">{point}</p>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <article
            id="refunds-protections"
            className="scroll-mt-28 rounded-card border border-hairline bg-surface p-6 shadow-card"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-hairline bg-surface-3 text-text-secondary">
                <ShieldCheck className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <h2 className="text-2xl font-semibold text-text-primary">{refunds.title}</h2>
            </div>
            <ul className="mt-5 grid gap-4 text-sm text-text-secondary">
              {refundFeatureItems.map((item, index) => {
                const Icon = refundFeatureIcons[index % refundFeatureIcons.length];
                return (
                  <li key={item.text} className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 flex-none text-text-secondary" strokeWidth={1.9} />
                    <span className="inline-flex flex-wrap items-center gap-2 leading-6">
                      {item.text}
                      <FlagPill live={item.live} liveLabel={liveLabel} soonLabel={comingSoonLabel} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
          <article className="rounded-card border border-hairline bg-surface p-6 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-hairline bg-surface-3 text-text-secondary">
                <BarChart3 className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <h2 className="text-2xl font-semibold text-text-primary">{faq.title}</h2>
            </div>
            <dl className="mt-5 grid gap-4">
              {faqEntries.slice(0, 4).map((entry) => (
                <div key={entry.question}>
                  <dt className="text-sm font-semibold text-text-primary">{entry.question}</dt>
                  <dd className="mt-1 text-sm leading-6 text-text-secondary">{entry.answer}</dd>
                </div>
              ))}
            </dl>
          </article>
        </section>
        </div>
      </div>

      <script
        id="pricing-breadcrumb-jsonld"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <script
        id="pricing-service-jsonld"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceSchema) }}
      />
      <FAQSchema questions={faqJsonLdEntries} />
    </main>
  );
}
