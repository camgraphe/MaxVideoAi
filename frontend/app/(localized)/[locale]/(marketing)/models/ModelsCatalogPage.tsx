import type { Metadata } from 'next';
import Image from 'next/image';
import Script from 'next/script';
import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';
import { ArrowRight, ChevronRight, Sparkles, Timer } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { ModelsGallery } from '@/components/marketing/ModelsGallery';
import { getEnginePictogram } from '@/lib/engine-branding';
import { isImageOnlyModel, isModelInScope } from '@/lib/models/catalog';
import { getEngineLocalized } from '@/lib/models/i18n';
import { computeMarketingPriceRange } from '@/lib/pricing-marketing';
import { getLocalizedCapabilityKeywords, getLocalizedModelUseCases } from '@/lib/ltx-localization';
import {
  DEFAULT_ENGINE_TYPE_LABELS,
  DEFAULT_CAPABILITY_KEYWORDS,
  DEFAULT_SCORE_LABEL_MAP,
  DEFAULT_VALUE_CAPABILITY_FALLBACK,
  DEFAULT_VALUE_CONJUNCTION,
  DEFAULT_VALUE_SENTENCE_BY_LOCALE,
  DEFAULT_VALUE_STRENGTHS_FALLBACK,
  MODELS_HERO_IMAGE_URL,
  MODELS_SCOPE_NAV_LABELS,
  MODELS_SLUG_MAP,
  MODEL_CARD_DESCRIPTION_OVERRIDES,
  SCORE_LABEL_KEYS,
  USE_CASE_MAP,
  buildValueSentence,
  clampDescription,
  computeOverall,
  deriveStrengths,
  extractMaxDuration,
  extractMaxResolution,
  formatProviderLabel,
  getCatalogBySlug,
  getEngineDisplayName,
  getEngineTypeKey,
  getMinPricePerSecond,
  getModelsScopeEnglishPath,
  getModelsScopePath,
  getPrelaunchPricingLabel,
  getPrelaunchPricingNote,
  getScopeDefaults,
  loadEngineKeySpecs,
  loadEngineScores,
  resolveSupported,
  sanitizeDescription,
  splitHeroAccentTitle,
  splitModelsHeroTitle,
  stripProvider,
  type EngineScore,
  type ModelsPageScope,
} from './_lib/models-catalog-utils';
import {
  buildModelsFaqItems,
  buildModelsOutcomeTiles,
  buildModelsReliabilityItems,
} from './_lib/models-catalog-sections';

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
  const scopeLabels = MODELS_SCOPE_NAV_LABELS[activeLocale];
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
  const galleryCopy = (content.gallery ?? {}) as unknown as {
    scoreLabels?: Record<keyof EngineScore, string>;
    valueSentence?: {
      template?: string;
      strengthsFallback?: string;
      capabilityFallback?: string;
      conjunction?: string;
      useCases?: Record<string, string>;
      capabilityKeywords?: Record<string, string>;
    };
    stats?: {
      typeShort?: string;
    };
  };
  const listingCopy = (content.listing ?? {}) as {
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
    quickCompare?: {
      title?: string;
      subtitle?: string;
      shortcuts?: string[];
    };
    chooseOutcome?: {
      title?: string;
      subtitle?: string;
      tiles?: { title?: string; description?: string }[];
    };
    reliability?: {
      title?: string;
      subtitle?: string;
      items?: { title?: string; body?: string }[];
      faq?: { question?: string; answer?: string }[];
    };
    cta?: {
      title?: string;
      subtitle?: string;
      pills?: string[];
      microcopy?: string;
      primaryLabel?: string;
      secondaryLabel?: string;
    };
  };
  const heroTitle =
    scope === 'all'
      ? listingCopy.hero?.title ?? content.hero?.title ?? scopeDefaults.heroTitle
      : scopeDefaults.heroTitle;
  const heroSubhead =
    scope === 'all'
      ? listingCopy.hero?.subtitle ?? content.hero?.subtitle ?? scopeDefaults.heroSubhead
      : scopeDefaults.heroSubhead;
  const cardCtaLabel = content.cardCtaLabel ?? 'Explore model';
  const engineTypeLabels = {
    ...DEFAULT_ENGINE_TYPE_LABELS,
    ...(content.engineTypeLabels ?? {}),
  };
  const engineMetaCopy = (content.meta ?? {}) as Record<
    string,
    {
      displayName?: string;
      description?: string;
      priceBefore?: string;
      versionLabel?: string;
    }
  >;
  const keySpecsMap = await loadEngineKeySpecs();
  const scoresMap = await loadEngineScores();
  const catalogBySlug = getCatalogBySlug();

  const priorityOrder = [
    'seedance-2-0',
    'seedance-2-0-fast',
    'kling-3-pro',
    'kling-3-standard',
    'kling-3-4k',
    'veo-3-1',
    'veo-3-1-fast',
    'ltx-2-3-pro',
    'ltx-2-3-fast',
    'sora-2',
    'sora-2-pro',
    'seedance-1-5-pro',
    'veo-3-1-lite',
    'luma-ray-2',
    'luma-ray-2-flash',
    'pika-text-to-video',
    'wan-2-6',
    'wan-2-5',
    'kling-2-6-pro',
    'kling-2-5-turbo',
    'ltx-2-fast',
    'ltx-2',
    'minimax-hailuo-02-text',
    'gpt-image-2',
    'nano-banana-2',
    'nano-banana-pro',
    'nano-banana',
  ];

  const engineIndex = new Map<string, FalEngineEntry>(listFalEngines().map((entry) => [entry.modelSlug, entry]));
  const priorityEngines = priorityOrder
    .map((slug) => engineIndex.get(slug))
    .filter((entry): entry is FalEngineEntry => Boolean(entry));
  const remainingEngines = listFalEngines()
    .filter((entry) => !priorityOrder.includes(entry.modelSlug))
    .sort((a, b) => getEngineDisplayName(a).localeCompare(getEngineDisplayName(b)));
  const publishedModelEntries = [...priorityEngines, ...remainingEngines].filter(
    (entry) => entry.surfaces.modelPage.indexable || entry.surfaces.modelPage.includeInSitemap
  );
  const engines = publishedModelEntries.filter((entry) => isModelInScope(entry, scope));

  const localizedMap = new Map<string, Awaited<ReturnType<typeof getEngineLocalized>>>(
    await Promise.all(
      engines.map(async (engine) => {
        const localized = await getEngineLocalized(engine.modelSlug, activeLocale);
        return [engine.modelSlug, localized] as const;
      })
    )
  );
  const pricingRangeMap = new Map(
    await Promise.all(
      engines.map(async (engine) => {
        const range = await computeMarketingPriceRange(engine.engine, { durationSec: 5, memberTier: 'member' });
        return [engine.modelSlug, range] as const;
      })
    )
  );

  const scoreLabelMap = { ...DEFAULT_SCORE_LABEL_MAP, ...(galleryCopy.scoreLabels ?? {}) };
  const scoreLabels = SCORE_LABEL_KEYS.map((key) => ({
    key,
    label: scoreLabelMap[key] ?? DEFAULT_SCORE_LABEL_MAP[key],
  }));
  const valueTemplate = galleryCopy.valueSentence?.template ?? DEFAULT_VALUE_SENTENCE_BY_LOCALE[activeLocale];
  const strengthsFallback =
    galleryCopy.valueSentence?.strengthsFallback ?? DEFAULT_VALUE_STRENGTHS_FALLBACK[activeLocale];
  const capabilityFallback =
    galleryCopy.valueSentence?.capabilityFallback ?? DEFAULT_VALUE_CAPABILITY_FALLBACK[activeLocale];
  const conjunction = galleryCopy.valueSentence?.conjunction ?? DEFAULT_VALUE_CONJUNCTION[activeLocale];
  const useCaseMap = { ...USE_CASE_MAP, ...getLocalizedModelUseCases(activeLocale), ...(galleryCopy.valueSentence?.useCases ?? {}) };
  const descriptionOverrides = MODEL_CARD_DESCRIPTION_OVERRIDES[activeLocale] ?? {};
  const capabilityMap = {
    ...DEFAULT_CAPABILITY_KEYWORDS,
    ...getLocalizedCapabilityKeywords(activeLocale),
    ...(galleryCopy.valueSentence?.capabilityKeywords ?? {}),
  };

  const modelCards = engines.map((engine) => {
    const meta = engineMetaCopy[engine.modelSlug] ?? engineMetaCopy[engine.id] ?? null;
    const localized = localizedMap.get(engine.modelSlug);
    const engineTypeKey = getEngineTypeKey(engine);
    const engineType = engineTypeLabels[engineTypeKey] ?? DEFAULT_ENGINE_TYPE_LABELS[engineTypeKey];
    const versionLabel = localized?.versionLabel ?? meta?.versionLabel ?? engine.versionLabel ?? '';
    const displayName =
      localized?.marketingName ?? meta?.displayName ?? engine.cardTitle ?? getEngineDisplayName(engine);
    const catalogEntry = catalogBySlug.get(engine.modelSlug) ?? null;
    const keySpecs = keySpecsMap.get(engine.modelSlug) ?? {};
    const scoreEntry =
      scoresMap.get(engine.modelSlug) ?? scoresMap.get(engine.engine.id) ?? scoresMap.get(engine.id) ?? null;
    const overallScore = computeOverall(scoreEntry);
    const strengths = deriveStrengths(scoreEntry, scoreLabels);
    const providerId = (engine.brandId ?? engine.engine.brandId ?? catalogEntry?.brandId ?? '').toString().toLowerCase();
    const providerLabel = formatProviderLabel(engine, catalogEntry);
    const engineName = stripProvider(displayName, providerLabel, providerId) || displayName;
    const normalizedVersion = versionLabel.replace(/^v\s*/i, '').trim();
    const hasVersion =
      normalizedVersion &&
      (engineName.toLowerCase().includes(normalizedVersion.toLowerCase()) ||
        engineName.toLowerCase().includes(versionLabel.toLowerCase()));
    const titleLabel = normalizedVersion && !hasVersion ? `${engineName} ${normalizedVersion}` : engineName;
    const modes = new Set(catalogEntry?.engine?.modes ?? engine.engine.modes ?? []);
    const isImageOnly = isImageOnlyModel(engine);
    const t2v = resolveSupported((keySpecs as Record<string, unknown>).textToVideo) ?? modes.has('t2v');
    const i2v = resolveSupported((keySpecs as Record<string, unknown>).imageToVideo) ?? modes.has('i2v');
    const v2v =
      resolveSupported((keySpecs as Record<string, unknown>).videoToVideo) ??
      (modes.has('v2v') || modes.has('reframe'));
    const firstLast =
      resolveSupported((keySpecs as Record<string, unknown>).firstLastFrame) ??
      Boolean(catalogEntry?.engine?.keyframes);
    const extend = Boolean(catalogEntry?.engine?.extend);
    const lipSync = resolveSupported((keySpecs as Record<string, unknown>).lipSync) ?? undefined;
    const audioSupported =
      resolveSupported((keySpecs as Record<string, unknown>).audioOutput) ??
      (catalogEntry?.engine?.audio == null ? null : Boolean(catalogEntry.engine.audio));
    const maxResolution = extractMaxResolution(
      (keySpecs as Record<string, string>).maxResolution,
      catalogEntry?.engine?.resolutions
    );
    const maxDuration = extractMaxDuration(
      (keySpecs as Record<string, string>).maxDuration,
      catalogEntry?.engine?.maxDurationSec ?? null
    );
    const pricingRange = pricingRangeMap.get(engine.modelSlug) ?? null;
    const priceFromCents = pricingRange?.min.cents ?? getMinPricePerSecond(catalogEntry);
    const isPrelaunchWaitlist = engine.availability === 'waitlist';
    const hasConfirmedPricing = !isPrelaunchWaitlist && typeof priceFromCents === 'number' && priceFromCents > 0;
    const showPrelaunchPricePlaceholder = isPrelaunchWaitlist;
    const priceFrom = hasConfirmedPricing
      ? isImageOnly
        ? `$${(priceFromCents / 100).toFixed(2)}`
        : `$${(priceFromCents / 100).toFixed(2)}/s`
      : showPrelaunchPricePlaceholder
        ? getPrelaunchPricingLabel(activeLocale)
        : 'Data pending';
    const capabilityKeywordsList = [
      t2v ? 'T2V' : null,
      i2v ? 'I2V' : null,
      v2v ? 'V2V' : null,
      lipSync ? 'Lip sync' : null,
      audioSupported ? 'Audio' : null,
      firstLast ? 'First/Last' : null,
      extend ? 'Extend' : null,
    ]
      .filter(Boolean) as string[];
    const capabilities = capabilityKeywordsList
      .filter((cap) => cap !== 'Lip sync' && cap !== 'Audio')
      .slice(0, 5) as string[];
    const compareDisabled = ['nano-banana', 'nano-banana-pro', 'nano-banana-2', 'gpt-image-2'].includes(engine.modelSlug);
    const bestForFallback = catalogEntry?.bestFor ? sanitizeDescription(catalogEntry.bestFor) : engineType;
    const generatedDescription =
      descriptionOverrides[engine.modelSlug] ??
      buildValueSentence({
        slug: engine.modelSlug,
        strengths,
        capabilities: capabilityKeywordsList,
        fallback: bestForFallback,
        template: valueTemplate,
        strengthsFallback,
        capabilityFallback,
        conjunction,
        useCaseMap,
        capabilityMap,
      });
    const microDescription = clampDescription(generatedDescription, 170);
    const pictogram = getEnginePictogram({
      id: engine.engine.id,
      brandId: engine.brandId ?? engine.engine.brandId,
      label: displayName,
    });

    return {
      id: engine.modelSlug,
      label: titleLabel,
      provider: providerLabel,
      engineId: engine.engine.id,
      brandId: engine.brandId ?? engine.engine.brandId ?? null,
      description: microDescription,
      versionLabel,
      overallScore,
      priceNote: showPrelaunchPricePlaceholder ? getPrelaunchPricingNote(activeLocale) : null,
      priceNoteHref: null,
      href: { pathname: '/models/[slug]', params: { slug: engine.modelSlug } },
      backgroundColor: pictogram.backgroundColor,
      textColor: pictogram.textColor,
      strengths,
      capabilities: capabilities.slice(0, 5),
      stats: {
        priceFrom: priceFrom === 'Data pending' ? '—' : priceFrom,
        maxDuration: isImageOnly ? 'Image' : maxDuration.label === 'Data pending' ? '—' : maxDuration.label,
        maxResolution: maxResolution.label === 'Data pending' ? '—' : maxResolution.label,
      },
      statsLabels: {
        duration: isImageOnly ? galleryCopy.stats?.typeShort ?? 'Type' : undefined,
      },
      audioAvailable: Boolean(audioSupported),
      compareDisabled,
      filterMeta: {
        t2v,
        i2v,
        v2v,
        firstLast,
        extend,
        lipSync,
        audio: Boolean(audioSupported),
        maxResolution: maxResolution.value,
        maxDuration: maxDuration.value,
        priceFrom: (() => {
          return hasConfirmedPricing ? priceFromCents / 100 : null;
        })(),
        legacy: Boolean(engine.isLegacy),
      },
    };
  });

  const heroBullets =
    scope === 'all'
      ? listingCopy.hero?.bullets ?? scopeDefaults.heroBullets
      : scopeDefaults.heroBullets;
  const heroTitleParts = splitModelsHeroTitle(heroTitle);
  const heroAccentParts = splitHeroAccentTitle(heroTitleParts.accent);

  const cardBySlug = new Map(modelCards.map((card) => [card.id, card]));
  const scopeTabs = (['all', 'video', 'image'] as const).map((value) => ({
    id: value,
    label: scopeLabels[value],
    href: value === 'all' ? '/models' : `/models/${value}`,
    active: scope === value,
  }));
  const showVideoCompare = scope === 'video';
  const quickCompareMicroLabels = listingCopy.quickCompare?.shortcuts ?? [];
  const quickCompareShortcuts = [
    { a: 'seedance-2-0', b: 'veo-3-1', micro: quickCompareMicroLabels[0] ?? 'native audio vs ad-ready polish' },
    { a: 'seedance-2-0', b: 'kling-3-pro', micro: quickCompareMicroLabels[1] ?? 'multi-shot realism vs scene control' },
    { a: 'seedance-2-0-fast', b: 'veo-3-1-fast', micro: quickCompareMicroLabels[3] ?? 'fast drafts vs fast audio polish' },
    { a: 'seedance-2-0', b: 'sora-2', micro: quickCompareMicroLabels[2] ?? 'audio-native workflows vs cinematic continuity' },
    { a: 'seedance-2-0-fast', b: 'ltx-2-3-fast', micro: quickCompareMicroLabels[4] ?? 'rapid storyboard passes' },
    { a: 'kling-3-pro', b: 'veo-3-1', micro: quickCompareMicroLabels[5] ?? 'scene control vs ad-ready audio' },
  ].filter((shortcut) => cardBySlug.has(shortcut.a) && cardBySlug.has(shortcut.b));

  const outcomeTiles = buildModelsOutcomeTiles({
    activeLocale,
    outcomeCopy: listingCopy.chooseOutcome?.tiles ?? [],
    scope,
  });
  const faqItems = buildModelsFaqItems({
    listingFaq: listingCopy.reliability?.faq,
    scope,
  });
  const reliabilityItems = buildModelsReliabilityItems({
    listingItems: listingCopy.reliability?.items,
    scope,
  });

  const ctaPills = scope === 'all' ? listingCopy.cta?.pills ?? scopeDefaults.ctaPills : scopeDefaults.ctaPills;
  const galleryVisibleFilters: Array<'sort' | 'mode' | 'format' | 'duration' | 'price' | 'age'> =
    scope === 'video' ? ['sort', 'mode', 'format', 'duration', 'price', 'age'] : ['sort', 'format', 'price', 'age'];

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
      <section className="relative isolate overflow-hidden border-b border-hairline bg-[linear-gradient(180deg,#fbfdff_0%,#f7faff_68%,#f3f6fb_100%)] dark:bg-[linear-gradient(180deg,#070b12_0%,#0b111c_68%,#0f1724_100%)]">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <Image
            src={MODELS_HERO_IMAGE_URL}
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-[0.82] mix-blend-multiply dark:opacity-[0.38] dark:mix-blend-screen dark:invert"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,250,252,0.96)_0%,rgba(248,250,252,0.82)_39%,rgba(248,250,252,0.32)_72%,rgba(248,250,252,0.12)_100%)] dark:bg-[linear-gradient(90deg,rgba(7,11,18,0.96)_0%,rgba(7,11,18,0.82)_42%,rgba(7,11,18,0.38)_74%,rgba(7,11,18,0.18)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent_0%,var(--bg)_100%)]" />
        </div>
        <div className="container-page relative z-10 max-w-[1248px] py-14 sm:py-16 lg:min-h-[520px] lg:py-20">
          <nav
            aria-label={activeLocale === 'fr' ? 'Vues du catalogue modèles' : activeLocale === 'es' ? 'Vistas del catálogo de modelos' : 'Model catalog views'}
            className="flex flex-wrap gap-2"
          >
            {scopeTabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`rounded-full border px-5 py-2.5 text-xs font-semibold uppercase tracking-micro shadow-sm transition ${
                  tab.active
                    ? 'border-text-primary bg-text-primary text-bg'
                    : 'border-hairline bg-surface/88 text-text-secondary backdrop-blur hover:border-text-muted hover:text-text-primary'
                }`}
                aria-current={tab.active ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <header className="mt-12 max-w-[710px] sm:mt-14">
            <h1 className="text-balance text-[42px] font-semibold leading-[1.04] tracking-normal text-text-primary sm:text-[56px] lg:text-[64px]">
              {heroTitleParts.lead}
              {heroTitleParts.accent ? (
                <>
                  <br />
                  <span>
                    {heroAccentParts.prefix}
                    {heroAccentParts.emphasis}
                  </span>
                </>
              ) : null}
            </h1>
            <p className="mt-6 max-w-[62ch] text-base font-medium leading-relaxed text-text-secondary sm:text-lg">
              {heroSubhead}
            </p>
            <ul className="mt-8 grid gap-5 text-sm text-text-secondary sm:grid-cols-2">
              {heroBullets.slice(0, 2).map((bullet, index) => (
                <li key={bullet} className="flex items-center gap-4">
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-hairline bg-surface/85 text-text-primary shadow-sm backdrop-blur">
                    <UIIcon icon={index === 0 ? Sparkles : Timer} size={18} />
                  </span>
                  <span className="font-semibold leading-relaxed">{bullet}</span>
                </li>
              ))}
            </ul>
          </header>
        </div>
      </section>

      <div className="container-page max-w-[1248px] py-10 sm:py-12">
        <div className="stack-gap-lg">

        <section id="models-grid" className="stack-gap-md scroll-mt-24">
          <h2 className="sr-only">
            {scope === 'all'
              ? listingCopy.grid?.srTitle ?? scopeDefaults.gridSrTitle
              : scopeDefaults.gridSrTitle}
          </h2>
          <ModelsGallery
            cards={modelCards}
            ctaLabel={cardCtaLabel}
            copy={content.gallery}
            visibleFilters={galleryVisibleFilters}
            allowCompare={scope === 'video'}
          />
        </section>
        <p className="mx-auto flex max-w-4xl items-start gap-3 px-4 text-sm font-medium leading-relaxed text-text-secondary sm:items-center">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-soft)] text-brand sm:mt-0">
            <UIIcon icon={Sparkles} size={15} />
          </span>
          <span>
            {scope === 'all'
              ? listingCopy.grid?.bridgeText ?? scopeDefaults.bridgeText
              : scopeDefaults.bridgeText}
          </span>
        </p>
        <div className="space-y-8 py-4 sm:py-8">
          {showVideoCompare && quickCompareShortcuts.length ? (
            <section className="content-visibility-auto rounded-[16px] border border-hairline bg-surface/90 p-6 shadow-card dark:bg-white/5 sm:p-8">
              <div>
                <h2 className="text-2xl font-semibold leading-tight text-text-primary sm:text-3xl">
                  {listingCopy.quickCompare?.title ?? 'Model checks by common scenarios'}
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  {listingCopy.quickCompare?.subtitle ??
                    'Open useful side-by-side checks when you need a decision view after reviewing model specs.'}
                </p>
              </div>
              <div className="mt-6 flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
                {quickCompareShortcuts.map((shortcut) => {
                  const leftCard = cardBySlug.get(shortcut.a);
                  const rightCard = cardBySlug.get(shortcut.b);
                  const leftLabel = leftCard?.label ?? shortcut.a;
                  const rightLabel = rightCard?.label ?? shortcut.b;
                  const leftColor = leftCard?.backgroundColor ?? 'var(--text-muted)';
                  const rightColor = rightCard?.backgroundColor ?? 'var(--text-muted)';
                  const sorted = [shortcut.a, shortcut.b].sort();
                  const compareSlug = `${sorted[0]}-vs-${sorted[1]}`;
                  const order = sorted[0] === shortcut.a ? undefined : shortcut.a;
                  const compareHref = order
                    ? { pathname: '/ai-video-engines/[slug]', params: { slug: compareSlug }, query: { order } }
                    : { pathname: '/ai-video-engines/[slug]', params: { slug: compareSlug } };
                  return (
                    <Link
                      key={`${shortcut.a}-${shortcut.b}`}
                      href={compareHref}
                      prefetch={false}
                      className="min-w-[220px] rounded-[12px] border border-hairline bg-bg/70 px-4 py-3 text-xs font-semibold text-text-primary shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand-border)]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: leftColor }} />
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rightColor }} />
                        </span>
                        <span className="truncate">
                          {leftLabel} vs {rightLabel}
                        </span>
                      </div>
                      <span className="mt-1 block text-[10px] font-medium text-text-muted">{shortcut.micro}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="content-visibility-auto rounded-[16px] border border-hairline bg-surface/90 p-6 shadow-card dark:bg-white/5 sm:p-8">
            <div>
              <h2 className="text-2xl font-semibold leading-tight text-text-primary sm:text-3xl">
                {scope === 'all'
                  ? listingCopy.chooseOutcome?.title ?? scopeDefaults.chooseOutcomeTitle
                  : scopeDefaults.chooseOutcomeTitle}
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                {scope === 'all'
                  ? listingCopy.chooseOutcome?.subtitle ?? scopeDefaults.chooseOutcomeSubtitle
                  : scopeDefaults.chooseOutcomeSubtitle}
              </p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {outcomeTiles.map((tile) => (
                <div
                  key={tile.title}
                  className="rounded-[12px] border border-hairline bg-bg/70 p-5 shadow-sm transition hover:border-[var(--brand-border)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--brand-border)] bg-[var(--brand-soft)] text-brand">
                      <UIIcon icon={tile.icon} size={18} />
                    </span>
                    <h3 className="text-sm font-semibold text-text-primary">{tile.title}</h3>
                  </div>
                  <p className="mt-4 min-h-[4rem] text-sm font-medium leading-relaxed text-text-secondary">{tile.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tile.engines.map((slug) => {
                      const card = cardBySlug.get(slug);
                      if (!card) return null;
                      const color = card.backgroundColor ?? 'var(--text-muted)';
                      return (
                        <Link
                          key={slug}
                          href={{ pathname: '/models/[slug]', params: { slug } }}
                          prefetch={false}
                          className="inline-flex items-center rounded-[6px] border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-text-primary shadow-sm transition hover:-translate-y-0.5 dark:text-white/90"
                          style={{
                            borderColor: `color-mix(in srgb, ${color} 22%, transparent)`,
                            backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                          }}
                        >
                          {card.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="content-visibility-auto rounded-[16px] border border-hairline bg-surface/90 p-6 shadow-card dark:bg-white/5 sm:p-8">
            <div>
              <h2 className="text-2xl font-semibold leading-tight text-text-primary sm:text-3xl">
                {scope === 'all'
                  ? listingCopy.reliability?.title ?? scopeDefaults.reliabilityTitle
                  : scopeDefaults.reliabilityTitle}
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                {scope === 'all'
                  ? listingCopy.reliability?.subtitle ?? scopeDefaults.reliabilitySubtitle
                  : scopeDefaults.reliabilitySubtitle}
              </p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {reliabilityItems.map((item) => (
                <div key={item.title} className="rounded-[12px] border border-hairline bg-bg/70 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[var(--brand-border)] bg-[var(--brand-soft)] text-brand">
                      <UIIcon icon={item.icon} size={16} />
                    </span>
                    <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 divide-y divide-hairline border-y border-hairline">
              {faqItems.map((item) => (
                <details key={item.question} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <h3 className="text-sm font-semibold text-text-primary">{item.question}</h3>
                    <ChevronRight className="h-4 w-4 shrink-0 text-text-muted transition group-open:rotate-90" aria-hidden />
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-secondary">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="content-visibility-auto relative overflow-hidden rounded-[16px] border border-[var(--brand-border)] bg-[linear-gradient(105deg,color-mix(in_srgb,var(--brand)_11%,var(--surface))_0%,var(--surface)_52%,color-mix(in_srgb,var(--brand)_24%,var(--surface))_100%)] p-6 shadow-card dark:border-white/10 dark:bg-[linear-gradient(105deg,color-mix(in_srgb,var(--brand)_15%,var(--surface))_0%,var(--surface)_55%,color-mix(in_srgb,var(--brand)_24%,var(--surface))_100%)] sm:p-8">
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] md:block" aria-hidden>
              <Image
                src={MODELS_HERO_IMAGE_URL}
                alt=""
                aria-hidden="true"
                fill
                sizes="(min-width: 768px) 460px, 100vw"
                className="object-cover object-center opacity-[0.56] mix-blend-multiply [mask-image:linear-gradient(90deg,transparent_0%,black_36%,black_100%)] dark:opacity-[0.38] dark:mix-blend-screen dark:invert"
              />
            </div>
            <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-xl">
                <h2 className="text-2xl font-semibold leading-tight text-text-primary sm:text-3xl">
                  {scope === 'all' ? listingCopy.cta?.title ?? scopeDefaults.ctaTitle : scopeDefaults.ctaTitle}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {scope === 'all'
                    ? listingCopy.cta?.subtitle ?? scopeDefaults.ctaSubtitle
                    : scopeDefaults.ctaSubtitle}
                </p>
                <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                  {ctaPills.map((pill) => (
                    <span
                      key={pill}
                      className="inline-flex items-center rounded-[8px] border border-hairline bg-surface/85 px-3 py-1.5"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:pb-1">
                <Link
                  href={scope === 'all' ? scopeDefaults.ctaPrimaryHref : scopeDefaults.ctaPrimaryHref}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-text-primary px-5 py-3 text-xs font-semibold text-bg shadow-[0_14px_28px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:opacity-90"
                  aria-label={scope === 'all'
                    ? listingCopy.cta?.primaryLabel ?? scopeDefaults.ctaPrimaryLabel
                    : scopeDefaults.ctaPrimaryLabel}
                >
                  {scope === 'all'
                    ? listingCopy.cta?.primaryLabel ?? scopeDefaults.ctaPrimaryLabel
                    : scopeDefaults.ctaPrimaryLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href={scope === 'all' ? scopeDefaults.ctaSecondaryHref : scopeDefaults.ctaSecondaryHref}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-hairline bg-surface/85 px-5 py-3 text-xs font-semibold text-text-primary shadow-sm transition hover:-translate-y-0.5 hover:border-text-primary/40"
                  aria-label={scope === 'all'
                    ? listingCopy.cta?.secondaryLabel ?? scopeDefaults.ctaSecondaryLabel
                    : scopeDefaults.ctaSecondaryLabel}
                >
                  {scope === 'all'
                    ? listingCopy.cta?.secondaryLabel ?? scopeDefaults.ctaSecondaryLabel
                    : scopeDefaults.ctaSecondaryLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </section>
          <section className="rounded-[16px] border border-hairline bg-surface/90 px-5 py-5 shadow-card sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-soft)] text-brand">
                <UIIcon icon={Sparkles} size={20} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {scopeDefaults.nextStepsTitle}
                </h2>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {scopeDefaults.nextStepLinks.map((item) => (
                    <Link key={item.label} href={item.href} className="inline-flex items-center gap-2 font-semibold text-brand hover:text-brandHover">
                      {item.label}
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      </div>
      <Script id="models-breadcrumb-jsonld" type="application/ld+json">
        {JSON.stringify(breadcrumbJsonLd)}
      </Script>
      <Script id="models-itemlist-jsonld" type="application/ld+json">
        {JSON.stringify(itemListJsonLd)}
      </Script>
      <Script id="models-faq-jsonld" type="application/ld+json">
        {JSON.stringify(faqJsonLd)}
      </Script>
    </main>
  );
}
